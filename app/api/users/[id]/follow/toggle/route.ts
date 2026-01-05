import type { NextRequest } from "next/server";
import { toggleUserFollow } from "@/actions/social-actions";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * POST /api/users/[id]/follow/toggle - Toggle follow status for a user
 */
export const POST = withAuth(
  async (_request: NextRequest, { params }: AuthenticatedContext) => {
    // Validate UUID
    const uuidResult = validateUuidParam(params.id, "user");
    if ("error" in uuidResult) return uuidResult.error;
    const targetUserId = uuidResult.value;

    const result = await toggleUserFollow(targetUserId);
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle follow");
    }

    return createSuccessResponse(result);
  },
  { errorMessage: "Failed to toggle follow" }
);

export function GET() {
  return methodNotAllowed(["POST"]);
}
