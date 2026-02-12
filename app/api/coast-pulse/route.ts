import { NextRequest, NextResponse } from "next/server";
import {
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { normalizeCoordinates } from "@/lib/types/coordinates";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { PAGINATION } from "@/lib/constants/coast-pulse";
import { generateCoastPulse } from "@/lib/services/coast-pulse/coast-pulse-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/coast-pulse
 *
 * Aggregates live surf conditions from multiple sources:
 * - Local buoys (cached NOAA data from our database)
 * - NDBC real-time observations
 * - Enhanced forecasts
 * - User intel reports
 *
 * Query params:
 * - lat: Latitude (required)
 * - lon: Longitude (required)
 * - limit: Max items to return (default: 8, max: 15)
 * - before: ISO timestamp cursor for pagination (optional)
 */
async function coastPulseHandler(request: NextRequest) {
  try {
    // Parse and validate coordinates
    const searchParams = request.nextUrl.searchParams;
    const coords = normalizeCoordinates({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
    });

    if (!coords) {
      return createValidationError("Invalid or missing lat/lon parameters");
    }

    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || String(PAGINATION.DEFAULT_LIMIT)), 1),
      PAGINATION.MAX_LIMIT
    );
    const before = searchParams.get("before") || undefined;

    // Validate before cursor is a valid ISO timestamp
    if (before) {
      const parsedDate = new Date(before);
      if (isNaN(parsedDate.getTime())) {
        return createValidationError("Invalid 'before' cursor: must be a valid ISO timestamp");
      }
    }

    const data = await generateCoastPulse({ lat: coords.lat, lon: coords.lon, limit, before });

    // Return with cache headers for CDN
    return NextResponse.json(
      { success: true, data, timestamp: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": before
            ? "private, no-cache"
            : "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Coast pulse error:", error);
    return handleApiError(error);
  }
}

// Apply rate limiting protection
export const GET = withRateLimit(coastPulseHandler, "public-default");
