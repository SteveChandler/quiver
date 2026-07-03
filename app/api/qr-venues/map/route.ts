import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { parseBboxParam } from "@/lib/surf-drops/validation";

export const dynamic = "force-dynamic";

async function qrVenuesMapHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const bbox = parseBboxParam(request.nextUrl.searchParams.get("bbox"));
    const repository = createSurfDropsRepository(await createSupabaseServerClient());
    const venues = await repository.listQrVenues?.(bbox);

    return createSuccessResponse({
      venues: (venues ?? []).map((venue) => ({
        id: venue.id,
        name: venue.name,
        lat: venue.lat,
        lon: venue.lon,
        activated_at: venue.activated_at,
        admin_visible: venue.admin_visible,
      })),
    });
  } catch (error) {
    return createValidationError(error instanceof Error ? error.message : "Invalid QR venue query");
  }
}

export const GET = withBotBlockingAndRateLimit(
  qrVenuesMapHandler,
  { key: "public-default" },
);
