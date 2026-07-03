import type { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  methodNotAllowed,
  validateUuidParam,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withNoStore, surfDropErrorResponse } from "@/lib/surf-drops/http";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import {
  claimSurfDropLink,
  joinSurfDrop,
  leaveSurfDrop,
} from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

async function readOptionalJson(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) return {};

  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const POST = withRateLimit(
  withAuth(
    async (
      request: NextRequest,
      { user, supabase, params }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      try {
        const idResult = validateUuidParam(params.id, "Surf Drop");
        if ("error" in idResult) return idResult.error;

        const body = await readOptionalJson(request);
        if (typeof body.share_slug === "string" && body.share_slug.length > 0) {
          const serviceRepository = createSurfDropsRepository(
            createSupabaseServiceRoleClient(),
          );
          const claim = await claimSurfDropLink(serviceRepository, {
            shareSlug: body.share_slug,
            userId: user.id,
          });
          if (claim.drop_id !== idResult.value) {
            return withNoStore(
              createErrorResponse("Share link does not match Surf Drop", undefined, 400),
            );
          }
        }

        const repository = createSurfDropsRepository(supabase);
        const result = await joinSurfDrop(repository, {
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
    { errorMessage: "Failed to join Surf Drop" },
  ),
  { key: "authenticated-default" },
);

export const DELETE = withRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      { user, supabase, params }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      try {
        const idResult = validateUuidParam(params.id, "Surf Drop");
        if ("error" in idResult) return idResult.error;

        const repository = createSurfDropsRepository(supabase);
        const result = await leaveSurfDrop(repository, {
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
    { errorMessage: "Failed to leave Surf Drop" },
  ),
  { key: "authenticated-default" },
);

export function GET(): NextResponse {
  return methodNotAllowed(["POST", "DELETE"]);
}
