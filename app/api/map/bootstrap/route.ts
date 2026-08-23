import { NextRequest } from "next/server";
import { bulkForecastHandler } from "@/app/api/forecasts/bulk/route";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
  withAuth,
  withNoStore,
  withRateLimit,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import {
  getCachedNearbyBeachesFromDb,
  normalizeNearbyBeachQuery,
} from "@/lib/services/nearby-beach-service";
import { normalizeCoordinates } from "@/lib/types/coordinates";

export const dynamic = "force-dynamic";

async function mapBootstrapHandler(
  request: NextRequest,
  context: OptionalAuthContext,
) {
  const { searchParams } = request.nextUrl;
  const coords = normalizeCoordinates(
    {
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon") ?? searchParams.get("lng"),
      latitude: searchParams.get("latitude"),
      longitude: searchParams.get("longitude"),
    },
    { context: "GET /api/map/bootstrap" },
  );

  if (!coords) {
    return createValidationError("Latitude and longitude are required");
  }

  const query = normalizeNearbyBeachQuery(
    Number(searchParams.get("maxDistance") ?? 30),
    Number(searchParams.get("limit") ?? 20),
  );

  try {
    const nearbyResult = await getCachedNearbyBeachesFromDb(
      coords.lat,
      coords.lon,
      query.radiusMiles,
      query.limit,
    );
    if (!nearbyResult.success) {
      throw new Error(nearbyResult.error || "Nearby beach query failed");
    }

    const beaches = nearbyResult.data ?? [];
    const beachIds = beaches
      .map((beach) => beach.id)
      .filter((beachId): beachId is string => Boolean(beachId));
    if (beachIds.length === 0) {
      return createSuccessResponse({ beaches, forecast: null });
    }

    const forecastUrl = new URL("/api/forecasts/bulk", request.url);
    forecastUrl.searchParams.set("beachIds", beachIds.join(","));
    const forecastRequest = new NextRequest(forecastUrl, {
      headers: request.headers,
    });
    const forecastResponse = await bulkForecastHandler(forecastRequest, context);
    const forecast = forecastResponse.ok ? await forecastResponse.json() : null;

    return createSuccessResponse({ beaches, forecast });
  } catch (error) {
    console.error("Error bootstrapping map:", error);
    return handleApiError(error, "Error bootstrapping map");
  }
}

export const GET = withNoStore(
  withRateLimit(
    withAuth(mapBootstrapHandler, {
      optional: true,
      errorMessage: "Error bootstrapping map",
    }),
    "public-default",
  ),
);
