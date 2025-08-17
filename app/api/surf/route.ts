// Note: Avoid exporting module-level constants in some environments that treat
// API modules as "use server" files and enforce function-only exports.

import { NextRequest, NextResponse } from "next/server";
import { getSurfForecast } from "./utils";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const beach = searchParams.get("beach");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    console.log("API request params:", { beach, lat, lng });

    // Validate input
    if (!beach && (!lat || !lng)) {
      return createValidationError("Either beach name or lat/lng coordinates required");
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
