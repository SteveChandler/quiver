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
    const rawDays = searchParams.get("days");
    let days = 10;
    if (rawDays != null) {
      const parsed = parseInt(rawDays as string, 10);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 30) {
        days = parsed;
      }
    }

    if (!beachId) {
      return createErrorResponse("Beach ID is required", null, 400);
    }

    const { fetchBeachForecasts, updateBeachForecast } = await import(
      "@/lib/utils/forecast-service-utils"
    );

    // First, try to get existing forecasts
    let data = (await fetchBeachForecasts(beachId, days)) || { forecasts: [] };

    // Check if data is stale or missing
    const hasData = data.forecasts && data.forecasts.length > 0;
    let isStale = false;

    if (hasData) {
      // Check if the most recent forecast is older than 6 hours (NOAA update cycle)
      const mostRecent = data.forecasts[0];
      const lastUpdated = new Date(mostRecent.updated_at);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      isStale = lastUpdated < sixHoursAgo;
    }

    // If no data or stale data, generate fresh forecasts
    if (!hasData || isStale) {
      console.log(
        `🔄 ${
          !hasData ? "No data found" : "Data is stale"
        } for beach ${beachId}, generating fresh forecasts from NOAA...`
      );

      // Generate fresh forecasts - fail if this doesn't work
      await updateBeachForecast(beachId);

      // Fetch the newly generated data
      data = (await fetchBeachForecasts(beachId, days)) || { forecasts: [] };

      // Verify we actually got fresh data
      if (!data.forecasts || data.forecasts.length === 0) {
        // Gracefully return empty data instead of throwing to allow clients to render placeholders
        return createSuccessResponse({
          beachId,
          days,
          forecasts: [],
        });
      }

      console.log(
        `✅ Generated ${data.forecasts.length} fresh forecasts for beach ${beachId}`
      );
    } else {
      console.log(
        `✅ Using fresh cached data for beach ${beachId} (${data.forecasts.length} forecasts)`
      );
    }

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
