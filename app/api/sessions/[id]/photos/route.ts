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
  context: { params: { id: string } }
) {
  try {
    const { id: sessionId } = context.params;
    if (!sessionId || !isValidUuid(sessionId)) {
      return createValidationError("Invalid session id format");
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createAuthError();
    }

    // Allow access for: owner, or public sessions (so feeds can show photos).
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

    if (!existing || (!existing.is_public && existing.user_id !== user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          timestamp: new Date().toISOString(),
        },
        { status: 403, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

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


