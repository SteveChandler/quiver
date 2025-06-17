import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  createForecastUpdateResponse,
  validateCronAuth,
} from "@/lib/api-response-utils";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-service-utils";

/**
 * Smart Forecast Update Cron Job
 *
 * This endpoint is designed to be called by a cron service to update forecasts
 * using the enhanced forecast system with NOAA data sources.
 *
 * Usage: POST /api/cron/smart-forecast-update
 *
 * Expected to be called:
 * - Every 6 hours for routine updates
 * - Can be called manually for immediate updates
 */

export async function POST(request: NextRequest) {
  console.log("🚀 Starting smart forecast update cron job");

  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get("authorization");

    if (!validateCronAuth(authHeader)) {
      console.error("❌ Unauthorized cron request");
      return createErrorResponse("Unauthorized", null, 401);
    }

    console.log("📊 Starting enhanced forecast update for all beaches");
    const startTime = Date.now();

    // Update all enhanced forecasts
    const result = await updateAllBeachForecasts();

    const duration = Date.now() - startTime;

    console.log("✅ Smart forecast update completed successfully");
    console.log(`📈 Total beaches: ${result.results?.length || 0}`);
    console.log(`⏱️ Duration: ${duration}ms`);

    // Log any failures for debugging
    const failures = result.results?.filter((r) => !r.success) || [];
    if (failures.length > 0) {
      console.log("Failed beach updates:", failures);
    }

    return createForecastUpdateResponse(
      result.results || [],
      "Enhanced forecast update completed",
      startTime
    );
  } catch (error) {
    console.error("❌ Cron job failed:", error);
    return createErrorResponse(
      "Cron job failed",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Also support GET for manual testing
export async function GET() {
  return NextResponse.json({
    message: "Smart forecast update cron job endpoint",
    usage: "POST to this endpoint to trigger forecast updates",
    dataSource:
      "Enhanced forecast system using NOAA WaveWatch III, CO-OPS, Weather Service, and NDBC buoys",
    timestamp: new Date().toISOString(),
  });
}
