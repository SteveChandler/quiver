import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthError,
  createSuccessResponse,
  createValidationError,
  DEFAULT_SECURITY_HEADERS,
  handleApiError,
  isValidUuid,
  methodNotAllowed,
  validateOrError,
} from "@/lib/api-utils";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addFeaturedPhotoToSession } from "@/actions/session-actions";

const SessionUpdateSchema = z.object({
  notes: z.string().max(5000).optional(),
  is_public: z.boolean().optional(),
  rating: z.number().int().min(0).max(5).optional(),
});

async function requireOwnedSession(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, sessionId: string, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (existingError) {
    if (existingError.code === "PGRST116") {
      return { error: NextResponse.json({ success: false, error: "Session not found", timestamp: new Date().toISOString() }, { status: 404, headers: DEFAULT_SECURITY_HEADERS }) };
    }
    throw existingError;
  }

  if (!existing || existing.user_id !== userId) {
    return { error: NextResponse.json({ success: false, error: "Forbidden", timestamp: new Date().toISOString() }, { status: 403, headers: DEFAULT_SECURITY_HEADERS }) };
  }

  return { ok: true as const };
}

export async function PATCH(
  request: NextRequest,
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

    const parseResult = await parseAndValidateJson(request);
    if ("error" in parseResult) return parseResult.error;

    const validation = validateOrError(SessionUpdateSchema, parseResult.data);
    if ("error" in validation) return validation.error;

    const ownership = await requireOwnedSession(supabase, sessionId, user.id);
    if ("error" in ownership) return ownership.error;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (validation.data.notes !== undefined) updatePayload.notes = validation.data.notes;
    if (validation.data.is_public !== undefined) updatePayload.is_public = validation.data.is_public;
    if (validation.data.rating !== undefined) updatePayload.rating = validation.data.rating;

    const { data: updated, error: updateError } = await supabase
      .from("sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return createSuccessResponse({ session: updated });
  } catch (error) {
    return handleApiError(error, "Failed to update session");
  }
}

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

    const ownership = await requireOwnedSession(supabase, sessionId, user.id);
    if ("error" in ownership) return ownership.error;

    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        *,
        session_date:arrival_time,
        beach:beaches(*),
        board:boards(*),
        user:profiles(*)
      `
      )
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    const enriched = await addFeaturedPhotoToSession(supabase, data);
    return createSuccessResponse({ session: enriched ?? data });
  } catch (error) {
    return handleApiError(error, "Failed to load session");
  }
}

export function POST() {
  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}

export function PUT() {
  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}

export async function DELETE(
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

    const ownership = await requireOwnedSession(supabase, sessionId, user.id);
    if ("error" in ownership) return ownership.error;

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) throw error;

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete session");
  }
}


