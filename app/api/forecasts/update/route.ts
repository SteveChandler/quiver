import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-response-utils";
import {
  updateBeachForecast,
  updateAllBeachForecasts,
} from "@/lib/utils/forecast-service-utils";

/**
 * Forecast Update API Endpoint
 *
 * Updates forecasts using the enhanced forecast system with NOAA data sources
 *
 * Usage:
 * - POST /api/forecasts/update (updates all beaches)
 * - POST /api/forecasts/update?beachId=xyz (updates specific beach)
 */

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");

    console.log("🚀 Starting forecast update request");

    if (beachId) {
      // Update specific beach
      console.log(`📍 Updating forecasts for beach: ${beachId}`);

      const data = await updateBeachForecast(beachId);

      return createSuccessResponse(
        data,
        "Enhanced forecasts updated for beach"
      );
    } else {
      // Update all beaches
      console.log("🌊 Updating forecasts for all beaches");

      const result = await updateAllBeachForecasts();

      const successful = result.results?.filter((r) => r.success).length || 0;
      const failed = (result.results?.length || 0) - successful;

      return createSuccessResponse(
        {
          total: result.results?.length || 0,
          successful,
          failed,
          results: result.results || [],
        },
        "Enhanced forecasts updated for all beaches"
      );
    }
  } catch (error) {
    console.error("❌ Error updating forecasts:", error);

    return createErrorResponse(
      "Failed to update forecasts",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Support GET for endpoint information
export async function GET() {
  return NextResponse.json({
    message: "Enhanced Forecast Update API",
    usage: {
      "POST /api/forecasts/update": "Update all beaches",
      "POST /api/forecasts/update?beachId=xyz": "Update specific beach",
    },
    dataSource:
      "Enhanced forecast system using NOAA WaveWatch III, CO-OPS, Weather Service, and NDBC buoys",
    timestamp: new Date().toISOString(),
  });
}

// Force-dynamic route to ensure we get fresh data
export const dynamic = "force-dynamic";
