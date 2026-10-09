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
