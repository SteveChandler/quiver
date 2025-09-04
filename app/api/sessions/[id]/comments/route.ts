import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
  createAuthError,
  createValidationError,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id: sessionId } = context.params;
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
      .is("parent_comment", null)
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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createAuthError();
    }

    const body = await request.json().catch(() => ({}));
    const content = (body?.content || "").toString().trim();
    if (!content) {
      return createValidationError("Content is required");
    }

    const { error: insertError } = await supabase.from("comments").insert({
      session_id: sessionId,
      user_id: user.id,
      content,
    });
    if (insertError) throw insertError;

    return createSuccessResponse({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to create comment");
  }
}


