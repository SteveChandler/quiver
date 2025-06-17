import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  createForecastUpdateResponse,
} from "@/lib/api-response-utils";
import {
  updateBeachForecast,
  updateAllBeachForecasts,
} from "@/lib/utils/forecast-service-utils";

// API endpoint to update enhanced forecasts for all beaches
export async function POST(request: NextRequest) {
  try {
    console.log("Starting enhanced forecast update process");

    // Check if we should update a specific beach or all beaches
    const { beachId } = await request.json().catch(() => ({ beachId: null }));

    if (beachId) {
      // Update a specific beach
      console.log(`Updating enhanced forecasts for beach: ${beachId}`);

      const data = await updateBeachForecast(beachId);

      return createSuccessResponse(
        {
          message: `Enhanced forecasts updated for ${data.beach}`,
          forecastsCount: data.forecastsGenerated,
        },
        "Beach forecast update completed"
      );
    } else {
      // Update all beaches
      const result = await updateAllBeachForecasts();

      return createForecastUpdateResponse(
        result.results || [],
        "Enhanced forecasts update complete"
      );
    }
  } catch (error) {
    console.error("Error updating enhanced forecasts:", error);
    return createErrorResponse(
      "Failed to update enhanced forecasts",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// API endpoint to get enhanced forecasts for a beach
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");
    const days = parseInt(searchParams.get("days") || "10");

    if (!beachId) {
      return createErrorResponse("Beach ID is required", null, 400);
    }

    const { fetchBeachForecasts } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const data = await fetchBeachForecasts(beachId, days);

    return createSuccessResponse({
      beachId,
      days,
      ...data,
    });
  } catch (error) {
    console.error("Error fetching enhanced forecasts:", error);
    return createErrorResponse(
      "Failed to fetch enhanced forecasts",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
