/**
 * Distance calculation utilities using the Haversine formula
 *
 * This module provides functions for calculating the distance between two
 * geographic coordinates using the Haversine formula, which accounts for
 * the Earth's curvature.
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 * @module lib/utils/distance
 */

/** Earth's radius in meters */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Coordinate pair using short property names (lat/lon)
 * Follows project convention: use 'lon' NOT 'lng'
 *
 * @see /docs/COORDINATE_CONVENTIONS.md
 */
export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Convert degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula.
 *
 * The Haversine formula determines the great-circle distance between two points
 * on a sphere given their longitudes and latitudes. This is particularly useful
 * for calculating distances between geographic locations.
 *
 * @param lat1 - Latitude of first point in degrees (-90 to 90)
 * @param lon1 - Longitude of first point in degrees (-180 to 180)
 * @param lat2 - Latitude of second point in degrees (-90 to 90)
 * @param lon2 - Longitude of second point in degrees (-180 to 180)
 * @returns Distance in meters, or NaN if any input is invalid
 *
 * @example
 * ```ts
 * // Distance from Ocean Beach to Pacific Beach, San Diego
 * const distance = calculateDistanceMeters(32.75, -117.25, 32.80, -117.24);
 * console.log(`${distance.toFixed(0)} meters`); // ~5594 meters
 * ```
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
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

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate distance in kilometers between two geographic coordinates.
 *
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in kilometers, or NaN if any input is invalid
 *
 * @example
 * ```ts
 * const distanceKm = calculateDistanceKm(32.75, -117.25, 32.80, -117.24);
 * console.log(`${distanceKm.toFixed(2)} km`); // ~5.59 km
 * ```
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Calculate distance in miles between two geographic coordinates.
 *
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in miles, or NaN if any input is invalid
 *
 * @example
 * ```ts
 * const distanceMiles = calculateDistanceMiles(32.75, -117.25, 32.80, -117.24);
 * console.log(`${distanceMiles.toFixed(2)} miles`); // ~3.48 miles
 * ```
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // 1 kilometer = 0.621371 miles
  return calculateDistanceKm(lat1, lon1, lat2, lon2) * 0.621371;
}

/**
 * Check if two coordinates are within a specified distance.
 *
 * Useful for proximity checks, geofencing, or finding nearby locations.
 *
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @param maxDistanceMeters - Maximum allowed distance in meters
 * @returns true if the distance is less than or equal to maxDistanceMeters, false otherwise
 *
 * @example
 * ```ts
 * // Check if two points are within 5km of each other
 * const isNearby = isWithinDistance(32.75, -117.25, 32.80, -117.24, 5000);
 * console.log(isNearby); // true (they are ~5.6km apart, so false for 5km)
 *
 * const isNearby10k = isWithinDistance(32.75, -117.25, 32.80, -117.24, 10000);
 * console.log(isNearby10k); // true
 * ```
 */
export function isWithinDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  maxDistanceMeters: number
): boolean {
  const distance = calculateDistanceMeters(lat1, lon1, lat2, lon2);

  // Handle invalid inputs gracefully
  if (!Number.isFinite(distance) || !Number.isFinite(maxDistanceMeters)) {
    return false;
  }

  return distance <= maxDistanceMeters;
}

/**
 * Calculate distance between two Coordinates objects.
 *
 * Convenience function that accepts Coordinates interface instead of
 * individual lat/lon parameters.
 *
 * @param coord1 - First coordinate point
 * @param coord2 - Second coordinate point
 * @returns Distance in meters, or NaN if any input is invalid
 *
 * @example
 * ```ts
 * const oceanBeach: Coordinates = { lat: 32.75, lon: -117.25 };
 * const pacificBeach: Coordinates = { lat: 32.80, lon: -117.24 };
 *
 * const distance = calculateDistanceBetweenCoords(oceanBeach, pacificBeach);
 * console.log(`${distance.toFixed(0)} meters`); // ~5594 meters
 * ```
 */
export function calculateDistanceBetweenCoords(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  // Defensive null/undefined check
  if (!coord1 || !coord2) {
    return NaN;
  }
  return calculateDistanceMeters(coord1.lat, coord1.lon, coord2.lat, coord2.lon);
}

/**
 * Calculate distance between two Coordinates objects in kilometers.
 *
 * @param coord1 - First coordinate point
 * @param coord2 - Second coordinate point
 * @returns Distance in kilometers, or NaN if any input is invalid
 *
 * @example
 * ```ts
 * const from: Coordinates = { lat: 32.75, lon: -117.25 };
 * const to: Coordinates = { lat: 32.80, lon: -117.24 };
 *
 * const distanceKm = calculateDistanceBetweenCoordsKm(from, to);
 * console.log(`${distanceKm.toFixed(2)} km`);
 * ```
 */
export function calculateDistanceBetweenCoordsKm(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  return calculateDistanceBetweenCoords(coord1, coord2) / 1000;
}

/**
 * Check if two Coordinates objects are within a specified distance.
 *
 * @param coord1 - First coordinate point
 * @param coord2 - Second coordinate point
 * @param maxDistanceMeters - Maximum allowed distance in meters
 * @returns true if within distance, false otherwise
 *
 * @example
 * ```ts
 * const home: Coordinates = { lat: 32.75, lon: -117.25 };
 * const beach: Coordinates = { lat: 32.76, lon: -117.25 };
 *
 * if (areCoordsWithinDistance(home, beach, 2000)) {
 *   console.log('Beach is within 2km!');
 * }
 * ```
 */
export function areCoordsWithinDistance(
  coord1: Coordinates,
  coord2: Coordinates,
  maxDistanceMeters: number
): boolean {
  if (!coord1 || !coord2) {
    return false;
  }
  return isWithinDistance(
    coord1.lat,
    coord1.lon,
    coord2.lat,
    coord2.lon,
    maxDistanceMeters
  );
}

/**
 * Find the closest coordinate from an array to a reference point.
 *
 * @param reference - The reference coordinate to measure from
 * @param candidates - Array of candidate coordinates to search
 * @returns The closest coordinate and its distance in meters, or null if no candidates
 *
 * @example
 * ```ts
 * const myLocation: Coordinates = { lat: 32.75, lon: -117.25 };
 * const beaches: Coordinates[] = [
 *   { lat: 32.80, lon: -117.24 },
 *   { lat: 32.72, lon: -117.26 },
 *   { lat: 32.85, lon: -117.28 },
 * ];
 *
 * const closest = findClosestCoordinate(myLocation, beaches);
 * if (closest) {
 *   console.log(`Closest beach is ${closest.distance.toFixed(0)}m away`);
 * }
 * ```
 */
export function findClosestCoordinate(
  reference: Coordinates,
  candidates: Coordinates[]
): { coordinate: Coordinates; distance: number } | null {
  if (!reference || !candidates || candidates.length === 0) {
    return null;
  }

  let closest: Coordinates | null = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    if (!candidate) continue;

    const distance = calculateDistanceBetweenCoords(reference, candidate);
    if (Number.isFinite(distance) && distance < minDistance) {
      minDistance = distance;
      closest = candidate;
    }
  }

  if (!closest || !Number.isFinite(minDistance)) {
    return null;
  }

  return { coordinate: closest, distance: minDistance };
}
