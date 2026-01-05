/**
 * Unit Conversion Utilities
 *
 * Centralized utilities for converting between different measurement systems.
 * Eliminates duplication of conversion functions across the codebase.
 *
 * Previously duplicated in:
 * - components/forecast/spot-conditions-summary.tsx
 * - app/api/v1/recommendations/route.ts
 * - And 4+ other files
 */

// =============================================================================
// LENGTH CONVERSIONS
// =============================================================================

/**
 * Convert meters to feet.
 *
 * @param meters - Value in meters (null/undefined returns null)
 * @param precision - Decimal places (default: 1)
 * @returns Value in feet, or null if input is null/undefined
 *
 * @example
 * metersToFeet(1.83) // 6.0
 * metersToFeet(null) // null
 */
export function metersToFeet(
  meters: number | null | undefined,
  precision: number = 1
): number | null {
  if (meters == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round(meters * 3.28084 * multiplier) / multiplier;
}

/**
 * Convert feet to meters.
 *
 * @param feet - Value in feet (null/undefined returns null)
 * @param precision - Decimal places (default: 2)
 * @returns Value in meters, or null if input is null/undefined
 */
export function feetToMeters(
  feet: number | null | undefined,
  precision: number = 2
): number | null {
  if (feet == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round((feet / 3.28084) * multiplier) / multiplier;
}

// =============================================================================
// SPEED CONVERSIONS
// =============================================================================

/**
 * Convert meters per second to knots.
 *
 * @param metersPerSecond - Speed in m/s (null/undefined returns null)
 * @returns Speed in knots (rounded to nearest integer), or null
 *
 * @example
 * msToKnots(5.14) // 10
 * msToKnots(null) // null
 */
export function msToKnots(
  metersPerSecond: number | null | undefined
): number | null {
  if (metersPerSecond == null) return null;
  return Math.round(metersPerSecond * 1.94384);
}

/**
 * Convert knots to meters per second.
 *
 * @param knots - Speed in knots (null/undefined returns null)
 * @param precision - Decimal places (default: 2)
 * @returns Speed in m/s, or null
 */
export function knotsToMs(
  knots: number | null | undefined,
  precision: number = 2
): number | null {
  if (knots == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round((knots / 1.94384) * multiplier) / multiplier;
}

/**
 * Convert meters per second to miles per hour.
 *
 * @param metersPerSecond - Speed in m/s (null/undefined returns null)
 * @returns Speed in mph (rounded to nearest integer), or null
 */
export function msToMph(
  metersPerSecond: number | null | undefined
): number | null {
  if (metersPerSecond == null) return null;
  return Math.round(metersPerSecond * 2.23694);
}

/**
 * Convert miles per hour to meters per second.
 *
 * @param mph - Speed in mph (null/undefined returns null)
 * @param precision - Decimal places (default: 2)
 * @returns Speed in m/s, or null
 */
export function mphToMs(
  mph: number | null | undefined,
  precision: number = 2
): number | null {
  if (mph == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round((mph / 2.23694) * multiplier) / multiplier;
}

/**
 * Convert kilometers per hour to knots.
 *
 * @param kmh - Speed in km/h (null/undefined returns null)
 * @returns Speed in knots (rounded to nearest integer), or null
 */
export function kmhToKnots(
  kmh: number | null | undefined
): number | null {
  if (kmh == null) return null;
  return Math.round(kmh * 0.539957);
}

// =============================================================================
// TEMPERATURE CONVERSIONS
// =============================================================================

/**
 * Convert Celsius to Fahrenheit.
 *
 * @param celsius - Temperature in Celsius (null/undefined returns null)
 * @param precision - Decimal places (default: 0)
 * @returns Temperature in Fahrenheit, or null
 */
export function celsiusToFahrenheit(
  celsius: number | null | undefined,
  precision: number = 0
): number | null {
  if (celsius == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round((celsius * 9 / 5 + 32) * multiplier) / multiplier;
}

/**
 * Convert Fahrenheit to Celsius.
 *
 * @param fahrenheit - Temperature in Fahrenheit (null/undefined returns null)
 * @param precision - Decimal places (default: 1)
 * @returns Temperature in Celsius, or null
 */
export function fahrenheitToCelsius(
  fahrenheit: number | null | undefined,
  precision: number = 1
): number | null {
  if (fahrenheit == null) return null;
  const multiplier = Math.pow(10, precision);
  return Math.round(((fahrenheit - 32) * 5 / 9) * multiplier) / multiplier;
}

// =============================================================================
// ALIASES (Backward Compatibility)
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

// =============================================================================
// WAVE HEIGHT FORMATTING
// =============================================================================

/**
 * Format wave height range for display.
 *
 * @param minFeet - Minimum wave height in feet
 * @param maxFeet - Maximum wave height in feet (optional, same as min if not provided)
 * @param unit - Unit to append (default: 'ft')
 * @returns Formatted string like "3-5 ft" or "2 ft"
 *
 * @example
 * formatWaveHeight(3, 5) // "3-5 ft"
 * formatWaveHeight(2) // "2 ft"
 * formatWaveHeight(3.5, 5.5) // "3-5 ft" (rounds to whole numbers)
 */
export function formatWaveHeight(
  minFeet: number | null | undefined,
  maxFeet?: number | null | undefined,
  unit: string = "ft"
): string {
  if (minFeet == null) return "N/A";

  const min = Math.round(minFeet);
  const max = maxFeet != null ? Math.round(maxFeet) : min;

  if (min === max) {
    return `${min} ${unit}`;
  }

  return `${min}-${max} ${unit}`;
}

/**
 * Format wind speed for display.
 *
 * @param speedKnots - Wind speed in knots
 * @param unit - Unit to append (default: 'kts')
 * @returns Formatted string like "15 kts" or "N/A"
 */
export function formatWindSpeed(
  speedKnots: number | null | undefined,
  unit: string = "kts"
): string {
  if (speedKnots == null) return "N/A";
  return `${Math.round(speedKnots)} ${unit}`;
}

// =============================================================================
// DIRECTION CONVERSIONS
// =============================================================================

/**
 * Convert compass direction degrees to cardinal direction.
 *
 * @param degrees - Direction in degrees (0-360)
 * @returns Cardinal direction string (N, NE, E, etc.)
 */
export function degreesToCardinal(degrees: number | null | undefined): string {
  if (degrees == null) return "N/A";

  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Convert cardinal direction to approximate degrees.
 *
 * @param cardinal - Cardinal direction string (N, NE, E, etc.)
 * @returns Degrees (0-360), or null if invalid
 */
export function cardinalToDegrees(cardinal: string | null | undefined): number | null {
  if (!cardinal) return null;

  const directionMap: Record<string, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };

  return directionMap[cardinal.toUpperCase()] ?? null;
}
