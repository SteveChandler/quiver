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
 * Flexible coordinate input shapes accepted across the codebase.
 *
 * This exists to support gradual migration away from `lng`/mixed naming.
 * Prefer producing canonical `{ lat, lon }` as early as possible.
 */
export type CoordinatesInput = {
  // Canonical
  lat?: unknown;
  lon?: unknown;

  // Legacy / verbose variants
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  center_lat?: unknown;
  center_lng?: unknown;
  // Occasionally appears in older code / external integrations
  center_lon?: unknown;
};

export type NormalizeCoordinatesOptions = {
  /** Included in warning messages to help trace call sites. */
  context?: string;
  /**
   * If true (default), log development warnings when legacy keys are used
   * or when conflicting keys are present.
   */
  warnOnLegacyKeys?: boolean;
};

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function warnDev(message: string) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
}

function pickFirstNumericKey(
  input: CoordinatesInput,
  keys: Array<keyof CoordinatesInput>
): { key: keyof CoordinatesInput; value: number } | null {
  for (const key of keys) {
    const value = coerceFiniteNumber(input[key]);
    if (value !== null) return { key, value };
  }
  return null;
}

function listNumericKeys(
  input: CoordinatesInput,
  keys: Array<keyof CoordinatesInput>
): Array<{ key: keyof CoordinatesInput; value: number }> {
  const results: Array<{ key: keyof CoordinatesInput; value: number }> = [];
  for (const key of keys) {
    const value = coerceFiniteNumber(input[key]);
    if (value !== null) results.push({ key, value });
  }
  return results;
}

/**
 * Normalize any supported coordinate input into canonical `{ lat, lon }`.
 *
 * - Accepts `{ lat, lon }` (canonical)
 * - Accepts `{ lat, lng }` (legacy)
 * - Accepts `{ latitude, longitude }` (verbose)
 * - Accepts `{ center_lat, center_lng }` (DB legacy)
 *
 * In development, warns when legacy keys are used or when conflicting keys are present.
 */
export function normalizeCoordinates(
  input: unknown,
  options: NormalizeCoordinatesOptions = {}
): Coordinates | null {
  if (!input || typeof input !== 'object') return null;

  const obj = input as CoordinatesInput;
  const { context, warnOnLegacyKeys = true } = options;

  const latCandidates = listNumericKeys(obj, ['lat', 'latitude', 'center_lat']);
  const lonCandidates = listNumericKeys(obj, [
    'lon',
    'lng',
    'longitude',
    'center_lng',
    'center_lon',
  ]);

  const pickedLat = pickFirstNumericKey(obj, ['lat', 'latitude', 'center_lat']);
  const pickedLon = pickFirstNumericKey(obj, [
    'lon',
    'lng',
    'longitude',
    'center_lng',
    'center_lon',
  ]);

  if (!pickedLat || !pickedLon) return null;

  if (warnOnLegacyKeys && process.env.NODE_ENV === 'development') {
    const prefix = context ? `[normalizeCoordinates:${context}] ` : '[normalizeCoordinates] ';

    const usedLegacyKey =
      pickedLat.key !== 'lat' || pickedLon.key !== 'lon';

    if (usedLegacyKey) {
      warnDev(
        `${prefix}Using legacy coordinate keys (lat via "${String(pickedLat.key)}", lon via "${String(pickedLon.key)}"). Prefer { lat, lon }.`
      );
    }

    if (latCandidates.length > 1) {
      const values = latCandidates.map((c) => `${String(c.key)}=${c.value}`).join(', ');
      warnDev(`${prefix}Multiple latitude keys provided; using "${String(pickedLat.key)}". (${values})`);
    }

    if (lonCandidates.length > 1) {
      const values = lonCandidates.map((c) => `${String(c.key)}=${c.value}`).join(', ');
      warnDev(`${prefix}Multiple longitude keys provided; using "${String(pickedLon.key)}". (${values})`);
    }
  }

  return { lat: pickedLat.value, lon: pickedLon.value };
}

/**
 * Convenience helper to convert `{ lat, lon }` into `{ latitude, longitude }`.
 */
export function toCoordinatesVerbose(coords: Coordinates): CoordinatesVerbose {
  return { latitude: coords.lat, longitude: coords.lon };
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
