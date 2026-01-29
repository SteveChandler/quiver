import { NextRequest } from "next/server";
import { DELETE as deleteComment } from "@/app/api/comments/[commentId]/route";
import {
  withAuth,
  validateUuidParam,
  methodNotAllowed,
  type AuthenticatedContext
} from "@/lib/middleware/api-wrappers";

export const DELETE = withAuth(
  async (request: NextRequest, { params }: AuthenticatedContext) => {
    const sessionResult = validateUuidParam(params.id, "session");
    if ("error" in sessionResult) return sessionResult.error;

    const commentResult = validateUuidParam(params.commentId, "comment");
    if ("error" in commentResult) return commentResult.error;

    return deleteComment(request, { params: Promise.resolve({ commentId: commentResult.value }) });
  },
  { errorMessage: "Failed to delete comment" }
);

export function GET() {
  return methodNotAllowed(["DELETE"]);
}

