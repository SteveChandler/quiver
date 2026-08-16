/**
 * Unit Conversion Utilities
 *
 * Centralized utilities for converting between different measurement systems.
 * This module is the single source of truth for unit conversion constants
 * and functions across the codebase.
 */

// =============================================================================
// CONVERSION CONSTANTS
// =============================================================================

/**
 * Meters to feet conversion factor.
 * Single source of truth for this constant across the codebase.
 */
export const METERS_TO_FEET = 3.28084;

/**
 * Feet to meters conversion factor.
 * Single source of truth for this constant across the codebase.
 */
export const FEET_TO_METERS = 0.3048;

// =============================================================================
// LENGTH CONVERSIONS
// =============================================================================

/**
 * Convert meters to feet (nullable-safe).
 * Returns null if input is null/undefined.
 *
 * @param meters - Height in meters
 * @param precision - Decimal places for rounding (default: 1); pass null for
 *   the exact conversion used by legacy raw-value consumers
 * @returns Height in feet rounded to precision, or null
 */
export function metersToFeet(
  meters: number,
  precision?: number | null
): number;
export function metersToFeet(
  meters: null | undefined,
  precision?: number | null
): null;
export function metersToFeet(
  meters: number | null | undefined,
  precision?: number | null
): number | null;
export function metersToFeet(
  meters: number | null | undefined,
  precision: number | null = 1
): number | null {
  if (meters == null) return null;
  if (precision === null) return meters * METERS_TO_FEET;
  const multiplier = Math.pow(10, precision);
  return Math.round(meters * METERS_TO_FEET * multiplier) / multiplier;
}

/**
 * Convert meters to feet (strict, non-nullable).
 * Use when you know the input is valid.
 *
 * @param meters - Height in meters (must be a valid number)
 * @returns Height in feet (no rounding applied)
 */
function metersToFeetStrict(meters: number): number {
  return meters * METERS_TO_FEET;
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
