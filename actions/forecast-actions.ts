"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { updateBeachForecast } from "@/lib/utils/forecast-server-utils";
import { isDataStale } from "@/lib/utils/forecast-client-utils";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import { resolveConfidence } from "@/lib/monitoring/fallback-helpers";
import { extractForecastDate as extractForecastDateFromAt } from "@/lib/utils/forecast-at-adapter";
import { fetchLatestObservation } from "@/lib/services/observations/nowcast-anchor";
import {
  applyV51DisplayOverrideToForecasts,
} from "@/lib/services/forecast/v5-display-gate";
import type { Beach, Forecast } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { ForecastTimeInfo } from "@/lib/utils/current-forecast-utils";
import type { LatestObservation } from "@/lib/services/observations/nowcast-anchor.types";

// Metadata interface for forecast transparency
interface ForecastMetadata {
  primarySource: "NOAA_NWS" | "CDIP" | "FALLBACK" | string;
  allSources: string[];
  confidenceScore: number;
  lastUpdated: string;
  cdipStation?: string;
  cdipStationName?: string;
  cdipDistance?: number;
  isRealTimeData?: boolean;
  isStaleData?: boolean;
}

// Helper function to extract metadata from enhanced forecast
function extractForecastMetadata(
  forecast: EnhancedForecastEntity
): ForecastMetadata {
  const dataSource = forecast.data_source || "FALLBACK";

  // Use source-specific staleness thresholds
  const staleData = isDataStale(forecast.updated_at, dataSource);

  return {
    primarySource: dataSource,
    allSources: forecast.raw_forecast?.data_sources || [dataSource],
    confidenceScore: resolveConfidence(forecast.confidence_score, 'forecast', { beachId: forecast.beach_id }),
    lastUpdated: forecast.updated_at,
    cdipStation: forecast.raw_forecast?.cdip_data?.stationId,
    cdipStationName: forecast.raw_forecast?.cdip_data?.stationName,
    // CDIP is real-time data
    isRealTimeData: forecast.data_source === "CDIP",
    // Use source-specific staleness threshold instead of hardcoded 6 hours
    isStaleData: staleData,
  };
}

// Get forecast data for a specific beach
export async function getBeachForecasts(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_at", `${today}T00:00:00Z`)
      .order("forecast_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching beach forecasts:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getBeachForecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get latest forecast for a beach (including past forecasts)
export async function getLatestBeachForecast(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .order("forecast_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching latest beach forecast:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getLatestBeachForecast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Enhanced forecast with metadata interface
interface EnhancedForecastWithMetadata extends EnhancedForecastEntity {
  metadata: ForecastMetadata;
}

interface EnhancedForecastQueryOptions {
  startDate?: string;
}

// Get enhanced forecast data for a beach with transparency metadata
export async function getEnhancedBeachForecasts(
  beachId: string,
  days: number = 12,
  options?: EnhancedForecastQueryOptions
) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Prefer the legacy compatibility view if present (tests assert against it), fallback to table
    const today = new Date().toISOString().split("T")[0];
    const requestedStartDate = options?.startDate;
    const parsedRequestedStartDate = requestedStartDate
      ? new Date(`${requestedStartDate}T00:00:00Z`)
      : null;
    const hasValidRequestedStartDate =
      !!parsedRequestedStartDate &&
      !Number.isNaN(parsedRequestedStartDate.getTime());
    const start = hasValidRequestedStartDate
      ? parsedRequestedStartDate
      : new Date();
    const startDate = start.toISOString().split("T")[0];
    const endDate = new Date(start.getTime() + days * 86400000)
      .toISOString()
      .split("T")[0];
    const shouldUseLegacyView = !hasValidRequestedStartDate && startDate >= today;

    let data: any[] | null = null;
    let error: any = null;

    const runTableQuery = async () => {
      // Query explicit date range against source table so historical sessions can load yesterday's forecasts.
      const dayAfterEndDate = new Date(
        new Date(endDate + "T00:00:00Z").getTime() + 86400000
      )
        .toISOString()
        .split("T")[0];
      return supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .gte("forecast_at", `${startDate}T00:00:00Z`)
        .lt("forecast_at", `${dayAfterEndDate}T00:00:00Z`)
        .order("forecast_at", { ascending: true });
    };

    if (shouldUseLegacyView) {
      // Try view for present/future lookups
      const viewAttempt = await supabase
        .from("ten_day_enhanced_forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .order("forecast_at", { ascending: true });

      if (!viewAttempt.error) {
        data = viewAttempt.data as any[];
      } else {
        const tableAttempt = await runTableQuery();
        data = tableAttempt.data as any[];
        error = tableAttempt.error;
      }
    } else {
      const tableAttempt = await runTableQuery();
      data = tableAttempt.data as any[];
      error = tableAttempt.error;
    }

    if (error) {
      console.error("Error fetching enhanced forecasts:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Fetched enhanced_forecasts rows:", {
      beachId,
      totalRows: data?.length || 0,
      firstRowDate: data?.[0]?.forecast_at ? extractForecastDateFromAt(data[0].forecast_at) : data?.[0]?.forecast_date,
      lastRowDate: data?.[data.length - 1]?.forecast_at ? extractForecastDateFromAt(data[data.length - 1].forecast_at) : data?.[data.length - 1]?.forecast_date,
    });

    // Enrich forecasts with metadata for transparency
    const displayForecasts = await applyV51DisplayOverrideToForecasts(
      (data || []) as EnhancedForecastEntity[]
    );

    const forecastsWithMetadata: EnhancedForecastWithMetadata[] = displayForecasts.map((forecast) => ({
      ...forecast,
      metadata: extractForecastMetadata(forecast),
    }));

    return { success: true, data: forecastsWithMetadata };
  } catch (error) {
    console.error("Error in getEnhancedBeachForecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get basic forecast preview for a beach (used in map components)
export async function getBeachForecastPreview(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();
    const { getCurrentForecast } = await import(
      "@/lib/utils/current-forecast-utils"
    );

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const dayAfterTomorrow = new Date(new Date(tomorrow + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

    // Forecast row + latest live-buoy observation fetched in parallel — both
    // feed the beach detail hero (forecast number + LiveBuoyChip).
    const [enhancedResult, latestObservation] = await Promise.all([
      (supabase as any)
        .from("enhanced_forecasts")
        .select(
          "forecast_at, forecast_date, forecast_time, wave_height, wave_height_om, wave_direction_om, swell_direction_om, swell_1_direction, wind_speed, wind_direction, weather_condition, confidence_score, data_source"
        )
        .eq("beach_id", beachId)
        .gte("forecast_at", `${today}T00:00:00Z`)
        .lt("forecast_at", `${dayAfterTomorrow}T00:00:00Z`)
        .order("forecast_at", { ascending: true }),
      fetchLatestObservation(supabase, beachId),
    ]);

    const { data: enhancedForecasts, error: enhancedError } = enhancedResult;

    if (enhancedError) {
      console.error("Error fetching enhanced forecast preview:", enhancedError);
    }

    if (enhancedForecasts && enhancedForecasts.length > 0) {
      const displayForecasts = await applyV51DisplayOverrideToForecasts(
        enhancedForecasts as EnhancedForecastEntity[]
      );
      // Use time-aware selection to get the most appropriate forecast
      const currentForecast = getCurrentForecast(displayForecasts as any[]);

      if (currentForecast) {
        return {
          success: true,
          data: {
            type: "enhanced",
            wave_height: currentForecast.wave_height,
            wind_speed: currentForecast.wind_speed,
            wind_direction: currentForecast.wind_direction,
            weather_condition: currentForecast.weather_condition,
            confidence_score: currentForecast.confidence_score,
            // Live-buoy channel — peer to the forecast number, displayed in
            // the LiveBuoyChip. Null when no station resolves or no fresh obs.
            latestObservation,
            // Include metadata for transparency
            metadata: {
              primarySource: currentForecast.data_source || "FALLBACK",
              allSources: [currentForecast.data_source || "FALLBACK"],
              confidenceScore: resolveConfidence(currentForecast.confidence_score, 'forecast'),
              lastUpdated: new Date().toISOString(), // Will be from DB if available
              isRealTimeData: currentForecast.data_source === "CDIP",
              isStaleData: false, // Can't determine without updated_at
            },
          },
        };
      }
    }

    // No fallback to a basic `forecasts` table here. Audit on 2026-04-25
    // confirmed:
    //   1. The `forecasts` relation does not exist in production (lookup
    //      returned 42P01 "relation forecasts does not exist").
    //   2. All 300 active beaches have at least one `enhanced_forecasts`
    //      row in the current 24h window — zero coverage gaps.
    // Removing the fallback also closes a wave-height divergence path:
    // the basic table's `wave_height` was never routed through the canonical
    // face-height transformer (`toFaceHeightFeetDecomposed`), so any
    // consumer that fell through here would render a raw-Hs number that
    // disagreed with the beach detail hero (face-height) and the Oracle
    // home (face-height via `waveHeightBadge`). Returning null surfaces
    // "—" via WaveHeightDisplay instead of a wrong number — the correct
    // honesty signal for the rare empty case.
    return {
      success: true,
      data: null, // No forecast data available
    };
  } catch (error) {
    console.error("Error in getBeachForecastPreview:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Update forecasts for a specific beach using enhanced forecast system
export async function updateBeachForecasts(beachId: string) {
  try {
    const { updateBeachForecast } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const data = await updateBeachForecast(beachId);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error updating beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Update forecasts for all beaches using enhanced forecast system
export async function updateAllBeachForecasts() {
  try {
    const { updateAllBeachForecasts: updateAll } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const result = await updateAll();

    const successful = result.results?.filter((r) => r.success).length || 0;
    const failed = (result.results?.length || 0) - successful;

    return {
      success: true,
      data: {
        total: result.results?.length || 0,
        successful,
        failed,
        results: result.results || [],
      },
    };
  } catch (error) {
    console.error("Error updating all beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
