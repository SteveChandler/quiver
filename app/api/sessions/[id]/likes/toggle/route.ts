import { NextRequest } from "next/server";
import { withAuth, createSuccessResponse, validateUuidParam, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
import { toggleSessionLike } from "@/actions/like-actions";

export const POST = withAuth(
  async (_request: NextRequest, { params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "session");
    if ("error" in uuidResult) return uuidResult.error;

    const result = await toggleSessionLike(uuidResult.value);
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle like");
    }

    return createSuccessResponse(result);
  },
  { errorMessage: "Failed to toggle like" }
);


