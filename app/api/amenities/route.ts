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

function parseTypes(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean);
}

async function amenitiesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const bbox = parseBboxParam(request.nextUrl.searchParams.get("bbox"));
    const types = parseTypes(request.nextUrl.searchParams.get("types"));
    const repository = createSurfDropsRepository(await createSupabaseServerClient());
    const amenities = await repository.listAmenities?.(bbox, types);

    return createSuccessResponse({
      amenities: (amenities ?? []).map((amenity) => ({
        id: amenity.id,
        type: amenity.amenity_type,
        lat: amenity.lat,
        lon: amenity.lon,
        source: amenity.source,
        source_ref: amenity.source_ref,
        confidence: amenity.confidence,
        label: amenity.label,
        verified_at: amenity.verified_at,
        imported_at: amenity.imported_at,
      })),
    });
  } catch (error) {
    return createValidationError(error instanceof Error ? error.message : "Invalid amenities query");
  }
}

export const GET = withBotBlockingAndRateLimit(
  amenitiesHandler,
  { key: "public-default" },
);
