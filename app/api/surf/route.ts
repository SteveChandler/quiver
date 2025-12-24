// Note: Avoid exporting module-level constants in some environments that treat
// API modules as "use server" files and enforce function-only exports.

import { NextRequest, NextResponse } from "next/server";
import { getSurfForecast } from "./utils";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { normalizeCoordinates } from "@/lib/types/coordinates";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beach = searchParams.get("beach");
    const coords = normalizeCoordinates(
      {
        lat: searchParams.get("lat"),
        lon: searchParams.get("lon"),
        lng: searchParams.get("lng"),
        latitude: searchParams.get("latitude"),
        longitude: searchParams.get("longitude"),
      },
      { context: "GET /api/surf" }
    );

    console.log("API request params:", {
      beach,
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
    });

    // Validate input
    if (!beach && !coords) {
      return createValidationError(
        "Either beach name or coordinates required (lat/lon preferred; lat/lng accepted)"
      );
    }

    // Prepare parameters for getSurfForecast
    const params = beach
      ? { beach }
      : { coords: { lat: coords!.lat, lng: coords!.lon } };

    // Get forecast data
    let forecastData = await getSurfForecast(params);

    console.log("Raw API response:", JSON.stringify(forecastData, null, 2));

    // Normalize the forecast data structure
    if (Array.isArray(forecastData.forecast)) {
      // If it's an array but empty, return error
      if (forecastData.forecast.length === 0) {
        return handleApiError(
          new Error("No forecast data available"),
          "No forecast data available"
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
      return handleApiError(
        new Error("No forecast data available"),
        "No forecast data available"
      );
    }

    console.log(
      "Normalized API response:",
      JSON.stringify(forecastData, null, 2)
    );

    return createSuccessResponse(forecastData);
  } catch (error) {
    console.error("Surf forecast error:", error);
    return handleApiError(error, "Failed to fetch surf forecast");
  }
}
