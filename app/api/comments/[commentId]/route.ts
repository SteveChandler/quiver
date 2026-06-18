import { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createNotFoundError,
  createValidationError,
  isValidUuid,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    { user, supabase, params }: AuthenticatedContext
  ) => {
    const commentId = params.commentId;
    if (!commentId || !isValidUuid(commentId)) {
      return createValidationError("Invalid comment id format");
    }

    const { data: deletedComment, error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deletedComment) return createNotFoundError("Comment");

    return createSuccessResponse({ message: "Comment deleted successfully" });
  },
  { errorMessage: "Failed to delete comment" }
);

export function GET() {
  return methodNotAllowed(["DELETE"]);
}
