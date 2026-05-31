import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  handleApiError,
  createSuccessResponse,
  createValidationError,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import { normalizeCoordinates } from "@/lib/types/coordinates";

export const dynamic = "force-dynamic";

// Matches Ruby BuoysController functionality
async function nearbyBuoysHandler(request: NextRequest) {
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
    { context: "GET /api/buoys/nearby" }
  );
  const limit = parseInt(searchParams.get("limit") || "4");
  const maxDistance = parseInt(searchParams.get("maxDistance") || "100000"); // meters, matches Ruby 100_000

  if (!coords) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Use PostGIS spatial query for proper distance-based sorting
    console.log(
      "Using spatial query for buoys near lat/lon:",
      coords.lat,
      coords.lon
    );

    const { data: buoys, error } = await supabase
      .rpc("get_nearby_buoys", {
        target_lat: coords.lat,
        target_lng: coords.lon,
        max_distance_m: maxDistance,
        result_limit: limit
      });

    if (error) {
      console.error("Database error:", error);
      // Return empty list when buoys table not present (new schema)
      return createSuccessResponse([]);
    }

    // Transform to match expected API format
    const buoysJson = (buoys || []).map((buoy: any) => ({
      id: buoy.buoy_uuid,
      latitude: buoy.coordinates ? parseFloat(buoy.coordinates.coordinates[1]) : 0,
      longitude: buoy.coordinates ? parseFloat(buoy.coordinates.coordinates[0]) : 0,
      name: buoy.buoy_name || buoy.buoy_uuid || "Unknown Buoy",
      distance_meters: buoy.distance_meters,
      measurements: {
        air_temperature: buoy.air_temperature,
        water_temperature: buoy.water_temperature,
        wave_period: buoy.wave_period,
        wave_height: buoy.wave_height,
        wind_speed: buoy.wind_speed,
        wind_gust: buoy.wind_gust,
        wind_direction: buoy.wind_direction,
        tides: buoy.tides,
        updated_at: buoy.updated_at
          ? new Date(buoy.updated_at).getTime() / 1000
          : null,
      },
    }));

    console.log(`Found ${buoysJson.length} buoys for API response`);
    return createSuccessResponse(buoysJson);
  } catch (error) {
    console.error("API error:", error);
    return handleApiError(error, "Error fetching nearby buoys");
  }
}

// Apply bot blocking and rate limiting protection
export const GET = withBotBlockingAndRateLimit(nearbyBuoysHandler, "public-default");
