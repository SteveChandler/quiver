/**
 * Centralized coordinate type definitions and utilities
 *
 * NAMING CONVENTION:
 * - Use 'lat' and 'lon' (NOT 'lng')
 * - Exception: Mapbox APIs use 'LngLat' (third-party convention)
 *
 * BRANDED TYPES:
 * - For compile-time safety against coordinate swaps, use BrandedCoordinates
 * - See /docs/BRANDED_COORDINATES.md for migration guide
 *
 * @see /docs/COORDINATE_CONVENTIONS.md
 * @see /docs/BRANDED_COORDINATES.md
 */

/**
 * Core coordinate type for the application
 * Uses 'lon' (longitude) to match BeachCoordinates convention
 */
export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Verbose coordinate type for explicit contexts
 * Useful when interfacing with external APIs or verbose data structures
 */
export interface CoordinatesVerbose {
  latitude: number;
  longitude: number;
}

/**
 * Mapbox coordinate type (third-party integration)
 * NOTE: Mapbox uses [longitude, latitude] order - longitude first!
 *
 * @example
 * ```ts
 * const mapboxCoords: MapboxCoordinates = [-117.25, 32.75]; // [lon, lat]
 * ```
 */
export type MapboxCoordinates = [longitude: number, latitude: number];

/**
 * Database coordinate type (PostGIS legacy)
 * Uses 'center_lng' naming from existing database schema
 */
export interface DatabaseCoordinates {
  center_lat: number;
  center_lng: number; // Legacy naming from PostGIS functions
}

/**
 * Type guard to check if an object is a valid Coordinates instance
 *
 * @example
 * ```ts
 * const maybeCoords = { lat: 32.75, lon: -117.25 };
 * if (isCoordinates(maybeCoords)) {
 *   // TypeScript knows this is Coordinates
 *   console.log(maybeCoords.lat, maybeCoords.lon);
 * }
 * ```
 */
export function isCoordinates(obj: unknown): obj is Coordinates {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'lat' in obj &&
    'lon' in obj &&
    typeof (obj as any).lat === 'number' &&
    typeof (obj as any).lon === 'number'
  );
}

/**
 * Type guard to check if an object is a valid CoordinatesVerbose instance
 *
 * @example
 * ```ts
 * const maybeCoords = { latitude: 32.75, longitude: -117.25 };
 * if (isCoordinatesVerbose(maybeCoords)) {
 *   // TypeScript knows this is CoordinatesVerbose
 *   console.log(maybeCoords.latitude, maybeCoords.longitude);
 * }
 * ```
 */
export function isCoordinatesVerbose(obj: unknown): obj is CoordinatesVerbose {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'latitude' in obj &&
    'longitude' in obj &&
    typeof (obj as any).latitude === 'number' &&
    typeof (obj as any).longitude === 'number'
  );
}

/**
 * Type guard to check if an object has lng/lat properties (legacy format)
 * Used to detect and migrate from the old naming convention
 *
 * @example
 * ```ts
 * const oldFormat = { lat: 32.75, lng: -117.25 };
 * if (isLegacyLngLatFormat(oldFormat)) {
 *   // Convert to new format
 *   const newFormat: Coordinates = { lat: oldFormat.lat, lon: oldFormat.lng };
 * }
 * ```
 */
export function isLegacyLngLatFormat(obj: unknown): obj is { lat: number; lng: number } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'lat' in obj &&
    'lng' in obj &&
    typeof (obj as any).lat === 'number' &&
    typeof (obj as any).lng === 'number'
  );
}

// ============================================================================
// BRANDED TYPES (for compile-time coordinate swap prevention)
// ============================================================================

/**
 * Re-export branded coordinate types for compile-time safety
 *
 * Use these when you need to prevent accidental coordinate swaps at compile time.
 * Regular `Coordinates` type (above) uses plain `number` types, which allows swaps.
 * Branded types make swaps impossible via TypeScript's type system.
 *
 * @see /lib/types/branded-coordinates.ts for implementation
 * @see /docs/BRANDED_COORDINATES.md for usage guide
 *
 * @example
 * ```ts
 * import { BrandedCoordinates, latitude, longitude } from '@/lib/types/coordinates';
 *
 * // Compile-time safe coordinates
 * const coords: BrandedCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 *
 * // This would be a compile error:
 * const swapped: BrandedCoordinates = {
 *   lat: longitude(-117.25),  // ❌ Error: Longitude not assignable to Latitude
 *   lon: latitude(32.75),     // ❌ Error: Latitude not assignable to Longitude
 * };
 * ```
 */
export type {
  Latitude,
  Longitude,
  BrandedCoordinates,
} from './branded-coordinates';

export {
  latitude,
  longitude,
  brandedCoordinates,
  safeLat,
  safeLon,
  safeCoordinates,
  toBranded,
  fromBranded,
  isBrandedCoordinates,
} from './branded-coordinates';

/**
 * Coordinates with optional branded types
 * Use this when you want compile-time safety against swapped coordinates
 *
 * This is an alias for BrandedCoordinates for backward compatibility.
 *
 * @example
 * ```ts
 * import type { StrictCoordinates } from '@/lib/types/coordinates';
 * import { latitude, longitude } from '@/lib/types/coordinates';
 *
 * const coords: StrictCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 * ```
 */
export type StrictCoordinates = import('./branded-coordinates').BrandedCoordinates;
