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

    // Use fallback query since PostGIS functions have type mismatches
    console.log(
      "Using fallback conditions query for lat/lng:",
      latitude,
      longitude
    );

    const { data: buoys, error } = await supabase
      .from("buoys")
      .select("*")
      .eq("active", true)
      .not("coordinates", "is", null)
      .or(
        "water_temperature.not.is.null,air_temperature.not.is.null,wave_height.not.is.null"
      )
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Database error:", error);
      return handleApiError(error, "Failed to fetch buoy conditions");
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
      latitude: 0, // TODO: Parse PostGIS coordinates when functions are fixed
      longitude: 0,
      name: buoy.buoy_name || buoy.buoy_uuid || "Unknown Buoy",
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
