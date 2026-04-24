import { NextRequest, NextResponse } from "next/server";
import {
  createValidationError,
  DEFAULT_SECURITY_HEADERS,
  isValidUuid,
} from "@/lib/api-utils";
import {
  withAuth,
  createSuccessResponse,
  createAuthError,
  methodNotAllowed,
} from "@/lib/middleware/api-wrappers";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers/types";
import { getSessionPhotos } from "@/lib/supabase/storage";

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

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}
