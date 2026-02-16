/**
 * Client-Safe Forecast Utilities
 *
 * These utilities can be used in both client and server components.
 * They do NOT import any server-only code.
 */

import { getStalenessThreshold } from "@/lib/config/forecast-staleness";

/**
 * Check if forecast data is stale based on source-specific thresholds
 *
 * Different data sources update at different frequencies:
 * - CDIP (buoy data): Updates hourly → marked stale after 4 hours
 * - NOAA WaveWatch: Updates every 6 hours → marked stale after 6 hours
 * - FALLBACK data: Less critical → marked stale after 12 hours
 *
 * @param updatedAt - Timestamp when the forecast was last updated
 * @param dataSource - The forecast data source (e.g., "CDIP", "NOAA_NWS")
 * @returns true if the data is stale based on source-specific threshold
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
      ? "Exceeded source-specific threshold"
      : "Within freshness window",
  };
}

/**
 * Get the latest (most recent) updated_at timestamp from an array of forecasts
 *
 * This is critical for accurate freshness display. When fetching forecasts,
 * we include lookback days for tide charts, which means forecasts[0] may be
 * yesterday's data with an older updated_at. This function finds the true
 * latest write time across all forecasts.
 *
 * @param forecasts - Array of objects with optional updated_at field
 * @returns The most recent updated_at timestamp, or null if none found
 *
 * @example
 * ```typescript
 * const forecasts = [
 *   { updated_at: "2024-01-04T10:00:00Z" }, // yesterday's data
 *   { updated_at: "2024-01-05T12:00:00Z" }, // today's data (latest)
 * ];
 * const latest = getLatestUpdatedAt(forecasts);
 * // Returns "2024-01-05T12:00:00Z"
 * ```
 */
export function getLatestUpdatedAt(
  forecasts: { updated_at?: string | null }[]
): string | null {
  if (!forecasts.length) return null;

  // Optimized: Single pass with timestamp caching
  // Avoids creating 2 Date objects per comparison in the original reduce
  let latestTimestamp = 0;
  let latestValue: string | null = null;

  for (const forecast of forecasts) {
    if (forecast.updated_at) {
      const ts = new Date(forecast.updated_at).getTime();
      if (ts > latestTimestamp) {
        latestTimestamp = ts;
        latestValue = forecast.updated_at;
      }
    }
  }

  return latestValue;
}
