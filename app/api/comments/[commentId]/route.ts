import { NextRequest } from "next/server";
import { createValidationError, isValidUuid } from "@/lib/api-utils";
import {
  withAuth,
  createSuccessResponse,
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

    const { error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    return createSuccessResponse({ message: "Comment deleted successfully" });
  },
  { errorMessage: "Failed to delete comment" }
);

export function GET() {
  return methodNotAllowed(["DELETE"]);
}
