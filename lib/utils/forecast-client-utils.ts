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
