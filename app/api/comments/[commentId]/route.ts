import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, createAuthError, createValidationError, methodNotAllowed, isValidUuid } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = (await context.params);
    if (!commentId || !isValidUuid(commentId)) {
      return createValidationError("Invalid comment id format");
    }
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

    return createSuccessResponse({ message: "Comment deleted successfully" });
  } catch (error) {
    return handleApiError(error, "Failed to delete comment");
  }
}

export function GET() {
  return methodNotAllowed(["DELETE"]);
}


