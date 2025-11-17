import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStalenessThreshold } from "@/lib/config/forecast-staleness";
// Removed unused type import to satisfy TS6133

/**
 * Get singleton instance of EnhancedForecastService
 */
function getEnhancedForecastService(): EnhancedForecastService {
  return new EnhancedForecastService();
}

/**
 * Check if forecast data is stale based on source-specific thresholds
 *
 * Different data sources update at different frequencies:
 * - CDIP (buoy data): Updates hourly → marked stale after 1.5 hours
 * - NOAA WaveWatch: Updates every 6 hours → marked stale after 6 hours
 * - FALLBACK data: Less critical → marked stale after 12 hours
 *
 * @param updatedAt - Timestamp when the forecast was last updated
 * @param dataSource - The forecast data source (e.g., "CDIP", "NOAA_NWS")
 * @returns true if the data is stale based on source-specific threshold
 *
 * @example
 * ```typescript
 * const isStale = isDataStale("2024-01-15T10:00:00Z", "CDIP");
 * // Returns true if more than 1.5 hours have passed
 * ```
 */
export function isDataStale(
  updatedAt: string | Date,
  dataSource?: string | null
): boolean {
  const threshold = getStalenessThreshold(dataSource);
  const updatedTime = new Date(updatedAt).getTime();
  const hoursSinceUpdate = (Date.now() - updatedTime) / (1000 * 60 * 60);

  return hoursSinceUpdate > threshold;
}

/**
 * Get detailed staleness information for logging/debugging
 *
 * @param updatedAt - Timestamp when the forecast was last updated
 * @param dataSource - The forecast data source
 * @returns Object with staleness details including hours, threshold, and reason
 */
export function getStalenessDetails(
  updatedAt: string | Date,
  dataSource?: string | null
): {
  hoursSinceUpdate: number;
  threshold: number;
  isStale: boolean;
  reason: string;
} {
  const threshold = getStalenessThreshold(dataSource);
  const updatedTime = new Date(updatedAt).getTime();
  const hoursSinceUpdate = (Date.now() - updatedTime) / (1000 * 60 * 60);
  const isStale = hoursSinceUpdate > threshold;

  return {
    hoursSinceUpdate,
    threshold,
    isStale,
    reason: isStale
      ? 'Exceeded source-specific threshold'
      : 'Within freshness window'
  };
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
export async function updateAllBeachForecasts() {
  const service = getEnhancedForecastService();
  const result = await service.updateAllEnhancedForecasts();

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
