/**
 * Wave Formatting Utilities
 *
 * Shared utilities for formatting wave heights and ranges across the application.
 * Used by forecast components, beach conditions displays, and swell event cards.
 *
 * @module lib/utils/wave-formatters
 */

/**
 * Format a single wave height for display
 *
 * @param height - Wave height in feet (negative values treated as 0)
 * @returns Formatted string (e.g., "3.5ft" or "Flat")
 *
 * @example
 * ```typescript
 * formatWaveHeight(3.5) // "3.5ft"
 * formatWaveHeight(0)   // "Flat"
 * ```
 */
export function formatWaveHeight(height: number): string {
  // Handle invalid/negative values
  if (height <= 0) return "Flat";
  return `${height.toFixed(1)}ft`;
}

/**
 * Format a wave height range for display
 *
 * @param range - Tuple of [min, max] wave heights in feet
 * @param precision - "decimal" for one decimal place (default), "integer" for whole numbers
 * @returns Formatted range string (e.g., "3.5-5.0ft" or "3-5ft")
 *
 * @example
 * ```typescript
 * formatWaveRange([3.2, 5.8])             // "3.2-5.8ft"
 * formatWaveRange([3.2, 5.8], "integer")  // "3-6ft"
 * formatWaveRange([4, 4])                 // "4.0ft"
 * ```
 */
export function formatWaveRange(
  range: [number, number],
  precision: "decimal" | "integer" = "decimal"
): string {
  const [min, max] = range;

  if (precision === "integer") {
    const minInt = Math.round(min);
    const maxInt = Math.round(max);
    if (minInt === maxInt) return `${minInt}ft`;
    return `${minInt}-${maxInt}ft`;
  }

  if (min === max) {
    return `${min.toFixed(1)}ft`;
  }
  return `${min.toFixed(1)}-${max.toFixed(1)}ft`;
}

/**
 * Get human-readable wave size description based on height
 *
 * Size categories:
 * - <2ft: knee-high
 * - 2-3ft: waist-high
 * - 3-5ft: chest-high
 * - 5-7ft: head-high
 * - 7-10ft: overhead
 * - 10ft+: double-overhead
 *
 * @param heightFt - Wave height in feet
 * @returns Size description string (e.g., "chest-high", "overhead")
 *
 * @example
 * ```typescript
 * getWaveSizeDescription(4)   // "chest-high"
 * getWaveSizeDescription(8)   // "overhead"
 * getWaveSizeDescription(12)  // "double-overhead"
 * ```
 */
export function getWaveSizeDescription(heightFt: number): string {
  if (heightFt < 2) return "knee-high";
  if (heightFt < 3) return "waist-high";
  if (heightFt < 5) return "chest-high";
  if (heightFt < 7) return "head-high";
  if (heightFt < 10) return "overhead";
  return "double-overhead";
}

/**
 * Human-readable labels for wave size descriptions
 * Used for display text in UI components
 */
export const WAVE_SIZE_LABELS: Record<string, string> = {
  "knee-high": "Small Swell",
  "waist-high": "Small Swell",
  "chest-high": "Medium Swell",
  "head-high": "Solid Swell",
  overhead: "Big Swell",
  "double-overhead": "Epic Swell",
};

/**
 * Get excitement label for a given wave size
 *
 * @param size - Wave size description (from getWaveSizeDescription)
 * @returns Human-readable label for the swell
 *
 * @example
 * ```typescript
 * getWaveSizeLabel("overhead")        // "Big Swell"
 * getWaveSizeLabel("double-overhead") // "Epic Swell"
 * ```
 */
export function getWaveSizeLabel(size: string): string {
  return WAVE_SIZE_LABELS[size] || "Swell Incoming";
}
