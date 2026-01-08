/**
 * Server-Only Forecast Utilities
 *
 * These utilities can ONLY be used in server components, API routes, and server actions.
 * They import server-only code and should never be imported into client components.
 */

import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Re-export from forecast-service-utils for convenience
export { getFreshForecastFromCache } from "./forecast-service-utils";

export type ForecastUpdateOptions = {
  /**
   * Absolute unix timestamp (ms) after which the updater should stop starting new work.
   * Used by Vercel cron to avoid runtime hard timeouts.
   */
  deadlineMs?: number;
  /**
   * Shard index (0-based) for deterministic beach partitioning.
   * When set along with shardCount, only beaches where hash(beach_id) % shardCount === shard
   * are processed. This enables horizontal scaling of cron jobs.
   */
  shard?: number;
  /**
   * Total number of shards for partitioning beaches.
   * Required when shard is set.
   */
  shardCount?: number;
};

/**
 * Get singleton instance of EnhancedForecastService
 */
function getEnhancedForecastService(): EnhancedForecastService {
  return new EnhancedForecastService();
}

/**
 * Update forecasts for a specific beach
 */
export async function updateBeachForecast(beachId: string) {
  const supabase = await createSupabaseServiceRoleClient();

  // Get the beach details
  const { data: beach, error: beachError } = await supabase
    .from("beaches")
    .select("*")
    .eq("id", beachId)
    .single();

  if (beachError || !beach) {
    throw new Error("Beach not found");
  }

  const service = getEnhancedForecastService();

  // Generate comprehensive forecast
  const forecasts = await service.generateComprehensiveForecast(beach);

  // Store enhanced forecasts
  const result = await service.storeEnhancedForecasts(beach, forecasts);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    beach: beach.name,
    forecastsGenerated: forecasts.length,
    message: "Enhanced forecasts updated successfully",
  };
}

/**
 * Update forecasts for all beaches
 * 
 * Supports sharding via options.shard and options.shardCount for horizontal scaling.
 */
export async function updateAllBeachForecasts(options: ForecastUpdateOptions = {}) {
  const service = getEnhancedForecastService();
  const result = await service.updateAllEnhancedForecasts({
    deadlineMs: options.deadlineMs,
    shard: options.shard,
    shardCount: options.shardCount,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

/**
 * Update CDIP-sourced beaches with a shorter freshness window.
 *
 * Used by a dedicated cron endpoint to keep CDIP-backed enhanced forecasts
 * within the strict freshness requirements used by discovery.
 */
export async function updateCdipBeachForecasts(options: ForecastUpdateOptions = {}) {
  const service = getEnhancedForecastService();
  const result = await service.updateCdipEnhancedForecasts(options);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

/**
 * Fetch enhanced forecasts for a beach with standardized error handling
 */
export async function fetchBeachForecasts(beachId: string, days = 12) {
  const supabase = await createSupabaseServiceRoleClient();

  // Include yesterday's data for tide chart lookback window (6 hours ago)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: forecasts, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .gte("forecast_date", yesterday)
    .lte(
      "forecast_date",
      new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    )
    .order("forecast_date", { ascending: true })
    .order("forecast_time", { ascending: true });

  if (error) {
    throw new Error("Failed to fetch enhanced forecasts");
  }

  // Group forecasts by date
  const forecastsByDate = forecasts.reduce((acc: any, forecast: any) => {
    const date = forecast.forecast_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(forecast);
    return acc;
  }, {});

  return {
    forecasts,
    forecastsByDate,
    totalForecasts: forecasts.length,
  };
}
