import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-utils";
import {
  updateBeachForecast,
  updateAllBeachForecasts,
} from "@/lib/utils/forecast-server-utils";
import { getStalenessDetails, getLatestUpdatedAt } from "@/lib/utils/forecast-client-utils";
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

    // PERFORMANCE OPTIMIZATION: Always return cached data immediately
    // Never block page load on forecast generation (moved to background job)
    let data = (await fetchBeachForecasts(beachId, days)) || { forecasts: [] };

    // Check if data is stale or missing using source-specific thresholds
    const hasData = data.forecasts && data.forecasts.length > 0;
    let isStale = false;
    let dataAge = "unknown";
    let dataSource = "UNKNOWN";
    let stalenessThreshold = 6;
    let lastUpdated: string | null = null;

    if (hasData) {
      /**
       * Get accurate freshness timestamp using max(updated_at) from forecasts.
       *
       * The forecasts array includes lookback days (yesterday's data for tide charts)
       * and is sorted by forecast_date ASC, so forecasts[0] is the OLDEST row,
       * not the most recently written. getLatestUpdatedAt() finds the true latest.
       */
      lastUpdated = getLatestUpdatedAt(data.forecasts);
      dataSource = data.forecasts[0]?.data_source || "FALLBACK";

      if (lastUpdated) {
        // Use source-specific staleness check with the CORRECT timestamp
        const stalenessInfo = getStalenessDetails(lastUpdated, dataSource);
        isStale = stalenessInfo.isStale;
        stalenessThreshold = stalenessInfo.threshold;

        // Calculate age for logging
        const ageHours = Math.floor(stalenessInfo.hoursSinceUpdate);
        dataAge = `${ageHours}h old`;

        // Enhanced logging with staleness details
        console.log(`📊 Forecast data for beach ${beachId}:`, {
          dataSource,
          lastUpdated,
          hoursSinceUpdate: stalenessInfo.hoursSinceUpdate.toFixed(2),
          threshold: stalenessThreshold,
          isStale,
          reason: stalenessInfo.reason,
        });
      }
    }

    // Log data status but DO NOT generate forecasts on page load
    if (!hasData) {
      console.log(
        `⚠️ No cached forecasts for beach ${beachId}. Should be pre-generated by background job.`
      );
    } else if (isStale) {
      console.log(
        `ℹ️ Returning cached forecasts for beach ${beachId} (${dataAge}, threshold: ${stalenessThreshold}h for ${dataSource}). Background job should refresh.`
      );
    } else {
      console.log(
        `✅ Using fresh cached data for beach ${beachId} (${dataAge}, ${data.forecasts.length} forecasts, ${dataSource})`
      );
    }

    // PERFORMANCE OPTIMIZATION: Add Cache-Control headers
    // Cache for 10 minutes (600s) with stale-while-revalidate for 1 hour
    // This allows browsers/CDN to serve cached data while fetching fresh data in background
    const response = createSuccessResponse({
      beachId,
      days,
      ...data,
      // Include metadata for debugging/transparency
      // IMPORTANT: lastUpdated comes from v_enhanced_forecast_latest view (or max updated_at),
      // NOT from forecasts[0] which may be an older lookback row
      metadata: hasData ? {
        dataSource,
        lastUpdated: lastUpdated || data.forecasts[0]?.updated_at,
        isStale,
        stalenessThreshold,
        dataAge
      } : undefined
    });

    // Add caching headers
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=3600"
    );

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
