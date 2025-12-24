/**
 * Server-Only Forecast Utilities
 *
 * These utilities can ONLY be used in server components, API routes, and server actions.
 * They import server-only code and should never be imported into client components.
 */

import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type ForecastUpdateOptions = {
  /**
   * Absolute unix timestamp (ms) after which the updater should stop starting new work.
   * Used by Vercel cron to avoid runtime hard timeouts.
   */
  deadlineMs?: number;
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
 */
export async function updateAllBeachForecasts(options: ForecastUpdateOptions = {}) {
  const service = getEnhancedForecastService();
  const result = await service.updateAllEnhancedForecasts(options);

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
