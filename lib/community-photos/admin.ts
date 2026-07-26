import type { SupabaseClient } from "@supabase/supabase-js";

import { CommunityPhotoError } from "./errors";

interface RpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

function asRpcClient(client: SupabaseClient): RpcClient {
  return client as unknown as RpcClient;
}

async function rpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await asRpcClient(client).rpc(name, args);
  if (result.error) {
    const known = [
      "photo_not_found",
      "pin_not_found",
      "hold_not_found",
      "restriction_not_found",
      "photo_not_recoverable",
      "invalid_request",
    ].find((code) => result.error?.message?.includes(code));
    throw new CommunityPhotoError(known ?? "database_failed", !known);
  }
  return Array.isArray(result.data) && result.data.length === 1
    ? result.data[0]
    : result.data;
}

export async function listCommunityPhotosForAdmin({
  client,
  status,
  targetType,
  targetId,
  limit,
  before,
}: {
  client: SupabaseClient;
  status: "all" | "visible" | "hidden" | "removed";
  targetType: "beach" | "custom_spot" | null;
  targetId: string | null;
  limit: number;
  before: string | null;
}): Promise<unknown> {
  return rpc(client, "admin_list_community_spot_photos_v1", {
    p_status: status,
    p_target_type: targetType,
    p_target_id: targetId,
    p_limit: limit,
    p_before: before,
  });
}

export function moderateCommunityPhoto(
  client: SupabaseClient,
  input: {
    photoId: string;
    actorId: string;
    action: "hide" | "restore";
    reason: string;
    idempotencyKey: string;
  },
): Promise<unknown> {
  return rpc(client, "moderate_community_spot_photo_v1", {
    p_photo_id: input.photoId,
    p_actor_id: input.actorId,
    p_action: input.action,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function pinCommunityPhoto(
  client: SupabaseClient,
  input: {
    photoId: string;
    actorId: string;
    targetType: "beach" | "custom_spot";
    targetId: string;
    idempotencyKey: string;
  },
): Promise<unknown> {
  return rpc(client, "pin_community_spot_photo_v1", {
    p_photo_id: input.photoId,
    p_actor_id: input.actorId,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function unpinCommunityPhoto(
  client: SupabaseClient,
  input: { photoId: string; actorId: string; idempotencyKey: string },
): Promise<unknown> {
  return rpc(client, "unpin_community_spot_photo_v1", {
    p_photo_id: input.photoId,
    p_actor_id: input.actorId,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function recoverCommunityPhoto(
  client: SupabaseClient,
  input: { photoId: string; actorId: string; idempotencyKey: string },
): Promise<unknown> {
  return rpc(client, "recover_community_spot_photo_v1", {
    p_photo_id: input.photoId,
    p_actor_id: input.actorId,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function holdCommunityPhoto(
  client: SupabaseClient,
  input: {
    photoId: string;
    actorId: string;
    reason: string;
    idempotencyKey: string;
  },
): Promise<unknown> {
  return rpc(client, "hold_community_spot_photo_v1", {
    p_photo_id: input.photoId,
    p_actor_id: input.actorId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function releaseCommunityPhotoHold(
  client: SupabaseClient,
  input: { photoId: string; actorId: string; idempotencyKey: string },
): Promise<unknown> {
  return rpc(client, "release_community_spot_photo_hold_v1", {
    p_photo_id: input.photoId,
    p_actor_id: input.actorId,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function restrictCommunityPhotoContributor(
  client: SupabaseClient,
  input: {
    contributorId: string;
    actorId: string;
    reasonCode: string;
    restrictedUntil: string | null;
    idempotencyKey: string;
  },
): Promise<unknown> {
  return rpc(client, "restrict_community_photo_contributor_v1", {
    p_contributor_id: input.contributorId,
    p_actor_id: input.actorId,
    p_reason_code: input.reasonCode,
    p_restricted_until: input.restrictedUntil,
    p_idempotency_key: input.idempotencyKey,
  });
}

export function unrestrictCommunityPhotoContributor(
  client: SupabaseClient,
  input: {
    contributorId: string;
    actorId: string;
    idempotencyKey: string;
  },
): Promise<unknown> {
  return rpc(client, "unrestrict_community_photo_contributor_v1", {
    p_contributor_id: input.contributorId,
    p_actor_id: input.actorId,
    p_idempotency_key: input.idempotencyKey,
  });
}
