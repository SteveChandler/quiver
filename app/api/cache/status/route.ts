import { NextResponse } from "next/server";
import {
  getCacheStatus,
  getCachedClusterForecast,
  PACIFIC_BEACH_CLUSTER,
} from "@/lib/beach-cluster-cache";

/**
 * Cache Status Endpoint
 *
 * GET /api/cache/status
 *
 * Returns information about the Pacific Beach cluster cache
 */
export async function GET() {
  try {
    const cacheStatus = getCacheStatus();
    const cachedData = getCachedClusterForecast();

    return NextResponse.json({
      success: true,
      cluster: PACIFIC_BEACH_CLUSTER,
      cache: {
        ...cacheStatus,
        forecastCount: cachedData?.forecasts.length || 0,
        lastUpdate: cachedData?.timestamp
          ? new Date(cachedData.timestamp).toISOString()
          : null,
        sourceBeachId: cachedData?.sourceBeach.id || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";
