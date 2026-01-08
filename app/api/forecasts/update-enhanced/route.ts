import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-utils";
import {
  updateBeachForecast,
  updateAllBeachForecasts,
  getFreshForecastFromCache,
} from "@/lib/utils/forecast-server-utils";
import { authenticateAdmin } from "@/lib/auth/admin";

/**
 * Enhanced Forecast Update API Endpoint
 *
 * SECURITY: POST requires admin authentication
 * GET is public (read-only forecast data)
 */

// API endpoint to update enhanced forecasts for all beaches (admin only)
export async function POST(request: NextRequest) {
  try {
    // Admin authentication check - only admins can trigger forecast updates
    const authResult = await authenticateAdmin();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    console.log(`🔐 Enhanced forecast update initiated by admin: ${authResult.user.email}`);

    console.log("Starting enhanced forecast update process");

    // Check if we should update a specific beach or all beaches
    const { beachId } = await request.json().catch(() => ({ beachId: null }));

    if (beachId) {
      // Update a specific beach
      console.log(`Updating enhanced forecasts for beach: ${beachId}`);

      const data = await updateBeachForecast(beachId);

      return createSuccessResponse({
        message: "Beach forecast update completed",
        beach: data.beach,
        forecastsCount: data.forecastsGenerated,
      });
    } else {
      // Update all beaches
      const result = await updateAllBeachForecasts();

      const successful = result.results?.filter((r) => r.success).length || 0;
      const failed = (result.results?.length || 0) - successful;

      return createSuccessResponse({
        total: result.results?.length || 0,
        successful,
        failed,
        results: result.results || [],
        message: "Enhanced forecasts update complete",
      });
    }
  } catch (error) {
    console.error("❌ Error updating enhanced forecasts:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
      cause: error instanceof Error ? error.cause : undefined,
    });
    return createErrorResponse(
      "Failed to update enhanced forecasts",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * API endpoint to get enhanced forecasts for a beach
 * 
 * NEVER SERVE STALE: Uses getFreshForecastFromCache() as single source of truth.
 * Returns empty forecasts + metadata when data is stale/missing.
 */
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

    // Use getFreshForecastFromCache as single source of truth for staleness gating.
    // This function:
    // - Uses v_enhanced_forecast_latest (not forecasts[0]) for accurate freshness
    // - Never returns stale rows
    // - Returns empty + metadata when stale/missing
    const windowHours = days * 24;
    const result = await getFreshForecastFromCache(beachId, windowHours);

    const { forecasts, metadata } = result;
    const hasData = forecasts.length > 0;

    // Build response with consistent shape
    const responseData = {
      beachId,
      days,
      forecasts,
      metadata: {
        cached: metadata.cached,
        stale: metadata.stale,
        missing: metadata.missing,
        reason: metadata.reason,
        dataSource: metadata.stalenessDetails ? 
          (metadata.stale ? "UNKNOWN" : forecasts[0]?.data_source || "FALLBACK") : 
          undefined,
        lastUpdated: metadata.stalenessDetails ? 
          new Date(Date.now() - metadata.stalenessDetails.hoursSinceUpdate * 60 * 60 * 1000).toISOString() : 
          undefined,
        stalenessThreshold: metadata.stalenessDetails?.threshold,
        dataAge: metadata.stalenessDetails ? 
          `${Math.floor(metadata.stalenessDetails.hoursSinceUpdate)}h old` : 
          undefined,
      },
    };

    const response = createSuccessResponse(responseData);

    // Cache headers: only cache if we have fresh data
    if (hasData && !metadata.stale) {
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=600, stale-while-revalidate=3600"
      );
    } else {
      // Don't cache stale/missing responses
      response.headers.set("Cache-Control", "no-store");
    }

    return response;
  } catch (error) {
    console.error("❌ Error fetching enhanced forecasts:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
      cause: error instanceof Error ? error.cause : undefined,
    });
    return createErrorResponse(
      "Failed to fetch enhanced forecasts",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
