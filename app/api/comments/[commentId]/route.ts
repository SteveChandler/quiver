import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, createAuthError } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  context: { params: { commentId: string } }
) {
  try {
    const { commentId } = context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createAuthError();
    }

    const { error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    return createSuccessResponse({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete comment");
  }
}


