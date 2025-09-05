import { NextRequest } from "next/server";
import { DELETE as deleteComment } from "@/app/api/comments/[commentId]/route";
import { createValidationError, methodNotAllowed, isValidUuid } from "@/lib/api-utils";

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string; commentId: string } }
) {
  const { id, commentId } = context.params;
  if (!id || !isValidUuid(id)) {
    return createValidationError("Invalid session id format");
  }
  if (!commentId || !isValidUuid(commentId)) {
    return createValidationError("Invalid comment id format");
  }
  return deleteComment(request, { params: { commentId } });
}

export function GET() {
  return methodNotAllowed(["DELETE"]);
}

