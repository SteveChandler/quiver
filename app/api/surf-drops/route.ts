import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  methodNotAllowed,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { withNoStore, surfDropErrorResponse } from "@/lib/surf-drops/http";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { createSurfDrop } from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

async function createSurfDropHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    const parseResult = await parseAndValidateJson(request);
    if ("error" in parseResult) return parseResult.error;

    const repository = createSurfDropsRepository(supabase);
    const result = await createSurfDrop(repository, user.id, parseResult.data);
    return withNoStore(createSuccessResponse(result, 201));
  } catch (error) {
    const response = surfDropErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export const POST = withRateLimit(
  withAuth(createSurfDropHandler, {
    errorMessage: "Failed to create Surf Drop",
  }),
  { key: "authenticated-default" },
);

export function GET(): NextResponse {
  return methodNotAllowed(["POST"]);
}
