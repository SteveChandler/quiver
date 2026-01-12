/**
 * Unit Conversion Utilities
 *
 * Centralized utilities for converting between different measurement systems.
 * Only actively used functions are exported. Other conversion functions have
 * been removed as they were duplicated locally in components instead of using
 * this centralized module.
 */

// =============================================================================
// LENGTH CONVERSIONS
// =============================================================================

/**
 * Convert meters to feet.
 * Used by mToFt alias (imported by app/api/v1/recommendations/route.ts)
 */
function metersToFeet(
  meters: number | null | undefined,
  precision: number = 1
): number | null {
  if (meters == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round(meters * 3.28084 * multiplier) / multiplier;
}

// =============================================================================
// SPEED CONVERSIONS
// =============================================================================

/**
 * Convert meters per second to knots.
 * Used by msToKts alias (imported by app/api/v1/recommendations/route.ts)
 */
function msToKnots(
  metersPerSecond: number | null | undefined
): number | null {
  if (metersPerSecond == null) return null;
  return Math.round(metersPerSecond * 1.94384);
}

// =============================================================================
// EXPORTED ALIASES (Only used functions)
// =============================================================================

/**
 * Alias for metersToFeet with single decimal precision.
 * @deprecated Prefer metersToFeet for clarity
 */
export const mToFt = (m: number | null | undefined): number | null =>
  metersToFeet(m, 1);

/**
 * Alias for msToKnots.
 * @deprecated Prefer msToKnots for clarity
 */
export const msToKts = msToKnots;
