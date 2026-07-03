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
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { withNoStore, surfDropErrorResponse } from "@/lib/surf-drops/http";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import {
  toDropDetailPayload,
  updateSurfDrop,
} from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      { user, supabase, params }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      const idResult = validateUuidParam(params.id, "Surf Drop");
      if ("error" in idResult) return idResult.error;

      const repository = createSurfDropsRepository(supabase);
      const drop = await repository.findDropById(idResult.value);
      if (!drop) {
        return createErrorResponse("Surf Drop not found", undefined, 404);
      }

      const participants =
        await repository.listActiveParticipants?.(idResult.value);
      return withNoStore(
        createSuccessResponse(
          toDropDetailPayload(drop, {
            viewerId: user.id,
            participants: participants ?? [],
          }),
        ),
      );
    },
    { errorMessage: "Failed to load Surf Drop" },
  ),
  { key: "authenticated-default" },
);

export const PATCH = withRateLimit(
  withAuth(
    async (
      request: NextRequest,
      { user, supabase, params }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      try {
        const idResult = validateUuidParam(params.id, "Surf Drop");
        if ("error" in idResult) return idResult.error;

        const parseResult = await parseAndValidateJson(request);
        if ("error" in parseResult) return parseResult.error;

        const repository = createSurfDropsRepository(supabase);
        const drop = await updateSurfDrop(repository, {
          dropId: idResult.value,
          userId: user.id,
          patch: parseResult.data,
        });
        const participants =
          await repository.listActiveParticipants?.(idResult.value);

        return withNoStore(
          createSuccessResponse(
            toDropDetailPayload(drop, {
              viewerId: user.id,
              participants: participants ?? [],
            }),
          ),
        );
      } catch (error) {
        const response = surfDropErrorResponse(error);
        if (response) return response;
        throw error;
      }
    },
    { errorMessage: "Failed to update Surf Drop" },
  ),
  { key: "authenticated-default" },
);

export function POST(): NextResponse {
  return methodNotAllowed(["GET", "PATCH"]);
}
