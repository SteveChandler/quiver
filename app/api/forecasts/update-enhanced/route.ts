import { NextRequest } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  withAuth,
  withAdminAuth,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import {
  updateBeachForecast,
  updateAllBeachForecasts,
  getFreshForecastFromCache,
} from "@/lib/utils/forecast-server-utils";
import { createPublicReadClient } from "@/lib/supabase/server";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import { applyTrustedForecastServing } from "@/lib/services/forecast/trusted-forecast-serving";

const PRIVATE_NO_STORE = "private, no-store, no-cache, must-revalidate";

function privateNoStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return response;
}

/**
 * Enhanced Forecast Update API Endpoint
 *
 * SECURITY: POST requires admin authentication
 * GET is public (read-only forecast data)
 */

// API endpoint to update enhanced forecasts for all beaches (admin only)
export const POST = withAdminAuth(async (request: NextRequest) => {
  console.log("🔐 Enhanced forecast update initiated by admin");
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
}, { errorMessage: "Failed to update enhanced forecasts" });

/**
 * API endpoint to get enhanced forecasts for a beach
 *
 * Uses getFreshForecastFromCache() as single source of truth for forecast cache
 * freshness. Strict callers receive empty forecasts when cache is stale/missing.
 * Beach detail can opt into display-only stale rows with `allowStale=display`.
 */
async function getEnhancedForecasts(
  request: NextRequest,
  { user }: OptionalAuthContext,
) {
  try {
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");
    const rawDays = searchParams.get("days");
    const allowStaleMode = searchParams.get("allowStale");
    let days = 10;
    if (rawDays != null) {
      const parsed = parseInt(rawDays as string, 10);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 30) {
        days = parsed;
      }
    }

    if (!beachId) {
      return privateNoStore(createErrorResponse("Beach ID is required", null, 400));
    }

    // Use getFreshForecastFromCache as single source of truth for staleness gating.
    // This function:
    // - Uses v_enhanced_forecast_latest (not forecasts[0]) for accurate freshness
    // - Keeps stale rows out by default for alerts, pushes, emails, and automation
    // - Allows beach-detail display stale rows only when explicitly requested
    const windowHours = days * 24;
    const result = await getFreshForecastFromCache(
      beachId,
      windowHours,
      allowStaleMode === "display"
        ? { allowStale: true, maxStaleHours: 24 }
        : undefined
    );

    const { metadata } = result;

    // Stamp empirical shoaling calibration status onto each forecast entity.
    // We expose only the boolean — `shoaling_factors` is ~4KB of JSONB per
    // beach and the client only needs to know whether the displayed wave
    // height came from the calibrated pipeline. Errors default to `false`
    // (safer conservative render in the honesty UI). Skip the query entirely
    // when there are no forecasts to stamp.
    //
    // This is a PUBLIC GET route and `beaches.shoaling_factors` is readable
    // by the anon role via RLS. Use `createPublicReadClient` (cookie-free
    // anon) instead of the service-role client — no privilege escalation is
    // warranted for this read. If RLS ever hides `shoaling_factors` from
    // anon, fix the RLS policy; do NOT re-escalate here.
    let isCalibrated = false;
    if (result.forecasts.length > 0) {
      try {
        const beachClient = createPublicReadClient();
        const { data: beachRow, error: beachError } = await beachClient
          .from("beaches")
          .select("shoaling_factors")
          .eq("id", beachId)
          .maybeSingle();
        if (beachError) {
          console.warn(
            `⚠️ Failed to fetch calibration status for beach ${beachId}:`,
            beachError.message
          );
        } else if (beachRow) {
          isCalibrated = beachRow.shoaling_factors !== null;
        }
      } catch (err) {
        console.warn(
          `⚠️ Error fetching calibration status for beach ${beachId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    const stampedForecasts = result.forecasts.map((f) => ({ ...f, isCalibrated }));
    const displayForecasts = await applyV51DisplayOverrideToForecasts(stampedForecasts);
    const forecasts = await applyTrustedForecastServing({
      userId: user?.id ?? null,
      beachId,
      forecasts: displayForecasts,
    });
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
        displayStale: metadata.displayStale ?? false,
        reason: metadata.reason,
        dataSource: metadata.stalenessDetails
          ? metadata.stale
            ? metadata.dataSource ?? "UNKNOWN"
            : forecasts[0]?.data_source || metadata.dataSource || "FALLBACK"
          : metadata.dataSource ?? undefined,
        lastUpdated: metadata.stalenessDetails ?
          (metadata.lastUpdated ??
            new Date(Date.now() - metadata.stalenessDetails.hoursSinceUpdate * 60 * 60 * 1000).toISOString()) :
          undefined,
        stalenessThreshold: metadata.stalenessDetails?.threshold,
        dataAge: metadata.stalenessDetails ?
          `${Math.floor(metadata.stalenessDetails.hoursSinceUpdate)}h old` :
          undefined,
      },
    };

    const response = createSuccessResponse(responseData);

    privateNoStore(response);

    // Instrumentation headers for forecast_ready event metadata.
    // Source resolves to one of: 'enhanced' | 'fallback' | 'stale' | 'missing'
    // based on the data path that produced this response.
    let source: "enhanced" | "fallback" | "stale" | "missing";
    if (metadata.missing) {
      source = "missing";
    } else if (metadata.stale) {
      source = "stale";
    } else if (hasData) {
      const dataSource = forecasts[0]?.data_source;
      source = dataSource && dataSource !== "FALLBACK" ? "enhanced" : "fallback";
    } else {
      source = "missing";
    }
    response.headers.set("X-Quiver-Source", source);
    response.headers.set(
      "X-Quiver-Cached",
      metadata.cached ? "true" : "false"
    );

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error fetching enhanced forecasts:", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("❌ Error stack:", error.stack);
    }
    return privateNoStore(
      createErrorResponse(
        "Failed to fetch enhanced forecasts",
        errorMessage,
      ),
    );
  }
}

export const GET = withAuth(getEnhancedForecasts, { optional: true });
