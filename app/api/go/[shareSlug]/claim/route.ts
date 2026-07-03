import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  methodNotAllowed,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { surfDropErrorResponse, withNoStore } from "@/lib/surf-drops/http";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { claimSurfDropLink } from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

const SHARE_SLUG_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/;

export const POST = withRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      { user, params }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      try {
        const shareSlug = params.shareSlug;
        if (!SHARE_SLUG_REGEX.test(shareSlug)) {
          return createValidationError("Invalid share slug");
        }

        const repository = createSurfDropsRepository(
          createSupabaseServiceRoleClient(),
        );
        const result = await claimSurfDropLink(repository, {
          shareSlug,
          userId: user.id,
        });

        return withNoStore(createSuccessResponse(result));
      } catch (error) {
        const response = surfDropErrorResponse(error);
        if (response) return response;
        throw error;
      }
    },
    { errorMessage: "Failed to claim Surf Drop link" },
  ),
  { key: "authenticated-default" },
);

export function GET(): NextResponse {
  return methodNotAllowed(["POST"]);
}
