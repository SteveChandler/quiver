import { METERS_TO_FEET } from '@/lib/utils/unit-conversions';
// Cross-platform note: web matches quiver-native/src/lib/format-wave-height.ts —
// floor/ceil bracket on face Hs, whole numbers read as a band, no "sets" suffix.

/**
 * Bracket a face height the way quiver-native's `formatWaveRange` does
 * (src/lib/format-wave-height.ts `formatBounds`), so one forecast reads the
 * same on every web and native screen. Inputs are first rounded to the 0.1 ft
 * the forecast API sends (`roundWaveHeight`), because native brackets that
 * rounded string. A whole number reads as the band just below it ("3" → "2-3ft").
 */
export function bracketFaceHeightFeet(minFt: number, maxFt: number): string {
  if (!Number.isFinite(minFt) || !Number.isFinite(maxFt)) return 'Flat';
  const min = Math.round(Math.min(minFt, maxFt) * 10) / 10;
  const max = Math.round(Math.max(minFt, maxFt) * 10) / 10;
  const low = Math.max(0, Math.floor(min));
  const high = Math.max(low, Math.ceil(max));
  if (low <= 0 && high <= 0) return 'Flat';
  if (low === high) return `${low - 1}-${low}ft`;
  return `${low}-${high}ft`;
}

/**
 * Format wave height as a surfer-friendly range string.
 * Returns "Flat" for zero, negative, NaN, or Infinity values.
 * Uses the floor/ceil bracket on face Hs (no × 1.5 set expansion), with
 * native's whole-number band (see `bracketFaceHeightFeet`).
 */
export function formatWaveHeightRange(ft: number): string {
  if (!Number.isFinite(ft) || ft <= 0) return 'Flat';
  return bracketFaceHeightFeet(ft, ft);
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
