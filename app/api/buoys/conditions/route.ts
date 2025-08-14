import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  handleApiError,
  createSuccessResponse,
  createValidationError,
} from "@/lib/api-utils";
import { getWindDirectionName } from "@/lib/utils/wind-direction";

// Matches Ruby BuoysController#conditions functionality
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const limit = parseInt(searchParams.get("limit") || "50"); // matches Ruby default of 50

  if (!latitude || !longitude) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Use spatial query to find nearest buoy with conditions
    console.log(
      "Using spatial query for buoy conditions near lat/lng:",
      latitude,
      longitude
    );

    const { data: buoys, error } = await supabase
      .rpc("get_nearest_buoy_with_conditions", {
        target_lat: latitude,
        target_lng: longitude,
        max_distance_m: 100000 // 100km radius
      });

    if (error) {
      console.error("Database error:", error);
      // Graceful fallback when buoys table not present
      return createSuccessResponse({
        id: "mock",
        latitude: latitude,
        longitude: longitude,
        name: "No Buoy Available",
        measurements: { updated_at: null },
      });
    }

    if (!buoys) {
      return NextResponse.json(
        { error: "No active buoy found for location" },
        { status: 404 }
      );
    }

    const buoy = buoys;

    // Transform to match Ruby controller JSON format
    const buoyJson = {
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

// Wind direction helper moved to utility function
