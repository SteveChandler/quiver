import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  methodNotAllowed,
  validateUuidParam,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { withNoStore, surfDropErrorResponse } from "@/lib/surf-drops/http";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { cancelSurfDrop } from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

export const POST = withRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      { user, supabase, params }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      try {
        const idResult = validateUuidParam(params.id, "Surf Drop");
        if ("error" in idResult) return idResult.error;

        const repository = createSurfDropsRepository(supabase);
        const result = await cancelSurfDrop(repository, {
          dropId: idResult.value,
          userId: user.id,
        });
        return withNoStore(createSuccessResponse(result));
      } catch (error) {
        const response = surfDropErrorResponse(error);
        if (response) return response;
        throw error;
      }
    },
    { errorMessage: "Failed to cancel Surf Drop" },
  ),
  { key: "authenticated-default" },
);

export function GET(): NextResponse {
  return methodNotAllowed(["POST"]);
}
