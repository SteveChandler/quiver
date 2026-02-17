/**
 * Distance calculation utilities
 * Centralized implementation to eliminate code duplication across the codebase
 */

import type { Coordinates } from '@/lib/types/coordinates';
import { EARTH_RADIUS_KM, EARTH_RADIUS_MI } from '@/lib/utils/geo-utils';

/**
 * Calculate distance between two geographic points using Haversine formula
 * @param from Starting coordinates
 * @param to Destination coordinates
 * @param unit Unit for result ('miles' | 'km' | 'meters')
 * @returns Distance in specified unit, or NaN if inputs are invalid
 *
 * @example
 * ```ts
 * const oceanBeach: Coordinates = { lat: 32.75, lon: -117.25 };
 * const pacificBeach: Coordinates = { lat: 32.80, lon: -117.24 };
 * const distance = calculateDistance(oceanBeach, pacificBeach, 'miles');
 * console.log(`${distance.toFixed(1)} miles`); // "3.5 miles"
 * ```
 */
export function calculateDistance(
  from: Coordinates,
  to: Coordinates,
  unit: "miles" | "km" | "meters" = "miles"
): number {
  // Defensive null/undefined check to prevent TypeError
  if (!from || !to) {
    return NaN;
  }
  return calculateDistanceRaw(from.lat, from.lon, to.lat, to.lon, unit);
}

/**
 * Internal raw distance calculation using Haversine formula
 * @internal
 */
function calculateDistanceRaw(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: "miles" | "km" | "meters"
): number {
  // Validate inputs - return NaN for invalid coordinates
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return NaN;
  }

  const R = unit === "miles" ? EARTH_RADIUS_MI : EARTH_RADIUS_KM;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return unit === "meters" ? distance * 1000 : distance;
}

/**
 * Calculate distance and return formatted string
 * @param from Starting coordinates
 * @param to Destination coordinates
 * @param unit Unit for result ('miles' | 'km')
 * @returns Formatted distance string, or "—" if calculation fails
 *
 * @example
 * ```ts
 * const from: Coordinates = { lat: 32.75, lon: -117.25 };
 * const to: Coordinates = { lat: 32.80, lon: -117.24 };
 * const formatted = calculateDistanceFormatted(from, to, 'miles');
 * console.log(formatted); // "3.5 miles"
 * ```
 */
export function calculateDistanceFormatted(
  from: Coordinates,
  to: Coordinates,
  unit: "miles" | "km" = "miles"
): string {
  const distance = calculateDistance(from, to, unit);

  // Return fallback if distance is invalid
  if (!Number.isFinite(distance)) {
    return "—";
  }

  const unitLabel = unit === "miles" ? "miles" : "km";
  return `${distance.toFixed(1)} ${unitLabel}`;
}

/**
 * Helper function for miles calculation (convenience wrapper)
 * @param from Starting coordinates
 * @param to Destination coordinates
 * @returns Distance in miles, or NaN if inputs are invalid
 */
export function calculateDistanceInMiles(
  from: Coordinates,
  to: Coordinates
): number {
  return calculateDistance(from, to, "miles");
}

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use calculateDistance(from, to, unit) with Coordinates instead
 */
export function calculateDistanceLegacy(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: "miles" | "km" | "meters" = "miles"
): number {
  return calculateDistanceRaw(lat1, lng1, lat2, lng2, unit);
}

/**
 * Helper function for radians conversion
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance in miles between two coordinate pairs, returning null for
 * missing or invalid inputs. Matches the signature from the legacy
 * utils/distance.ts module.
 *
 * @param a Starting coordinates (optional/nullable)
 * @param b Destination coordinates (optional/nullable)
 * @returns Distance in miles, or null if either coordinate is missing/invalid
 */
export function milesBetween(
  a?: Coordinates | null,
  b?: Coordinates | null
): number | null {
  if (!a || !b) return null;

  const { lat: lat1, lon: lon1 } = a;
  const { lat: lat2, lon: lon2 } = b;

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const haversine =
    sinHalfDLat * sinHalfDLat +
    Math.cos(radLat1) * Math.cos(radLat2) * sinHalfDLon * sinHalfDLon;

  const arc = 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));

  return EARTH_RADIUS_MI * arc;
}

/**
 * Format a distance in miles for display. Matches the legacy formatMiles
 * signature from utils/distance.ts.
 *
 * @param miles Distance in miles
 * @param digits Decimal precision (default 1)
 * @returns Formatted string, e.g. "3.5 miles away", or "—" for invalid input
 */
export function formatMiles(miles?: number, digits = 1): string {
  if (typeof miles !== "number" || !Number.isFinite(miles) || miles < 0) {
    return "—";
  }

  if (miles === 0) {
    return "0.0 miles away";
  }

  if (miles < 0.05) {
    return "<0.1 miles away";
  }

  const factor = 10 ** Math.max(0, digits);
  const rounded = Math.round(miles * factor) / factor;

  return `${rounded.toFixed(digits)} miles away`;
}

/**
 * Format distance for display in UI components
 *
 * @param distanceMiles Distance in miles (undefined/null/0/negative returns null)
 * @param variant Display variant:
 *   - 'compact': "3.5 mi away" or "15 mi away" (decimal for <10, rounded for >=10)
 *   - 'full': "6 miles away" (always rounded, full word)
 * @returns Formatted string or null if distance is invalid/zero
 *
 * @example
 * ```ts
 * formatDistanceDisplay(3.5, 'compact')  // "3.5 mi away"
 * formatDistanceDisplay(15.7, 'compact') // "16 mi away"
 * formatDistanceDisplay(3.5, 'full')     // "4 miles away"
 * formatDistanceDisplay(0, 'compact')    // null
 * formatDistanceDisplay(undefined)       // null
 * ```
 */
export function formatDistanceDisplay(
  distanceMiles: number | undefined | null,
  variant: "compact" | "full" = "compact"
): string | null {
  if (
    distanceMiles === undefined ||
    distanceMiles === null ||
    !Number.isFinite(distanceMiles) ||
    distanceMiles <= 0
  ) {
    return null;
  }

  if (variant === "compact") {
    // Compact: use decimal for nearby (<10 mi), round for distant
    const formatted =
      distanceMiles < 10
        ? distanceMiles.toFixed(1)
        : String(Math.round(distanceMiles));
    return `${formatted} mi away`;
  }

  // Full: always round, use full word
  return `${Math.round(distanceMiles)} miles away`;
}
