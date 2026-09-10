import { METERS_TO_FEET } from '@/lib/utils/unit-conversions';
// Cross-platform note: web now matches quiver-native/src/lib/format-wave-height.ts —
// floor/ceil bracket on face Hs, no "sets" expansion, no "sets" suffix.

/**
 * Format wave height as a surfer-friendly range string.
 * Returns "Flat" for zero, negative, NaN, or Infinity values.
 * Uses Surfline-style floor/ceil bracket on face Hs (no × 1.5 set expansion);
 * collapses to a single value when floor and ceil are equal.
 */
export function formatWaveHeightRange(ft: number): string {
  if (!Number.isFinite(ft)) return 'Flat';
  if (ft <= 0) return 'Flat';
  const low = Math.floor(ft);
  const high = Math.ceil(ft);
  if (low === high) return `${low}ft`;
  return `${low}-${high}ft`;
}

/**
 * Format wind speed in mph, rounded to nearest integer.
 */
export function formatWindSpeed(mph: number): string {
  if (!Number.isFinite(mph)) return '-- mph';
  return `${Math.round(mph)} mph`;
}

/**
 * Format swell period in seconds, rounded to nearest integer.
 */
export function formatSwellPeriod(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--s';
  return `${Math.round(seconds)}s`;
}

/**
 * Format tide height in feet with 1 decimal place.
 */
export function formatTideHeight(ft: number): string {
  if (!Number.isFinite(ft)) return '--ft';
  return `${ft.toFixed(1)}ft`;
}

/**
 * Format water temperature in Fahrenheit, rounded to nearest integer.
 *
 * Callers that historically displayed an em dash can opt into that sentinel
 * without changing the default output used by forecast and session surfaces.
 */
export function formatWaterTemp(
  fahrenheit: number | string | null | undefined,
  emptyValue: '--°F' | '—' = '--°F'
): string {
  if (fahrenheit === null || fahrenheit === undefined || fahrenheit === '') {
    return emptyValue;
  }

  const numericValue =
    typeof fahrenheit === 'string' ? parseFloat(fahrenheit) : fahrenheit;
  if (!Number.isFinite(numericValue)) return emptyValue;
  return `${Math.round(numericValue)}°F`;
}

// ============================================================================
// Merged from lib/services/forecast/format-utils.ts
// ============================================================================

/**
 * Format wave period in seconds with validation
 * Rejects periods outside realistic range (4-25s)
 */
export function formatPeriodSeconds(
  value: number | string | null | undefined
): string | null {
  if (value == null) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(num)) return null;
  // Reject obviously bad readings per product spec (<4s or >25s)
  if (num < 4 || num > 25) return null;
  return formatSwellPeriod(num);
}

/**
 * Format wave height from meters to feet with validation
 * Rejects values over 10m as sensor/model glitch
 */
export function formatWaveFeet(
  meters: number | null | undefined
): string | null {
  if (meters == null) return null;
  if (!isFinite(meters)) return null;
  // Guard against absurd values; discard > 10m (≈ 32.8ft) as sensor/model glitch
  if (meters < 0 || meters > 10) return null;
  return metersToFeetString(meters);
}

/**
 * Format feet value (CDIP already delivers in feet)
 */
export function formatFeet(feet: number | null | undefined): string | null {
  if (feet == null) return null;
  if (!isFinite(feet)) return null;
  if (feet < 0) return null;
  const rounded = Math.round(feet * 10) / 10;
  return `${rounded} ft`;
}

/**
 * Convert meters to feet string
 * @param meters - Height in meters
 * @returns Formatted string like "3.2 ft"
 */
export function metersToFeetString(meters: number): string {
  const feet = meters * METERS_TO_FEET;
  // Round to nearest 0.1 feet for precision
  const rounded = Math.round(feet * 10) / 10;
  return `${rounded} ft`;
}

/**
 * Extract numeric wind speed from string like "15 mph"
 */
export function extractWindSpeed(windSpeedStr: string): string {
  if (!windSpeedStr) return "10 mph";
  const match = windSpeedStr.match(/(\d+)/);
  return match ? `${match[1]} mph` : "10 mph";
}
