import { NextRequest } from "next/server";
import { normalizeCoordinates } from "@/lib/types/coordinates";
import {
  getNearbyBeachesFromDb,
  normalizeNearbyBeachQuery,
} from "@/lib/services/nearby-beach-service";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

// Matches Ruby LocationsController functionality
async function nearbyBeachesHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const coords = normalizeCoordinates(
    {
      // preferred short form
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      // legacy short form
      lng: searchParams.get("lng"),
      // verbose form (current behavior)
      latitude: searchParams.get("latitude"),
      longitude: searchParams.get("longitude"),
    },
    { context: "GET /api/beaches/nearby" }
  );

  const query = normalizeNearbyBeachQuery(
    Number(searchParams.get("maxDistance") ?? 30),
    Number(searchParams.get("limit") ?? 20),
  );

  if (!coords) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    const result = await getNearbyBeachesFromDb(
      coords.lat,
      coords.lon,
      query.radiusMiles,
      query.limit,
    );
    if (!result.success) {
      throw new Error(result.error || "Nearby beach query failed");
    }

    return createSuccessResponse(result.data ?? []);
  } catch (error) {
    console.error("Error fetching nearby beaches:", error);
    return handleApiError(error, "Error fetching nearby beaches");
  }
}

// Apply rate limiting
export const GET = withRateLimit(nearbyBeachesHandler, "public-default");
