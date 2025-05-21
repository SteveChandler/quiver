export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSurfForecast } from "./utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beach = searchParams.get("beach");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    console.log("API request params:", { beach, lat, lng });

    // Validate input
    if (!beach && (!lat || !lng)) {
      return NextResponse.json(
        { error: "Either beach name or lat/lng coordinates required" },
        { status: 400 }
      );
    }

    // Prepare parameters for getSurfForecast
    const params = beach
      ? { beach }
      : { coords: { lat: parseFloat(lat!), lng: parseFloat(lng!) } };

    // Get forecast data
    let forecastData = await getSurfForecast(params);

    console.log("Raw API response:", JSON.stringify(forecastData, null, 2));

    // Normalize the forecast data structure
    if (Array.isArray(forecastData.forecast)) {
      // If it's an array but empty, use default forecast
      if (forecastData.forecast.length === 0) {
        forecastData.forecast = createDefaultForecast();
      } else {
        // Use the first item in the array
        forecastData.forecast = forecastData.forecast[0];
      }
    } else if (
      !forecastData.forecast ||
      typeof forecastData.forecast !== "object"
    ) {
      // If forecast is missing or not an object, use default
      forecastData.forecast = createDefaultForecast();
    }

    console.log(
      "Normalized API response:",
      JSON.stringify(forecastData, null, 2)
    );

    return NextResponse.json(forecastData);
  } catch (error) {
    console.error("Surf forecast error:", error);

    // Return a valid response even in case of error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Create a default response with the error message
    const fallbackResponse = {
      beach: "Unknown Beach",
      coords: { lat: 32.7507, lng: -117.254 }, // Ocean Beach coordinates
      forecast: createDefaultForecast(),
      error: errorMessage,
    };

    return NextResponse.json(fallbackResponse, { status: 500 });
  }
}

// Helper function to create default forecast data
function createDefaultForecast() {
  return {
    wave_height: "2-3 ft",
    water_temp: "68°F",
    wind_speed: "5 mph",
    wind_direction: "SW",
    tide: "Mid",
    weather_condition: "Sunny",
    forecast_date: new Date().toISOString().split("T")[0],
    forecast_time: new Date().toTimeString().split(" ")[0].substring(0, 8),
  };
}
