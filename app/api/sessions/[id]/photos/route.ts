import { NextRequest, NextResponse } from "next/server";
import {
  createAuthError,
  createSuccessResponse,
  createValidationError,
  DEFAULT_SECURITY_HEADERS,
  handleApiError,
  isValidUuid,
  methodNotAllowed,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionPhotos } from "@/lib/supabase/storage";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = (await context.params);
    if (!sessionId || !isValidUuid(sessionId)) {
      return createValidationError("Invalid session id format");
    }

    const supabase = await createSupabaseServerClient();

    // Fetch the session first so we can decide whether auth is required.
    // Public sessions are viewable by anyone (for guest-mode beach page feeds),
    // private sessions require the viewer to be the owner. Previously this
    // handler rejected all unauthenticated requests with 401 before checking
    // `is_public`, which broke the anonymous session carousel on beach detail.
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
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
  } catch (error) {
    return handleApiError(error, "Failed to load session photos");
  }
}

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


