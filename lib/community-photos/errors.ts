import { NextResponse } from "next/server";

import type { CommunityPhotoApiError } from "./types";

const ERROR_STATUS: Record<string, number> = {
  invalid_request: 400,
  consent_required: 400,
  invalid_target: 400,
  invalid_vote: 400,
  invalid_report: 400,
  unauthorized: 401,
  feature_disabled: 403,
  contributor_restricted: 403,
  private_target_forbidden: 403,
  photo_owner_cannot_vote: 403,
  photo_owner_cannot_report: 403,
  target_active_limit: 429,
  rolling_upload_limit: 429,
  photo_not_found: 404,
  pin_not_found: 404,
  hold_not_found: 404,
  restriction_not_found: 404,
  photo_not_recoverable: 409,
  idempotency_conflict: 409,
  upload_in_progress: 409,
  upload_attempt_failed: 409,
  image_too_large: 413,
  image_pixel_limit_exceeded: 413,
  invalid_image: 415,
  storage_failed: 500,
  database_failed: 500,
};

export class CommunityPhotoError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "CommunityPhotoError";
  }
}

export function communityPhotoErrorResponse(error: unknown): NextResponse {
  const rawMessage =
    error instanceof CommunityPhotoError
      ? error.code
      : error instanceof Error
        ? error.message
        : "database_failed";
  const code =
    Object.prototype.hasOwnProperty.call(ERROR_STATUS, rawMessage)
      ? rawMessage
      : "database_failed";
  const body: CommunityPhotoApiError = {
    error: code.replaceAll("_", " "),
    code,
    retryable:
      error instanceof CommunityPhotoError
        ? error.retryable
        : code === "database_failed" || code === "storage_failed",
  };
  return NextResponse.json(body, {
    status: ERROR_STATUS[code] ?? 500,
    headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
  });
}
