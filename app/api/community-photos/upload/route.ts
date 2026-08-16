import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  CommunityPhotoError,
  communityPhotoErrorResponse,
  completeCommunityPhotoUpload,
  failCommunityPhotoUpload,
  getCommunityPhotoFeatureFlags,
  parseCommunityPhotoUploadFields,
  preflightCommunityPhotoUpload,
  reserveCommunityPhotoUpload,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  COMMUNITY_PHOTO_MAX_INPUT_BYTES,
  processCommunityPhoto,
} from "@/lib/community-photos/image-processing";
import { COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES } from "@/lib/community-photos/upload-constraints";
import {
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCEPTED_IMAGE_TYPES: ReadonlySet<string> = new Set(
  COMMUNITY_PHOTO_ACCEPTED_MIME_TYPES,
);
const EXPECTED_FIELDS = new Set([
  "photo",
  "targetType",
  "targetId",
  "visibility",
  "termsVersion",
  "rightsConfirmed",
  "idempotencyKey",
]);

async function uploadHandler(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    if (!getCommunityPhotoFeatureFlags(user.id).writeEnabled) {
      throw new CommunityPhotoError("feature_disabled");
    }
    const idempotencyKey = z
      .string()
      .uuid()
      .parse(request.headers.get("Idempotency-Key"));
    await preflightCommunityPhotoUpload({
      uploaderId: user.id,
      idempotencyKey,
    });
    const form = await request.formData();
    if ([...form.keys()].some((key) => !EXPECTED_FIELDS.has(key))) {
      throw new CommunityPhotoError("invalid_request");
    }
    const files = form.getAll("photo");
    if (files.length !== 1 || !(files[0] instanceof File)) {
      throw new CommunityPhotoError("invalid_request");
    }
    const file = files[0];
    if (
      !ACCEPTED_IMAGE_TYPES.has(file.type) ||
      file.size === 0 ||
      file.size > COMMUNITY_PHOTO_MAX_INPUT_BYTES
    ) {
      throw new CommunityPhotoError(
        file.size > COMMUNITY_PHOTO_MAX_INPUT_BYTES
          ? "image_too_large"
          : "invalid_image",
      );
    }

    const fields = parseCommunityPhotoUploadFields({
      targetType: form.get("targetType"),
      targetId: form.get("targetId"),
      visibility: form.get("visibility"),
      termsVersion: form.get("termsVersion"),
      rightsConfirmed: form.get("rightsConfirmed"),
      idempotencyKey: form.get("idempotencyKey"),
    });
    if (fields.idempotencyKey !== idempotencyKey) {
      throw new CommunityPhotoError("invalid_request");
    }
    const reservation = await reserveCommunityPhotoUpload({
      uploaderId: user.id,
      ...fields,
    });
    if (reservation.replay && reservation.processingStatus !== "ready") {
      throw new CommunityPhotoError("upload_in_progress", true);
    }
    let image = null;
    if (!reservation.replay) {
      try {
        image = await processCommunityPhoto(
          Buffer.from(await file.arrayBuffer()),
        );
      } catch (error) {
        const reasonCode =
          error instanceof Error &&
          [
            "image_too_large",
            "image_pixel_limit_exceeded",
            "invalid_image",
          ].includes(error.message)
            ? error.message
            : "invalid_image";
        await failCommunityPhotoUpload({
          photoId: reservation.photoId,
          uploaderId: user.id,
          reasonCode,
        });
        throw error;
      }
    }
    const result = await completeCommunityPhotoUpload({
      uploaderId: user.id,
      reservation,
      image,
    });
    return NextResponse.json(
      { photo: result.photo },
      {
        status: result.replay ? 200 : 201,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const POST = withCommunityPhotoRouteObservability(
  {
    route: "/api/community-photos/upload",
    surface: "write",
    successResultClass: "upload_success",
  },
  withRateLimit(
    withAuth(uploadHandler, {
      errorMessage: "Community photo upload failed",
    }),
    "authenticated-default",
  ),
);
