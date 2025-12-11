import { NextRequest, NextResponse } from "next/server";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";
import { validateCronRequest } from "@/lib/api-response-utils";

// Allow up to 5 minutes for the cron job to complete (Pro plan limit)
export const maxDuration = 300;

/**
 * Cron job endpoint to refresh all beach forecasts in the background
 *
 * This should be called every 6 hours to keep forecast data fresh.
 * Configure in vercel.json or use Vercel Cron Jobs.
 *
 * Security: Verifiable via Authorization header, Vercel's cron secret, or x-vercel-cron header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request (supports multiple auth methods)
    if (!validateCronRequest(request)) {
      console.warn("⚠️ Unauthorized cron request attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🔄 Starting background forecast refresh cron job... (v2 with prefetch+batching)");
    const startTime = Date.now();

    // Update all beach forecasts
    const result = await updateAllBeachForecasts();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Forecast refresh cron completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      message: "Forecast refresh completed",
      duration: `${duration}s`,
      results: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in forecast refresh cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
