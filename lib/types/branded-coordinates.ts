/**
 * Branded types for compile-time coordinate safety
 *
 * These types prevent accidentally swapping latitude and longitude values.
 * They're zero-cost abstractions - no runtime overhead, brands are erased during compilation.
 *
 * ## Why Branded Types?
 *
 * Regular TypeScript types can't prevent semantic mistakes:
 * ```ts
 * function setLocation(lat: number, lon: number) { ... }
 * const lat = 32.75, lon = -117.25;
 * setLocation(lon, lat); // ❌ SWAPPED! But TypeScript allows it
 * ```
 *
 * Branded types make this a compile error:
 * ```ts
 * function setLocation(lat: Latitude, lon: Longitude) { ... }
 * const lat = latitude(32.75), lon = longitude(-117.25);
 * setLocation(lon, lat); // ❌ TypeScript error: types don't match!
 * ```
 *
 * ## When to Use
 *
 * - **High-risk APIs**: Endpoints that accept coordinate parameters
 * - **Critical calculations**: Distance, bearing, area calculations
 * - **Database interactions**: Queries involving geographic data
 * - **External integrations**: Third-party API calls with coordinates
 *
 * ## When NOT to Use
 *
 * - **Internal components**: If coordinate swaps are already prevented by structure
 * - **Temporary calculations**: Short-lived, local coordinate transformations
 * - **Performance-critical paths**: Though overhead is zero, conversion adds verbosity
 *
 * @see /docs/BRANDED_COORDINATES.md for migration guide
 * @module branded-coordinates
 */

// ============================================================================
// BRANDED TYPE DEFINITIONS
// ============================================================================

/**
 * Unique symbol for latitude branding
 * @internal
 */
declare const LatitudeBrand: unique symbol;

/**
 * Unique symbol for longitude branding
 * @internal
 */
declare const LongitudeBrand: unique symbol;

/**
 * Branded latitude type with compile-time safety
 *
 * Valid range: -90 to 90 degrees
 *
 * This type prevents accidental coordinate swaps at compile time.
 * Values are validated at runtime when created via `latitude()` constructor.
 *
 * @example
 * ```ts
 * const lat = latitude(32.75); // Type: Latitude
 * const lon = longitude(-117.25); // Type: Longitude
 *
 * // This won't compile - type mismatch:
 * const swapped: BrandedCoordinates = { lat: lon, lon: lat }; // ❌ Error
 *
 * // This compiles fine:
 * const correct: BrandedCoordinates = { lat, lon }; // ✅ OK
 * ```
 */
export type Latitude = number & { readonly [LatitudeBrand]: typeof LatitudeBrand };

/**
 * Branded longitude type with compile-time safety
 *
 * Valid range: -180 to 180 degrees
 *
 * This type prevents accidental coordinate swaps at compile time.
 * Values are validated at runtime when created via `longitude()` constructor.
 *
 * @example
 * ```ts
 * const lon = longitude(-117.25); // Type: Longitude
 *
 * function calculateBearing(from: Longitude, to: Longitude) { ... }
 * calculateBearing(lon, latitude(32.75)); // ❌ Error: Latitude not assignable to Longitude
 * ```
 */
export type Longitude = number & { readonly [LongitudeBrand]: typeof LongitudeBrand };

/**
 * Coordinate pair using branded types
 *
 * Provides compile-time guarantee that latitude and longitude can't be swapped.
 *
 * @example
 * ```ts
 * const coords: BrandedCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 *
 * // Can't accidentally swap:
 * const invalid: BrandedCoordinates = {
 *   lat: longitude(-117.25),  // ❌ Error
 *   lon: latitude(32.75),     // ❌ Error
 * };
 * ```
 */
export interface BrandedCoordinates {
  lat: Latitude;
  lon: Longitude;
}

// ============================================================================
// CONSTRUCTOR FUNCTIONS (with validation)
// ============================================================================

/**
 * Creates a branded Latitude with runtime validation
 *
 * @param value - Latitude value in degrees
 * @returns Branded Latitude type
 * @throws {Error} if value is out of range (-90 to 90)
 *
 * @example
 * ```ts
 * const lat = latitude(32.75); // ✅ Valid
 * const invalid = latitude(91); // ❌ Throws Error
 * ```
 */
export function latitude(value: number): Latitude {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid latitude: ${value}. Must be a finite number.`);
  }

  if (value < -90 || value > 90) {
    throw new Error(
      `Invalid latitude: ${value}. Must be between -90 and 90 degrees.`
    );
  }

  return value as Latitude;
}

/**
 * Creates a branded Longitude with runtime validation
 *
 * @param value - Longitude value in degrees
 * @returns Branded Longitude type
 * @throws {Error} if value is out of range (-180 to 180)
 *
 * @example
 * ```ts
 * const lon = longitude(-117.25); // ✅ Valid
 * const invalid = longitude(181); // ❌ Throws Error
 * ```
 */
export function longitude(value: number): Longitude {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid longitude: ${value}. Must be a finite number.`);
  }

  if (value < -180 || value > 180) {
    throw new Error(
      `Invalid longitude: ${value}. Must be between -180 and 180 degrees.`
    );
  }

  return value as Longitude;
}

/**
 * Creates branded coordinates from numbers with validation
 *
 * @param lat - Latitude value in degrees
 * @param lon - Longitude value in degrees
 * @returns Branded coordinate pair
 * @throws {Error} if either value is out of range
 *
 * @example
 * ```ts
 * const coords = brandedCoordinates(32.75, -117.25);
 * // Type: BrandedCoordinates
 * ```
 */
export function brandedCoordinates(lat: number, lon: number): BrandedCoordinates {
  return {
    lat: latitude(lat),
    lon: longitude(lon),
  };
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Creates branded coordinates from unbranded Coordinates object
 *
 * Validates the coordinates and brands them for type safety.
 *
 * @param coords - Plain coordinate object
 * @returns Branded coordinates
 * @throws {Error} if coordinates are invalid
 *
 * @example
 * ```ts
 * const plain: Coordinates = { lat: 32.75, lon: -117.25 };
 * const branded = toBranded(plain);
 * // Now branded prevents coordinate swaps
 * ```
 */
export function toBranded(coords: { lat: number; lon: number }): BrandedCoordinates {
  return brandedCoordinates(coords.lat, coords.lon);
}

/**
 * Converts branded coordinates back to plain numbers
 *
 * Use when interfacing with code that doesn't support branded types.
 *
 * @param coords - Branded coordinates
 * @returns Plain coordinate object
 *
 * @example
 * ```ts
 * const branded: BrandedCoordinates = {
 *   lat: latitude(32.75),
 *   lon: longitude(-117.25),
 * };
 *
 * const plain = fromBranded(branded);
 * // Type: { lat: number; lon: number }
 * ```
 */
export function fromBranded(coords: BrandedCoordinates): { lat: number; lon: number } {
  return {
    lat: coords.lat as number,
    lon: coords.lon as number,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an object is valid branded coordinates
 *
 * Note: This only validates structure and ranges at runtime.
 * It cannot verify the brand at runtime (brands are compile-time only).
 *
 * @param obj - Object to check
 * @returns True if object has valid coordinate structure
 *
 * @example
 * ```ts
 * const maybeCoords: unknown = { lat: 32.75, lon: -117.25 };
 *
 * if (isBrandedCoordinates(maybeCoords)) {
 *   // TypeScript knows this is BrandedCoordinates
 *   console.log(maybeCoords.lat, maybeCoords.lon);
 * }
 * ```
 */
export function isBrandedCoordinates(obj: unknown): obj is BrandedCoordinates {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Check structure
  if (!('lat' in candidate) || !('lon' in candidate)) {
    return false;
  }

  const { lat, lon } = candidate;

  // Check types
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }

  // Check ranges
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }

  if (lat < -90 || lat > 90) {
    return false;
  }

  if (lon < -180 || lon > 180) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a number is a valid latitude value
 *
 * Note: This validates the range but cannot verify the brand at runtime.
 *
 * @param value - Value to check
 * @returns True if value is in valid latitude range
 */
export function isValidLatitudeValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

/**
 * Type guard to check if a number is a valid longitude value
 *
 * Note: This validates the range but cannot verify the brand at runtime.
 *
 * @param value - Value to check
 * @returns True if value is in valid longitude range
 */
export function isValidLongitudeValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

// ============================================================================
// SAFE CONSTRUCTORS (non-throwing)
// ============================================================================

/**
 * Safely creates a branded Latitude, returning null on failure
 *
 * Use this when you want to handle invalid values gracefully without exceptions.
 *
 * @param value - Value to convert to Latitude
 * @returns Branded Latitude or null if invalid
 *
 * @example
 * ```ts
 * const lat = safeLat(userInput);
 * if (!lat) {
 *   return { error: 'Invalid latitude' };
 * }
 * // lat is now Latitude type
 * ```
 */
export function safeLat(value: unknown): Latitude | null {
  if (!isValidLatitudeValue(value)) {
    return null;
  }
  return value as Latitude;
}

/**
 * Safely creates a branded Longitude, returning null on failure
 *
 * Use this when you want to handle invalid values gracefully without exceptions.
 *
 * @param value - Value to convert to Longitude
 * @returns Branded Longitude or null if invalid
 *
 * @example
 * ```ts
 * const lon = safeLon(userInput);
 * if (!lon) {
 *   return { error: 'Invalid longitude' };
 * }
 * // lon is now Longitude type
 * ```
 */
export function safeLon(value: unknown): Longitude | null {
  if (!isValidLongitudeValue(value)) {
    return null;
  }
  return value as Longitude;
}

/**
 * Safely creates branded coordinates, returning null on failure
 *
 * Use this when you want to handle invalid coordinates gracefully.
 *
 * @param lat - Latitude value
 * @param lon - Longitude value
 * @returns Branded coordinates or null if invalid
 *
 * @example
 * ```ts
 * const coords = safeCoordinates(req.body.lat, req.body.lon);
 * if (!coords) {
 *   return res.status(400).json({ error: 'Invalid coordinates' });
 * }
 * // coords is now BrandedCoordinates type
 * ```
 */
export function safeCoordinates(lat: unknown, lon: unknown): BrandedCoordinates | null {
  const validLat = safeLat(lat);
  const validLon = safeLon(lon);

  if (!validLat || !validLon) {
    return null;
  }

  return { lat: validLat, lon: validLon };
}

/**
 * Safely converts unbranded coordinates to branded, returning null on failure
 *
 * @param coords - Unbranded coordinate object
 * @returns Branded coordinates or null if invalid
 *
 * @example
 * ```ts
 * const branded = safeToBranded(apiResponse.location);
 * if (!branded) {
 *   console.error('Invalid coordinates from API');
 *   return;
 * }
 * // branded is now BrandedCoordinates type
 * ```
 */
export function safeToBranded(
  coords: { lat: unknown; lon: unknown } | unknown
): BrandedCoordinates | null {
  if (!coords || typeof coords !== 'object') {
    return null;
  }

  const candidate = coords as { lat: unknown; lon: unknown };
  return safeCoordinates(candidate.lat, candidate.lon);
}
