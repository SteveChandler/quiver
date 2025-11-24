/**
 * Utility functions for branded coordinate types
 *
 * This module provides helper functions for working with branded coordinates,
 * including safe construction, distance calculations, and transformations.
 *
 * @see /lib/types/branded-coordinates.ts for type definitions
 * @see /docs/BRANDED_COORDINATES.md for usage guide
 * @module branded-coordinate-utils
 */

import type {
  Latitude,
  Longitude,
  BrandedCoordinates,
} from '@/lib/types/branded-coordinates';
import {
  latitude,
  longitude,
  brandedCoordinates,
  safeLat,
  safeLon,
  safeCoordinates,
  toBranded,
  fromBranded,
} from '@/lib/types/branded-coordinates';
import type { Coordinates } from '@/lib/types/coordinates';
import { calculateDistance } from '@/lib/utils/distance-utils';

// Re-export branded type constructors for convenience
export {
  latitude,
  longitude,
  brandedCoordinates,
  safeLat,
  safeLon,
  safeCoordinates,
  toBranded,
  fromBranded,
};

// Re-export branded types
export type { Latitude, Longitude, BrandedCoordinates };

// ============================================================================
// DISTANCE CALCULATIONS
// ============================================================================

/**
 * Calculate distance between two branded coordinate points
 *
 * Uses the Haversine formula for great-circle distance calculation.
 * Branded types ensure latitude and longitude can't be swapped.
 *
 * @param from - Starting coordinates (branded)
 * @param to - Destination coordinates (branded)
 * @param unit - Unit for result ('miles' | 'km' | 'meters')
 * @returns Distance in specified unit
 *
 * @example
 * ```ts
 * const oceanBeach: BrandedCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 *
 * const pacificBeach: BrandedCoordinates = {
 *   lat: latitude(32.80),
 *   lon: longitude(-117.24),
 * };
 *
 * const dist = calculateBrandedDistance(oceanBeach, pacificBeach, 'miles');
 * console.log(`${dist.toFixed(1)} miles`);
 * ```
 */
export function calculateBrandedDistance(
  from: BrandedCoordinates,
  to: BrandedCoordinates,
  unit: 'miles' | 'km' | 'meters' = 'miles'
): number {
  // Convert branded to plain coordinates for calculation
  // Brands are erased at runtime, so this is safe
  const fromPlain: Coordinates = {
    lat: from.lat as number,
    lon: from.lon as number,
  };

  const toPlain: Coordinates = {
    lat: to.lat as number,
    lon: to.lon as number,
  };

  return calculateDistance(fromPlain, toPlain, unit);
}

/**
 * Calculate distance and return formatted string
 *
 * @param from - Starting coordinates (branded)
 * @param to - Destination coordinates (branded)
 * @param unit - Unit for result ('miles' | 'km')
 * @returns Formatted distance string, or "—" if calculation fails
 *
 * @example
 * ```ts
 * const formatted = calculateBrandedDistanceFormatted(beach1, beach2, 'miles');
 * console.log(formatted); // "3.5 miles"
 * ```
 */
export function calculateBrandedDistanceFormatted(
  from: BrandedCoordinates,
  to: BrandedCoordinates,
  unit: 'miles' | 'km' = 'miles'
): string {
  const distance = calculateBrandedDistance(from, to, unit);

  if (!Number.isFinite(distance)) {
    return '—';
  }

  const unitLabel = unit === 'miles' ? 'miles' : 'km';
  return `${distance.toFixed(1)} ${unitLabel}`;
}

// ============================================================================
// COORDINATE TRANSFORMATIONS
// ============================================================================

/**
 * Transform branded coordinates to Mapbox format [lng, lat]
 *
 * WARNING: Mapbox uses [longitude, latitude] order - longitude first!
 * Branded types help prevent accidentally swapping these.
 *
 * @param coords - Branded coordinates
 * @returns Mapbox coordinate array [longitude, latitude]
 *
 * @example
 * ```ts
 * const coords: BrandedCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 *
 * const mapboxCoords = toBrandedMapboxArray(coords);
 * // [-117.25, 32.75] - longitude first!
 * ```
 */
export function toBrandedMapboxArray(
  coords: BrandedCoordinates
): [longitude: number, latitude: number] {
  return [coords.lon as number, coords.lat as number];
}

/**
 * Transform Mapbox format to branded coordinates
 *
 * @param arr - Mapbox coordinate array [longitude, latitude]
 * @returns Branded coordinates
 *
 * @example
 * ```ts
 * const mapboxCoords: [number, number] = [-117.25, 32.75];
 * const branded = fromBrandedMapboxArray(mapboxCoords);
 * ```
 */
export function fromBrandedMapboxArray(
  arr: [longitude: number, latitude: number]
): BrandedCoordinates {
  return {
    lat: latitude(arr[1]),
    lon: longitude(arr[0]),
  };
}

/**
 * Transform Mapbox LngLat object to branded coordinates
 *
 * @param lngLat - Mapbox LngLat object
 * @returns Branded coordinates
 *
 * @example
 * ```ts
 * const lngLat = map.getCenter(); // { lng: -117.25, lat: 32.75 }
 * const branded = fromBrandedMapboxLngLat(lngLat);
 * ```
 */
export function fromBrandedMapboxLngLat(lngLat: {
  lng: number;
  lat: number;
}): BrandedCoordinates {
  return {
    lat: latitude(lngLat.lat),
    lon: longitude(lngLat.lng),
  };
}

/**
 * Transform branded coordinates to Mapbox LngLat object
 *
 * @param coords - Branded coordinates
 * @returns Mapbox LngLat object
 *
 * @example
 * ```ts
 * const coords: BrandedCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 *
 * const lngLat = toBrandedMapboxLngLat(coords);
 * // { lng: -117.25, lat: 32.75 }
 * ```
 */
export function toBrandedMapboxLngLat(coords: BrandedCoordinates): {
  lng: number;
  lat: number;
} {
  return {
    lng: coords.lon as number,
    lat: coords.lat as number,
  };
}

// ============================================================================
// BOUNDS AND BOUNDING BOX
// ============================================================================

/**
 * Branded bounding box type
 */
export interface BrandedBoundingBox {
  north: Latitude;
  south: Latitude;
  east: Longitude;
  west: Longitude;
}

/**
 * Calculate bounding box from array of branded coordinates
 *
 * @param coords - Array of branded coordinates
 * @returns Bounding box or null if array is empty
 *
 * @example
 * ```ts
 * const beaches = [
 *   { lat: latitude(32.75), lon: longitude(-117.25) },
 *   { lat: latitude(32.80), lon: longitude(-117.24) },
 * ];
 *
 * const bbox = calculateBrandedBoundingBox(beaches);
 * // { north: 32.80, south: 32.75, east: -117.24, west: -117.25 }
 * ```
 */
export function calculateBrandedBoundingBox(
  coords: BrandedCoordinates[]
): BrandedBoundingBox | null {
  if (coords.length === 0) {
    return null;
  }

  let north = coords[0].lat as number;
  let south = coords[0].lat as number;
  let east = coords[0].lon as number;
  let west = coords[0].lon as number;

  for (const coord of coords) {
    const lat = coord.lat as number;
    const lon = coord.lon as number;

    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lon < west) west = lon;
  }

  return {
    north: latitude(north),
    south: latitude(south),
    east: longitude(east),
    west: longitude(west),
  };
}

/**
 * Check if a coordinate is within a bounding box
 *
 * @param coord - Coordinate to check
 * @param bbox - Bounding box
 * @returns True if coordinate is within bounds
 *
 * @example
 * ```ts
 * const beach: BrandedCoordinates = {
 *   lat: latitude(32.77),
 *   lon: longitude(-117.245),
 * };
 *
 * const bbox = {
 *   north: latitude(32.80),
 *   south: latitude(32.75),
 *   east: longitude(-117.24),
 *   west: longitude(-117.25),
 * };
 *
 * const isInside = isCoordinateInBoundingBox(beach, bbox); // true
 * ```
 */
export function isCoordinateInBoundingBox(
  coord: BrandedCoordinates,
  bbox: BrandedBoundingBox
): boolean {
  const lat = coord.lat as number;
  const lon = coord.lon as number;
  const north = bbox.north as number;
  const south = bbox.south as number;
  const east = bbox.east as number;
  const west = bbox.west as number;

  return lat >= south && lat <= north && lon >= west && lon <= east;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and brand coordinate values from API input
 *
 * Use this for validating user input or API requests.
 *
 * @param input - Object with lat and lon properties (unknown types)
 * @returns Result object with branded coordinates or error message
 *
 * @example
 * ```ts
 * const result = validateAndBrandCoordinates(req.body);
 *
 * if (!result.valid) {
 *   return res.status(400).json({ error: result.error });
 * }
 *
 * const coords: BrandedCoordinates = result.coordinates;
 * // coords is now guaranteed to be valid and branded
 * ```
 */
export function validateAndBrandCoordinates(input: {
  lat: unknown;
  lon: unknown;
}):
  | { valid: true; coordinates: BrandedCoordinates }
  | { valid: false; error: string } {
  const { lat: latValue, lon: lonValue } = input;

  // Validate latitude
  if (typeof latValue !== 'number') {
    return {
      valid: false,
      error: `Invalid latitude: must be a number, got ${typeof latValue}`,
    };
  }

  if (!Number.isFinite(latValue)) {
    return {
      valid: false,
      error: 'Invalid latitude: must be a finite number',
    };
  }

  if (latValue < -90 || latValue > 90) {
    return {
      valid: false,
      error: `Invalid latitude: ${latValue} is out of range (-90 to 90)`,
    };
  }

  // Validate longitude
  if (typeof lonValue !== 'number') {
    return {
      valid: false,
      error: `Invalid longitude: must be a number, got ${typeof lonValue}`,
    };
  }

  if (!Number.isFinite(lonValue)) {
    return {
      valid: false,
      error: 'Invalid longitude: must be a finite number',
    };
  }

  if (lonValue < -180 || lonValue > 180) {
    return {
      valid: false,
      error: `Invalid longitude: ${lonValue} is out of range (-180 to 180)`,
    };
  }

  // Brand the coordinates
  return {
    valid: true,
    coordinates: {
      lat: latitude(latValue),
      lon: longitude(lonValue),
    },
  };
}

/**
 * Batch validate and brand multiple coordinates
 *
 * @param inputs - Array of coordinate objects
 * @returns Result with valid coordinates and errors
 *
 * @example
 * ```ts
 * const result = batchValidateAndBrand([
 *   { lat: 32.75, lon: -117.25 },
 *   { lat: 91, lon: -117.25 },      // Invalid
 *   { lat: 32.80, lon: -117.24 },
 * ]);
 *
 * console.log(result.valid);      // [coords1, coords3]
 * console.log(result.errors);     // [{ index: 1, error: "..." }]
 * ```
 */
export function batchValidateAndBrand(
  inputs: Array<{ lat: unknown; lon: unknown }>
): {
  valid: BrandedCoordinates[];
  errors: Array<{ index: number; error: string }>;
} {
  const valid: BrandedCoordinates[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  inputs.forEach((input, index) => {
    const result = validateAndBrandCoordinates(input);

    if (result.valid) {
      valid.push(result.coordinates);
    } else {
      errors.push({ index, error: result.error });
    }
  });

  return { valid, errors };
}

// ============================================================================
// SORTING AND FILTERING
// ============================================================================

/**
 * Sort coordinates by distance from a reference point
 *
 * @param coords - Array of branded coordinates to sort
 * @param reference - Reference point to measure distance from
 * @param ascending - Sort ascending (nearest first) or descending
 * @returns Sorted array with distance metadata
 *
 * @example
 * ```ts
 * const userLocation: BrandedCoordinates = {
 *   lat: latitude(32.77),
 *   lon: longitude(-117.245),
 * };
 *
 * const beaches = [...]; // Array of BrandedCoordinates
 *
 * const sorted = sortByDistance(beaches, userLocation);
 * sorted.forEach(item => {
 *   console.log(`${item.distance.toFixed(1)} miles away`);
 * });
 * ```
 */
export function sortByDistance(
  coords: BrandedCoordinates[],
  reference: BrandedCoordinates,
  ascending: boolean = true
): Array<{ coordinates: BrandedCoordinates; distance: number }> {
  const withDistances = coords.map((coord) => ({
    coordinates: coord,
    distance: calculateBrandedDistance(reference, coord, 'miles'),
  }));

  withDistances.sort((a, b) =>
    ascending ? a.distance - b.distance : b.distance - a.distance
  );

  return withDistances;
}

/**
 * Filter coordinates within a maximum distance from reference point
 *
 * @param coords - Array of branded coordinates to filter
 * @param reference - Reference point
 * @param maxDistance - Maximum distance in specified unit
 * @param unit - Distance unit ('miles' | 'km' | 'meters')
 * @returns Filtered array of coordinates within range
 *
 * @example
 * ```ts
 * const nearby = filterByDistance(allBeaches, userLocation, 10, 'miles');
 * // Returns only beaches within 10 miles
 * ```
 */
export function filterByDistance(
  coords: BrandedCoordinates[],
  reference: BrandedCoordinates,
  maxDistance: number,
  unit: 'miles' | 'km' | 'meters' = 'miles'
): BrandedCoordinates[] {
  return coords.filter((coord) => {
    const distance = calculateBrandedDistance(reference, coord, unit);
    return distance <= maxDistance;
  });
}
