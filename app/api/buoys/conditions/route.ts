import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  handleApiError,
  createSuccessResponse,
  createValidationError,
} from "@/lib/api-utils";
import { getWindDirectionName } from "@/lib/utils/wind-direction";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";
import { normalizeCoordinates } from "@/lib/types/coordinates";

export const dynamic = "force-dynamic";

// Matches Ruby BuoysController#conditions functionality
async function conditionsHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coords = normalizeCoordinates(
    {
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
      lng: searchParams.get("lng"),
      latitude: searchParams.get("latitude"),
      longitude: searchParams.get("longitude"),
    },
    { context: "GET /api/buoys/conditions" }
  );
  const limit = parseInt(searchParams.get("limit") || "50"); // matches Ruby default of 50

  if (!coords) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Use spatial query to find nearest buoy with conditions
    console.log(
      "Using spatial query for buoy conditions near lat/lon:",
      coords.lat,
      coords.lon
    );

    const { data: buoys, error } = await supabase
      .rpc("get_nearest_buoy_with_conditions", {
        target_lat: coords.lat,
        target_lng: coords.lon,
        max_distance_m: 100000 // 100km radius
      });

    if (error) {
      console.error("Database error:", error);
      // Graceful fallback when buoys table not present
      return createSuccessResponse({
        id: "mock",
        latitude: coords.lat,
        longitude: coords.lon,
        name: "No Buoy Available",
        measurements: { updated_at: null },
      });
    }

    if (!buoys || buoys.length === 0) {
      return NextResponse.json(
        { error: "No active buoy found for location" },
        { status: 404 }
      );
    }

    const buoy = buoys[0];

    // Transform to match Ruby controller JSON format
    const buoyJson = {
      id: buoy.buoy_uuid,
      latitude: buoy.coordinates ? (buoy.coordinates as { coordinates: number[] }).coordinates[1] : 0,
      longitude: buoy.coordinates ? (buoy.coordinates as { coordinates: number[] }).coordinates[0] : 0,
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
        wind_direction_name: buoy.wind_direction
          ? getWindDirectionName(buoy.wind_direction)
          : null,
        tides: buoy.tides,
        updated_at: buoy.updated_at
          ? new Date(buoy.updated_at).getTime() / 1000
          : null,
      },
    };

    console.log(`Found buoy conditions for: ${buoy.buoy_uuid}`);
    return createSuccessResponse(buoyJson);
  } catch (error) {
    console.error("API error:", error);
    return handleApiError(error, "Error fetching buoy conditions");
  }
}

// Apply bot blocking and rate limiting protection
export const GET = withBotBlockingAndRateLimit(conditionsHandler, "public-default");

// Wind direction helper moved to utility function
