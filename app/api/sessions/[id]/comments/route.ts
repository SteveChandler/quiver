import type { NextRequest } from "next/server";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  validateOrError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { CommentSchema } from "@/lib/validation/schemas";

export const GET = withAuth(
  async (_request: NextRequest, { supabase, params }: AuthenticatedContext) => {
    const sessionResult = validateUuidParam(params.id, "session");
    if ("error" in sessionResult) return sessionResult.error;

    const sessionId = sessionResult.value;

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
  },
  { optional: true, errorMessage: "Failed to load comments" }
);

export const POST = withAuth(
  async (request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const sessionResult = validateUuidParam(params.id, "session");
    if ("error" in sessionResult) return sessionResult.error;

    const sessionId = sessionResult.value;

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
  },
  { errorMessage: "Failed to create comment" }
);

export function DELETE() {
  return methodNotAllowed(["GET", "POST"]);
}


