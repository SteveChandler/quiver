/**
 * Forecast Data Staleness Configuration
 *
 * Different forecast data sources update at different frequencies.
 * This module provides configurable staleness thresholds based on the data source.
 */

/**
 * Staleness thresholds in hours for different forecast data sources
 *
 * - CDIP: Buoy data updates hourly but cron sharding/timeouts mean not every beach
 *   updates every cycle. 4-hour threshold prevents false staleness while still
 *   catching genuinely stale data.
 * - NOAA_NWS: Enhanced forecasts regenerate daily (6 AM), so 12-hour threshold prevents
 *   unnecessary regeneration attempts while providing buffer until next update
 * - FALLBACK: Fallback data is less critical and can tolerate longer staleness
 * - NOWCAST_ANCHOR: Single-row buoy observation accepted as ground truth in the
 *   nowcast window. 6h matches CDIP-via-IOOS ingestion lag (2h sync cron +
 *   up-to-3h source staleness) — a stale anchor still beats a hallucinated
 *   forecast since swells don't swing 100% in 6h.
 * - DEFAULT: Default threshold for unknown or unspecified sources
 */
export const STALENESS_THRESHOLDS = {
  CDIP: 4,          // 4 hours (CDIP buoy cron doesn't reliably update every beach every hour)
  NOAA_NWS: 12,     // 12 hours (Enhanced forecasts regenerate daily, matches actual update cadence)
  FALLBACK: 12,     // 12 hours (fallback data less critical)
  NOWCAST_ANCHOR: 6, // 6 hours (matches CDIP-via-IOOS ingestion lag; see forecast-builder shouldApplyNowcastAnchor)
  DEFAULT: 6        // Default for unknown sources
} as const;

export type DataSource = keyof typeof STALENESS_THRESHOLDS;

/**
 * Get the staleness threshold in hours for a given data source
 *
 * @param dataSource - The forecast data source (e.g., "CDIP", "NOAA_NWS", "FALLBACK")
 * @returns The staleness threshold in hours
 *
 * @example
 * ```typescript
 * const threshold = getStalenessThreshold("CDIP"); // Returns 4
 * const threshold = getStalenessThreshold("noaa_nws"); // Returns 12 (case-insensitive)
 * const threshold = getStalenessThreshold(); // Returns 6 (DEFAULT)
 * ```
 */
export function getStalenessThreshold(dataSource?: string | null): number {
  if (!dataSource) {
    return STALENESS_THRESHOLDS.DEFAULT;
  }

  // Normalize to uppercase for case-insensitive matching
  const normalizedSource = dataSource.toUpperCase();

  // Check if the normalized source exists in our thresholds
  if (normalizedSource in STALENESS_THRESHOLDS) {
    return STALENESS_THRESHOLDS[normalizedSource as DataSource];
  }

  // Default threshold for unknown sources
  return STALENESS_THRESHOLDS.DEFAULT;
}

/**
 * Get human-readable description of why data is or isn't stale
 *
 * @param hoursSinceUpdate - Hours elapsed since last update
 * @param dataSource - The forecast data source
 * @returns Object with staleness info and reasoning
 *
 * @example
 * ```typescript
 * const info = getStalenessInfo(5, "CDIP");
 * // Returns: { isStale: true, reason: "Exceeded source-specific threshold", threshold: 4 }
 * ```
 */
export function getStalenessInfo(
  hoursSinceUpdate: number,
  dataSource?: string | null
): {
  isStale: boolean;
  threshold: number;
  reason: string;
} {
  const threshold = getStalenessThreshold(dataSource);
  const isStale = hoursSinceUpdate > threshold;

  return {
    isStale,
    threshold,
    reason: isStale
      ? 'Exceeded source-specific threshold'
      : 'Within freshness window'
  };
}
