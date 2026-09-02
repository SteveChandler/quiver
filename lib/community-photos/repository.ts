import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "@/lib/supabase";

import type {
  CommunityPhotoReportReason,
  CommunityPhotoTargetType,
  CommunityPhotoVisibility,
  CommunityPhotoVote,
  RecoverableCommunityPhoto,
  ResolvedSpotPhoto,
} from "./types";
import type { ProcessedCommunityPhoto } from "./image-processing";
import { CommunityPhotoError } from "./errors";
import { getCommunityPhotoById } from "./resolver";

interface RpcResult {
  data: unknown;
  error: { message?: string; details?: string; code?: string } | null;
}

interface StorageResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

interface CommunityPhotoClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        bytes: Blob,
        options: {
          contentType: string;
          cacheControl: string;
          upsert: boolean;
        },
      ): PromiseLike<StorageResult<{ path: string }>>;
      download(path: string): PromiseLike<StorageResult<Blob>>;
      remove(paths: string[]): PromiseLike<StorageResult<unknown>>;
    };
  };
}

function client(): CommunityPhotoClient {
  return createServiceRoleClient() as unknown as CommunityPhotoClient;
}

function throwRpcError(error: RpcResult["error"]): never {
  const message = error?.message ?? "database_failed";
  const boundedCode = [
    "feature_disabled",
    "consent_required",
    "contributor_restricted",
    "invalid_target",
    "private_target_forbidden",
    "target_active_limit",
    "rolling_upload_limit",
    "photo_not_found",
    "photo_owner_cannot_vote",
    "photo_owner_cannot_report",
    "invalid_vote",
    "invalid_report",
    "pin_not_found",
    "photo_not_recoverable",
    "idempotency_conflict",
    "upload_in_progress",
    "upload_attempt_failed",
  ].find((code) => message.includes(code));
  throw new CommunityPhotoError(
    boundedCode ?? "database_failed",
    !boundedCode || boundedCode === "upload_in_progress",
  );
}

export interface CommunityPhotoUploadReservation {
  photoId: string;
  storagePath: string;
  replay: boolean;
  processingStatus: "processing" | "ready" | "cleanup";
}

export async function preflightCommunityPhotoUpload({
  uploaderId,
  idempotencyKey,
}: {
  uploaderId: string;
  idempotencyKey: string;
}): Promise<void> {
  const result = await client().rpc(
    "preflight_community_spot_photo_upload_v1",
    {
      p_uploader_id: uploaderId,
      p_idempotency_key: idempotencyKey,
    },
  );
  if (result.error) throwRpcError(result.error);
  if (result.data !== true) {
    throw new CommunityPhotoError("database_failed", true);
  }
}

export async function reserveCommunityPhotoUpload({
  uploaderId,
  targetType,
  targetId,
  visibility,
  termsVersion,
  rightsConfirmed,
  idempotencyKey,
}: {
  uploaderId: string;
  targetType: CommunityPhotoTargetType;
  targetId: string;
  visibility: CommunityPhotoVisibility;
  termsVersion: string;
  rightsConfirmed: boolean;
  idempotencyKey: string;
}): Promise<CommunityPhotoUploadReservation> {
  const database = client();
  const photoId = randomUUID();
  const storagePath = `${uploaderId}/${photoId}.webp`;
  const reserve = await database.rpc("reserve_community_spot_photo_v1", {
    p_photo_id: photoId,
    p_uploader_id: uploaderId,
    p_target_type: targetType,
    p_target_id: targetId,
    p_visibility: visibility,
    p_storage_path: storagePath,
    p_terms_version: termsVersion,
    p_rights_confirmed: rightsConfirmed,
    p_idempotency_key: idempotencyKey,
  });
  if (reserve.error) throwRpcError(reserve.error);
  const reservation = (
    Array.isArray(reserve.data) ? reserve.data[0] : reserve.data
  ) as {
    photo_id: string;
    storage_path: string;
    replay: boolean;
    processing_status: "processing" | "ready" | "cleanup";
  } | null;
  if (
    !reservation?.photo_id ||
    !reservation.storage_path ||
    !["processing", "ready", "cleanup"].includes(
      reservation.processing_status,
    )
  ) {
    throw new CommunityPhotoError("database_failed", true);
  }
  return {
    photoId: reservation.photo_id,
    storagePath: reservation.storage_path,
    replay: reservation.replay,
    processingStatus: reservation.processing_status,
  };
}

export async function failCommunityPhotoUpload({
  photoId,
  uploaderId,
  reasonCode,
}: {
  photoId: string;
  uploaderId: string;
  reasonCode: string;
}): Promise<void> {
  const result = await client().rpc("fail_community_spot_photo_upload_v1", {
    p_photo_id: photoId,
    p_uploader_id: uploaderId,
    p_reason_code: reasonCode,
  });
  if (result.error || result.data !== true) {
    throw new CommunityPhotoError("database_failed", true);
  }
}

export async function completeCommunityPhotoUpload({
  uploaderId,
  reservation,
  image,
}: {
  uploaderId: string;
  reservation: CommunityPhotoUploadReservation;
  image: ProcessedCommunityPhoto | null;
}): Promise<{ photo: ResolvedSpotPhoto; replay: boolean }> {
  const database = client();
  if (reservation.replay && reservation.processingStatus !== "ready") {
    throw new CommunityPhotoError("upload_in_progress", true);
  }
  if (!reservation.replay) {
    if (!image) throw new CommunityPhotoError("invalid_image");
    const upload = await database.storage
      .from("community-spot-photos")
      .upload(
        reservation.storagePath,
        new Blob([new Uint8Array(image.bytes)], { type: image.contentType }),
        {
          contentType: image.contentType,
          cacheControl: "31536000",
          upsert: false,
        },
      );
    if (upload.error) {
      await failCommunityPhotoUpload({
        photoId: reservation.photoId,
        uploaderId,
        reasonCode: "storage_upload_failed",
      });
      throw new CommunityPhotoError("storage_failed", true);
    }

    const finalized = await database.rpc("finalize_community_spot_photo_v1", {
      p_photo_id: reservation.photoId,
      p_uploader_id: uploaderId,
      p_width: image.width,
      p_height: image.height,
    });
    if (finalized.error || finalized.data !== true) {
      await database.storage
        .from("community-spot-photos")
        .remove([reservation.storagePath]);
      await failCommunityPhotoUpload({
        photoId: reservation.photoId,
        uploaderId,
        reasonCode: "database_finalize_failed",
      });
      throw new CommunityPhotoError("database_failed", true);
    }
  }

  const photo = await getCommunityPhotoById({
    photoId: reservation.photoId,
    viewerId: uploaderId,
  });
  return { photo, replay: reservation.replay };
}

export async function uploadCommunityPhoto({
  uploaderId,
  image,
  ...fields
}: {
  uploaderId: string;
  targetType: CommunityPhotoTargetType;
  targetId: string;
  visibility: CommunityPhotoVisibility;
  termsVersion: string;
  rightsConfirmed: boolean;
  idempotencyKey: string;
  image: ProcessedCommunityPhoto;
}): Promise<{ photo: ResolvedSpotPhoto; replay: boolean }> {
  const reservation = await reserveCommunityPhotoUpload({
    uploaderId,
    ...fields,
  });
  return completeCommunityPhotoUpload({
    uploaderId,
    reservation,
    image: reservation.replay ? null : image,
  });
}

export async function downloadCommunityPhoto({
  photoId,
  viewerId,
}: {
  photoId: string;
  viewerId: string | null;
}): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const database = client();
  const lookup = await database.rpc("get_community_spot_photo_image_v1", {
    p_photo_id: photoId,
    p_viewer_id: viewerId,
  });
  if (lookup.error) throwRpcError(lookup.error);
  const row = (Array.isArray(lookup.data) ? lookup.data[0] : lookup.data) as {
    storage_path: string;
    content_type: string;
  } | null;
  if (!row) throw new CommunityPhotoError("photo_not_found");

  const download = await database.storage
    .from("community-spot-photos")
    .download(row.storage_path);
  if (download.error || !download.data) {
    throw new CommunityPhotoError("storage_failed", true);
  }
  return {
    bytes: await download.data.arrayBuffer(),
    contentType: row.content_type,
  };
}

export async function listOwnedRemovedCommunityPhotos({
  uploaderId,
}: {
  uploaderId: string;
}): Promise<RecoverableCommunityPhoto[]> {
  const result = await client().rpc(
    "list_owned_removed_community_spot_photos_v1",
    { p_uploader_id: uploaderId },
  );
  if (result.error) throwRpcError(result.error);
  const rows = (result.data ?? []) as Array<{
    photo_id: string;
    target_type: CommunityPhotoTargetType;
    target_id: string;
    recoverable_until: string;
    moderation_status: "visible" | "hidden";
    has_active_hold: boolean;
  }>;
  return rows.map((row) => ({
    id: row.photo_id,
    targetType: row.target_type,
    targetId: row.target_id,
    imageUrl: `/api/community-photos/${row.photo_id}/image`,
    thumbUrl: `/api/community-photos/${row.photo_id}/image`,
    recoverableUntil: row.recoverable_until,
    moderationStatus: row.moderation_status,
    hasActiveHold: row.has_active_hold,
  }));
}

export async function recoverOwnedCommunityPhoto({
  photoId,
  uploaderId,
  idempotencyKey,
}: {
  photoId: string;
  uploaderId: string;
  idempotencyKey: string;
}): Promise<{ photoId: string; status: "active" }> {
  const result = await client().rpc(
    "recover_owned_community_spot_photo_v1",
    {
      p_photo_id: photoId,
      p_uploader_id: uploaderId,
      p_idempotency_key: idempotencyKey,
    },
  );
  if (result.error) throwRpcError(result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as {
    photo_id: string;
    status: "active";
  } | null;
  if (!row) throw new CommunityPhotoError("database_failed", true);
  return { photoId: row.photo_id, status: row.status };
}

export async function downloadAdminCommunityPhoto({
  photoId,
  actorId,
  auditId,
}: {
  photoId: string;
  actorId: string;
  auditId: string;
}): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const database = client();
  const lookup = await database.rpc(
    "get_admin_community_spot_photo_image_v1",
    {
      p_photo_id: photoId,
      p_actor_id: actorId,
      p_audit_id: auditId,
    },
  );
  if (lookup.error) throwRpcError(lookup.error);
  const row = (Array.isArray(lookup.data) ? lookup.data[0] : lookup.data) as {
    storage_path: string;
    content_type: string;
  } | null;
  if (!row) throw new CommunityPhotoError("photo_not_found");
  const download = await database.storage
    .from("community-spot-photos")
    .download(row.storage_path);
  if (download.error || !download.data) {
    throw new CommunityPhotoError("storage_failed", true);
  }
  return {
    bytes: await download.data.arrayBuffer(),
    contentType: row.content_type,
  };
}

export async function voteCommunityPhoto({
  photoId,
  voterId,
  vote,
  idempotencyKey,
}: {
  photoId: string;
  voterId: string;
  vote: CommunityPhotoVote;
  idempotencyKey: string;
}): Promise<{
  photoId: string;
  vote: CommunityPhotoVote;
  upvotes: number;
  downvotes: number;
  voteScore: number;
}> {
  const result = await client().rpc("vote_community_spot_photo_v1", {
    p_photo_id: photoId,
    p_voter_id: voterId,
    p_vote: vote,
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) throwRpcError(result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as {
    photo_id: string;
    vote: CommunityPhotoVote;
    upvotes: number;
    downvotes: number;
    vote_score: number;
  } | null;
  if (!row) throw new CommunityPhotoError("database_failed", true);
  return {
    photoId: row.photo_id,
    vote: row.vote,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    voteScore: row.vote_score,
  };
}

export async function reportCommunityPhoto({
  photoId,
  reporterId,
  reason,
  idempotencyKey,
}: {
  photoId: string;
  reporterId: string;
  reason: CommunityPhotoReportReason;
  idempotencyKey: string;
}): Promise<{ photoId: string; status: string; reportCount: number }> {
  const result = await client().rpc("report_community_spot_photo_v1", {
    p_photo_id: photoId,
    p_reporter_id: reporterId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) throwRpcError(result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as {
    photo_id: string;
    status: string;
    report_count: number;
  } | null;
  if (!row) throw new CommunityPhotoError("database_failed", true);
  return {
    photoId: row.photo_id,
    status: row.status,
    reportCount: row.report_count,
  };
}

export async function removeCommunityPhoto({
  photoId,
  uploaderId,
  idempotencyKey,
}: {
  photoId: string;
  uploaderId: string;
  idempotencyKey: string;
}): Promise<{
  photoId: string;
  status: string;
  recoverableUntil: string;
}> {
  const result = await client().rpc("remove_community_spot_photo_v1", {
    p_photo_id: photoId,
    p_uploader_id: uploaderId,
    p_idempotency_key: idempotencyKey,
  });
  if (result.error) throwRpcError(result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as {
    photo_id: string;
    status: string;
    recoverable_until: string;
  } | null;
  if (!row) throw new CommunityPhotoError("database_failed", true);
  return {
    photoId: row.photo_id,
    status: row.status,
    recoverableUntil: row.recoverable_until,
  };
}
