import { NextRequest, NextResponse } from "next/server";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-service-utils";

/**
 * Cron job endpoint to refresh all beach forecasts in the background
 *
 * This should be called every 6 hours to keep forecast data fresh.
 * Configure in vercel.json or use Vercel Cron Jobs.
 *
 * Security: Verifiable via Authorization header or Vercel's cron secret
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("⚠️ Unauthorized cron request attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🔄 Starting background forecast refresh cron job...");
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
