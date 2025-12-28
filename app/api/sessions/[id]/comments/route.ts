import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
  createAuthError,
  createValidationError,
  methodNotAllowed,
  isValidUuid,
  validateOrError,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { CommentSchema } from "@/lib/validation/schemas";

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

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        user:profiles(full_name, avatar_url, email)
      `
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return createSuccessResponse({ comments: data || [] });
  } catch (error) {
    return handleApiError(error, "Failed to load comments");
  }
}

export async function POST(
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
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createAuthError();
    }

    // Validate Content-Type and parse JSON
    const parseResult = await parseAndValidateJson(request);
    if ('error' in parseResult) {
      return parseResult.error;
    }

    // Validate against schema (including max length check)
    const validationResult = validateOrError(CommentSchema, {
      ...(parseResult.data as Record<string, unknown>),
      session_id: sessionId, // Add session_id from URL params
    });

    if ('error' in validationResult) {
      return validationResult.error;
    }

    const { content } = validationResult.data;

    const { error: insertError } = await supabase.from("comments").insert({
      session_id: sessionId,
      user_id: user.id,
      content,
    });
    if (insertError) throw insertError;

    return createSuccessResponse({ message: "Comment created successfully" });
  } catch (error) {
    return handleApiError(error, "Failed to create comment");
  }
}

export function DELETE() {
  return methodNotAllowed(["GET", "POST"]);
}


