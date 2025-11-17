/**
 * Coordinate transformation utilities
 *
 * This module provides functions to safely convert between different
 * coordinate formats used throughout the application.
 *
 * @see /docs/COORDINATE_CONVENTIONS.md
 */

import type {
  Coordinates,
  CoordinatesVerbose,
  MapboxCoordinates,
  DatabaseCoordinates,
} from '@/lib/types/coordinates';

/**
 * Transforms database coordinates (center_lat/center_lng) to app coordinates (lat/lon)
 *
 * @example
 * ```ts
 * const beach = await getBeachFromDB(); // { center_lat: 32.75, center_lng: -117.25 }
 * const coords = fromDatabaseCoordinates(beach); // { lat: 32.75, lon: -117.25 }
 * ```
 */
export function fromDatabaseCoordinates(db: DatabaseCoordinates): Coordinates {
  return {
    lat: db.center_lat,
    lon: db.center_lng,
  };
}

/**
 * Transforms app coordinates (lat/lon) to database coordinates (center_lat/center_lng)
 *
 * @example
 * ```ts
 * const coords: Coordinates = { lat: 32.75, lon: -117.25 };
 * const dbCoords = toDatabaseCoordinates(coords);
 * // { center_lat: 32.75, center_lng: -117.25 }
 * ```
 */
export function toDatabaseCoordinates(coords: Coordinates): DatabaseCoordinates {
  return {
    center_lat: coords.lat,
    center_lng: coords.lon,
  };
}

/**
 * Transforms app coordinates to Mapbox format [lng, lat]
 * NOTE: Mapbox uses longitude first!
 *
 * @example
 * ```ts
 * const coords: Coordinates = { lat: 32.75, lon: -117.25 };
 * const mapboxCoords = toMapboxCoordinates(coords);
 * // [-117.25, 32.75] - longitude first!
 * ```
 */
export function toMapboxCoordinates(coords: Coordinates): MapboxCoordinates {
  return [coords.lon, coords.lat];
}

/**
 * Transforms Mapbox array format [lng, lat] to app coordinates
 *
 * @example
 * ```ts
 * const mapboxArray: MapboxCoordinates = [-117.25, 32.75];
 * const coords = fromMapboxArray(mapboxArray);
 * // { lat: 32.75, lon: -117.25 }
 * ```
 */
export function fromMapboxArray(arr: MapboxCoordinates): Coordinates {
  return {
    lat: arr[1],
    lon: arr[0],
  };
}

/**
 * Transforms Mapbox LngLat object to app coordinates
 *
 * @example
 * ```ts
 * const lngLat = map.getCenter(); // { lng: -117.25, lat: 32.75 }
 * const coords = fromMapboxLngLat(lngLat);
 * // { lat: 32.75, lon: -117.25 }
 * ```
 */
export function fromMapboxLngLat(lngLat: { lng: number; lat: number }): Coordinates {
  return {
    lat: lngLat.lat,
    lon: lngLat.lng,
  };
}

/**
 * Transforms app coordinates to Mapbox LngLat object format
 *
 * @example
 * ```ts
 * const coords: Coordinates = { lat: 32.75, lon: -117.25 };
 * const lngLat = toMapboxLngLat(coords);
 * // { lng: -117.25, lat: 32.75 }
 * ```
 */
export function toMapboxLngLat(coords: Coordinates): { lng: number; lat: number } {
  return {
    lng: coords.lon,
    lat: coords.lat,
  };
}

/**
 * Transforms verbose coordinates to short form
 *
 * @example
 * ```ts
 * const verbose: CoordinatesVerbose = { latitude: 32.75, longitude: -117.25 };
 * const coords = fromVerboseCoordinates(verbose);
 * // { lat: 32.75, lon: -117.25 }
 * ```
 */
export function fromVerboseCoordinates(verbose: CoordinatesVerbose): Coordinates {
  return {
    lat: verbose.latitude,
    lon: verbose.longitude,
  };
}

/**
 * Transforms short coordinates to verbose form
 *
 * @example
 * ```ts
 * const coords: Coordinates = { lat: 32.75, lon: -117.25 };
 * const verbose = toVerboseCoordinates(coords);
 * // { latitude: 32.75, longitude: -117.25 }
 * ```
 */
export function toVerboseCoordinates(coords: Coordinates): CoordinatesVerbose {
  return {
    latitude: coords.lat,
    longitude: coords.lon,
  };
}

/**
 * Converts legacy lng/lat format to standardized lon/lat format
 * Used for migrating old code that uses 'lng' instead of 'lon'
 *
 * @example
 * ```ts
 * const legacy = { lat: 32.75, lng: -117.25 }; // Old format
 * const coords = fromLegacyLngLat(legacy);
 * // { lat: 32.75, lon: -117.25 } - New format
 * ```
 */
export function fromLegacyLngLat(legacy: { lat: number; lng: number }): Coordinates {
  return {
    lat: legacy.lat,
    lon: legacy.lng,
  };
}

/**
 * Converts standardized coordinates to legacy lng/lat format
 * Only use when interfacing with legacy code that hasn't been migrated
 *
 * @deprecated Prefer updating legacy code to use Coordinates type
 * @example
 * ```ts
 * const coords: Coordinates = { lat: 32.75, lon: -117.25 };
 * const legacy = toLegacyLngLat(coords);
 * // { lat: 32.75, lng: -117.25 } - Legacy format
 * ```
 */
export function toLegacyLngLat(coords: Coordinates): { lat: number; lng: number } {
  return {
    lat: coords.lat,
    lng: coords.lon,
  };
}
