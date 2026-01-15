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
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { EnhancedForecastEntity } from "@/types/forecast";

/** Conversion factor: meters to feet */
const METERS_TO_FEET = 3.28084;

/**
 * Merge ML bias corrections into forecast entities
 *
 * Fetches ML corrections from corrected_forecasts table and
 * adds ml_corrected_height, is_ml_calibrated, ml_model_version
 * to matching forecast objects.
 */
async function mergeMLCorrections(
  forecasts: EnhancedForecastEntity[],
  beachId: string
): Promise<EnhancedForecastEntity[]> {
  if (forecasts.length === 0) return forecasts;

  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Get date range from forecasts (convert to timestamps for corrected_forecasts query)
    const dates = forecasts.map(f => f.forecast_date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    // corrected_forecasts uses forecast_ts (timestamp) not separate date/time columns
    const minTs = `${minDate}T00:00:00Z`;
    const maxTs = `${maxDate}T23:59:59Z`;

    // Fetch ML corrections for this beach and date range
    const { data: corrections, error } = await supabase
      .from("corrected_forecasts")
      .select("forecast_ts, corrected_height_m, model_version")
      .eq("beach_id", beachId)
      .gte("forecast_ts", minTs)
      .lte("forecast_ts", maxTs);

    if (error) {
      console.warn(`⚠️ Failed to fetch ML corrections for beach ${beachId}:`, error.message);
      return forecasts; // Return original forecasts without ML data
    }

    if (!corrections || corrections.length === 0) {
      return forecasts; // No ML corrections available
    }

    // Build lookup map for O(1) access
    // Key format: "YYYY-MM-DD|HH:00" to match enhanced_forecasts format
    const correctionMap = new Map<string, { corrected_height_m: number; model_version: string }>();
    corrections.forEach((c) => {
      const ts = new Date(c.forecast_ts);
      const date = ts.toISOString().split("T")[0];
      const hours = ts.getUTCHours().toString().padStart(2, "0");
      const key = `${date}|${hours}:00`;
      correctionMap.set(key, {
        corrected_height_m: c.corrected_height_m,
        model_version: c.model_version,
      });
    });

    // Merge corrections into forecasts
    return forecasts.map((forecast) => {
      const key = `${forecast.forecast_date}|${forecast.forecast_time}`;
      const correction = correctionMap.get(key);

      if (correction) {
        // Convert corrected_height from meters to feet and format
        const correctedFeet = correction.corrected_height_m * METERS_TO_FEET;
        return {
          ...forecast,
          ml_corrected_height: `${correctedFeet.toFixed(1)} ft`,
          is_ml_calibrated: true,
          ml_model_version: correction.model_version,
        };
      }

      return forecast;
    });
  } catch (error) {
    console.warn(`⚠️ Error merging ML corrections:`, error);
    return forecasts; // Return original forecasts on error
  }
}

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

    const { metadata } = result;

    // Merge ML bias corrections into forecasts
    // This adds ml_corrected_height, is_ml_calibrated, ml_model_version
    // to forecasts that have ML corrections available
    const forecasts = await mergeMLCorrections(result.forecasts, beachId);
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
