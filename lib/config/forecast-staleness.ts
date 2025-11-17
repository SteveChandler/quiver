/**
 * Forecast Data Staleness Configuration
 *
 * Different forecast data sources update at different frequencies.
 * This module provides configurable staleness thresholds based on the data source.
 */

/**
 * Staleness thresholds in hours for different forecast data sources
 *
 * - CDIP: Buoy data updates hourly, so we mark as stale after 1.5 hours
 * - NOAA_NWS: WaveWatch model updates every 6 hours, so 6-hour threshold is appropriate
 * - FALLBACK: Fallback data is less critical and can tolerate longer staleness
 * - DEFAULT: Default threshold for unknown or unspecified sources
 */
export const STALENESS_THRESHOLDS = {
  CDIP: 1.5,        // 1.5 hours (CDIP buoy data updates hourly)
  NOAA_NWS: 6,      // 6 hours (NOAA WaveWatch updates every 6 hours)
  FALLBACK: 12,     // 12 hours (fallback data less critical)
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
 * const threshold = getStalenessThreshold("CDIP"); // Returns 1.5
 * const threshold = getStalenessThreshold("noaa_nws"); // Returns 6 (case-insensitive)
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
 * const info = getStalenessInfo(2, "CDIP");
 * // Returns: { isStale: true, reason: "Exceeded source-specific threshold", threshold: 1.5 }
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
