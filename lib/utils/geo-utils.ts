/**
 * Geographic utility functions for distance calculations and direction conversions.
 */

/** Earth's radius in kilometers */
export const EARTH_RADIUS_KM = 6371;

/** Earth's radius in miles */
export const EARTH_RADIUS_MI = 3958.8;

/**
 * Calculate distance between two coordinates using the Haversine formula.
 *
 * @param lat1 - First point latitude
 * @param lon1 - First point longitude
 * @param lat2 - Second point latitude
 * @param lon2 - Second point longitude
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert degrees to cardinal direction (N, NE, E, SE, S, SW, W, NW).
 * Uses 8-point compass (45° increments).
 *
 * @param degrees - Angle in degrees (0-360)
 * @returns Cardinal direction abbreviation
 */
export function degreesToCardinal(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Convert degrees to cardinal direction with higher precision (16-point compass).
 * Uses 16-point compass (22.5° increments) for more precise direction reporting.
 *
 * @param degrees - Angle in degrees (0-360)
 * @returns Cardinal direction abbreviation (N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW)
 *
 * @example
 * degreeToCardinal(0) // "N"
 * degreeToCardinal(22.5) // "NNE"
 * degreeToCardinal(45) // "NE"
 * degreeToCardinal(337.5) // "NNW"
 */
export function degreeToCardinal(degrees: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}
