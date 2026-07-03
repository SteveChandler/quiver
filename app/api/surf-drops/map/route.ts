import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import {
  buildAccessibleMapDropPayloads,
} from "@/lib/surf-drops/service";
import { parseBboxParam } from "@/lib/surf-drops/validation";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  withAuth(
    async (
      request: NextRequest,
      { supabase, user }: AuthenticatedContext,
    ): Promise<NextResponse> => {
      try {
        const bbox = parseBboxParam(request.nextUrl.searchParams.get("bbox"));
        const repository = createSurfDropsRepository(supabase);
        const rows = await repository.listVisibleDrops?.(new Date().toISOString());
        const drops = await buildAccessibleMapDropPayloads(
          repository,
          rows ?? [],
          bbox,
          user.id,
        );
        const response = createSuccessResponse({ drops });
        response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
        return response;
      } catch (error) {
        return createValidationError(error instanceof Error ? error.message : "Invalid bbox");
      }
    },
    { errorMessage: "Failed to load Surf Drops map" },
  ),
  { key: "authenticated-default" },
);
