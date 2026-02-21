/**
 * Forecast Formatting Utilities
 *
 * Pure functions for formatting wave, period, and wind values.
 * Extracted from enhanced-forecast-service.ts for testability.
 */

import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import { formatSwellPeriod } from "@/lib/formatters/surf-data";

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
