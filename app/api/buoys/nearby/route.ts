import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  handleApiError,
  createSuccessResponse,
  createValidationError,
} from "@/lib/api-utils";

// Matches Ruby BuoysController functionality
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const limit = parseInt(searchParams.get("limit") || "4");
  const maxDistance = parseInt(searchParams.get("maxDistance") || "100000"); // meters, matches Ruby 100_000

  if (!latitude || !longitude) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Use PostGIS spatial query for proper distance-based sorting
    console.log("Using spatial query for buoys near lat/lng:", latitude, longitude);

    const { data: buoys, error } = await supabase
      .rpc("get_nearby_buoys", {
        target_lat: latitude,
        target_lng: longitude,
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
