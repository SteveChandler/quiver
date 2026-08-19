import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  createAuthError,
  methodNotAllowed,
  createValidationError,
  DEFAULT_SECURITY_HEADERS,
  isValidUuid,
  type AuthenticatedContext,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import { getSessionPhotos } from "@/lib/supabase/storage";
import {
  SESSION_PHOTO_MAX_PER_SESSION,
  validateSessionPhotoInput,
} from "@/lib/media/session-photo-policy";
import type { Database } from "@/types/database.generated";

const STORAGE_BUCKET = "session-media";

type PhotoUploadStage =
  | "validation"
  | "storage_upload"
  | "media_insert"
  | "session_image_update";

type SessionMediaInsert =
  Database["public"]["Tables"]["session_media"]["Insert"];

type UploadedPhotoRecord = Pick<
  Database["public"]["Tables"]["session_media"]["Row"],
  "id" | "public_url" | "storage_path" | "file_size" | "media_type"
>;

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

function validationError(message: string, errorCode: string): NextResponse {
  return withNoStore(
    createValidationError(message, {
      stage: "validation",
      error_code: errorCode,
    })
  );
}

function uploadError(
  message: string,
  stage: PhotoUploadStage,
  errorCode: string,
  status = 502
): NextResponse {
  return withNoStore(
    createErrorResponse(
      message,
      {
        stage,
        error_code: errorCode,
      },
      status
    )
  );
}

function forbiddenResponse(): NextResponse {
  return withNoStore(
    NextResponse.json(
      {
        success: false,
        error: "Forbidden",
        timestamp: new Date().toISOString(),
      },
      { status: 403, headers: DEFAULT_SECURITY_HEADERS }
    )
  );
}

function notFoundResponse(): NextResponse {
  return withNoStore(
    NextResponse.json(
      {
        success: false,
        error: "Session not found",
        timestamp: new Date().toISOString(),
      },
      { status: 404, headers: DEFAULT_SECURITY_HEADERS }
    )
  );
}

function isPhotoFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function getStorageExtension(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function validatePhotos(photos: File[]): NextResponse | null {
  if (photos.length === 0) {
    return validationError("No photos provided", "no_photos");
  }

  if (photos.length > SESSION_PHOTO_MAX_PER_SESSION) {
    return validationError(
      `Maximum ${SESSION_PHOTO_MAX_PER_SESSION} photos allowed per session`,
      "too_many_photos"
    );
  }

  for (const photo of photos) {
    const inputValidation = validateSessionPhotoInput(photo);
    if (inputValidation === "invalid_file_type") {
      return validationError(
        "Only JPEG, PNG, and WebP images are allowed.",
        "invalid_file_type"
      );
    }

    if (inputValidation === "file_too_large") {
      return validationError(
        "File is too large. Please choose an image smaller than 10MB.",
        "file_too_large"
      );
    }
  }

  return null;
}

async function cleanupUploadedPhotos(
  supabase: AuthenticatedContext["supabase"],
  storagePaths: string[],
  mediaIds: string[] = []
): Promise<void> {
  if (mediaIds.length > 0) {
    await supabase.from("session_media").delete().in("id", mediaIds);
  }

  if (storagePaths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
  }
}

/**
 * GET /api/sessions/[id]/photos
 *
 * Public sessions are viewable by anyone (for guest-mode beach page feeds).
 * Private sessions require the viewer to be the owner.
 *
 * Authentication is OPTIONAL. Public sessions don't require a user; private
 * sessions require the session owner (cookie-session or Bearer token).
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    { user, supabase, params }: OptionalAuthContext
  ): Promise<NextResponse> => {
    const sessionId = params.id;
    if (!sessionId || !isValidUuid(sessionId)) {
      return createValidationError("Invalid session id format");
    }

    // Fetch the session first so we can decide whether auth is required.
    const { data: existing, error: existingError } = await supabase
      .from("sessions")
      .select("id, user_id, is_public")
      .eq("id", sessionId)
      .single();

    if (existingError) {
      if (existingError.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            error: "Session not found",
            timestamp: new Date().toISOString(),
          },
          { status: 404, headers: DEFAULT_SECURITY_HEADERS }
        );
      }
      throw existingError;
    }

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Session not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    // Private session — require an authenticated viewer who owns it.
    if (!existing.is_public) {
      if (!user) {
        return createAuthError();
      }

      if (existing.user_id !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden",
            timestamp: new Date().toISOString(),
          },
          { status: 403, headers: DEFAULT_SECURITY_HEADERS }
        );
      }
    }

    // Public session (or authenticated owner) — return photos.
    // RLS policy "Public can view media from public sessions" on session_media
    // gates the data access for anonymous callers.
    const photos = await getSessionPhotos(sessionId, supabase);
    return createSuccessResponse({ photos });
  },
  { optional: true, errorMessage: "Failed to load session photos" }
);

export const POST = withAuth(
  async (
    request: NextRequest,
    { user, supabase, params }: AuthenticatedContext
  ): Promise<NextResponse> => {
    const sessionId = params.id;
    if (!sessionId || !isValidUuid(sessionId)) {
      return validationError("Invalid session id format", "invalid_session_id");
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return validationError("Invalid multipart form data", "invalid_form_data");
    }

    const photos = formData.getAll("photos").filter(isPhotoFile);
    const photoValidation = validatePhotos(photos);
    if (photoValidation) return photoValidation;

    const { data: existing, error: existingError } = await supabase
      .from("sessions")
      .select("id, user_id, image_url")
      .eq("id", sessionId)
      .single();

    if (existingError) {
      if (existingError.code === "PGRST116") return notFoundResponse();
      throw existingError;
    }

    if (!existing) return notFoundResponse();
    if (existing.user_id !== user.id) return forbiddenResponse();

    const { data: existingPhotos, error: existingPhotosError } = await supabase
      .from("session_media")
      .select("id")
      .eq("session_id", sessionId)
      .is("deleted_at", null);

    if (existingPhotosError) {
      return uploadError(
        "Failed to validate session photo count",
        "media_insert",
        "media_insert_failed"
      );
    }

    if (
      (existingPhotos?.length ?? 0) + photos.length >
      SESSION_PHOTO_MAX_PER_SESSION
    ) {
      return validationError(
        `Session can only have ${SESSION_PHOTO_MAX_PER_SESSION} photos total`,
        "too_many_photos"
      );
    }

    const uploadedStoragePaths: string[] = [];
    const mediaRecords: SessionMediaInsert[] = [];

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const storagePath = `${sessionId}/${user.id}/${Date.now()}-${index}.${getStorageExtension(photo.type)}`;
      const { data: uploadData, error: uploadFailure } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, photo, {
          cacheControl: "3600",
          contentType: photo.type,
          upsert: false,
        });

      if (uploadFailure) {
        await cleanupUploadedPhotos(supabase, uploadedStoragePaths);
        return uploadError(
          "Failed to upload session photo",
          "storage_upload",
          "storage_upload_failed"
        );
      }

      const savedPath = uploadData?.path ?? storagePath;
      uploadedStoragePaths.push(savedPath);

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(savedPath);

      mediaRecords.push({
        session_id: sessionId,
        user_id: user.id,
        storage_path: savedPath,
        public_url: urlData.publicUrl,
        file_size: photo.size,
        media_type: "photo",
        metadata: {
          upload_source: "api_session_photos",
          upload_timestamp: Date.now(),
        },
      });
    }

    const { data: insertedPhotos, error: mediaInsertError } = await supabase
      .from("session_media")
      .insert(mediaRecords)
      .select("id, public_url, storage_path, file_size, media_type");

    if (mediaInsertError || !insertedPhotos) {
      await cleanupUploadedPhotos(supabase, uploadedStoragePaths);
      return uploadError(
        "Failed to save session photo records",
        "media_insert",
        "media_insert_failed"
      );
    }

    let heroAttached = false;
    const typedPhotos = insertedPhotos as UploadedPhotoRecord[];

    if (!existing.image_url && typedPhotos[0]?.public_url) {
      const { error: sessionImageError } = await supabase
        .from("sessions")
        .update({ image_url: typedPhotos[0].public_url })
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .is("image_url", null);

      if (sessionImageError) {
        await cleanupUploadedPhotos(
          supabase,
          uploadedStoragePaths,
          typedPhotos.map((photo) => photo.id)
        );
        return uploadError(
          "Failed to attach session hero photo",
          "session_image_update",
          "session_image_update_failed"
        );
      }

      heroAttached = true;
    }

    return withNoStore(
      createSuccessResponse({
        photos: typedPhotos,
        uploaded_count: typedPhotos.length,
        hero_attached: heroAttached,
      })
    );
  },
  { errorMessage: "Failed to upload session photos" }
);

export function PUT() {
  return methodNotAllowed(["GET", "POST"]);
}

export function PATCH() {
  return methodNotAllowed(["GET", "POST"]);
}

export function DELETE() {
  return methodNotAllowed(["GET", "POST"]);
}
