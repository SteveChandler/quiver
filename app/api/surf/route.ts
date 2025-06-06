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
      // If it's an array but empty, return error
      if (forecastData.forecast.length === 0) {
        return NextResponse.json(
          { error: "No forecast data available" },
          { status: 404 }
        );
      } else {
        // Use the first item in the array
        forecastData.forecast = forecastData.forecast[0];
      }
    } else if (
      !forecastData.forecast ||
      typeof forecastData.forecast !== "object"
    ) {
      // If forecast is missing or not an object, return error
      return NextResponse.json(
        { error: "No forecast data available" },
        { status: 404 }
      );
    }

    console.log(
      "Normalized API response:",
      JSON.stringify(forecastData, null, 2)
    );

    return NextResponse.json(forecastData);
  } catch (error) {
    console.error("Surf forecast error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
