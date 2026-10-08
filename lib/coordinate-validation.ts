/**
 * Coordinate Validation Utilities
 *
 * Runtime validation for geographic coordinates to catch invalid values early
 * and provide helpful error messages in development.
 *
 * @module coordinate-validation
 */

/**
 * Validates if a value is a valid latitude
 * Latitude must be between -90 and 90 degrees
 */
export function isValidLatitude(lat: number | undefined | null): lat is number {
  if (lat === undefined || lat === null) {
    return false;
  }

  if (typeof lat !== 'number' || isNaN(lat)) {
    return false;
  }

  return lat >= -90 && lat <= 90;
}

/**
 * Validates if a value is a valid longitude
 * Longitude must be between -180 and 180 degrees
 */
export function isValidLongitude(lon: number | undefined | null): lon is number {
  if (lon === undefined || lon === null) {
    return false;
  }

  if (typeof lon !== 'number' || isNaN(lon)) {
    return false;
  }

  return lon >= -180 && lon <= 180;
}

/**
 * Validates coordinates and returns detailed error message if invalid
 * Returns null if coordinates are valid
 */
export function getCoordinateValidationError(
  lat: number | undefined | null,
  lon: number | undefined | null,
  context?: string
): string | null {
  const prefix = context ? `${context}: ` : '';

  // Check if values are defined
  if (lat === undefined || lat === null) {
    return `${prefix}Latitude is ${lat === undefined ? 'undefined' : 'null'}`;
  }

  if (lon === undefined || lon === null) {
    return `${prefix}Longitude is ${lon === undefined ? 'undefined' : 'null'}`;
  }

  // Check if values are numbers
  if (typeof lat !== 'number') {
    return `${prefix}Latitude must be a number, got ${typeof lat}`;
  }

  if (typeof lon !== 'number') {
    return `${prefix}Longitude must be a number, got ${typeof lon}`;
  }

  // Check for NaN
  if (isNaN(lat)) {
    return `${prefix}Latitude is NaN`;
  }

  if (isNaN(lon)) {
    return `${prefix}Longitude is NaN`;
  }

  // Check ranges
  if (lat < -90 || lat > 90) {
    return `${prefix}Latitude ${lat} is out of range (-90 to 90)`;
  }

  if (lon < -180 || lon > 180) {
    return `${prefix}Longitude ${lon} is out of range (-180 to 180)`;
  }

  return null;
}

/**
 * Validates coordinates with development warnings
 * In development, logs detailed warnings to console
 * In production, silently validates without console output
 *
 * @param lat - Latitude value to validate
 * @param lon - Longitude value to validate
 * @param context - Optional context for error messages (e.g., beach name)
 * @returns true if coordinates are valid, false otherwise
 */
export function validateCoordinates(
  lat: number | undefined | null,
  lon: number | undefined | null,
  context?: string
): boolean {
  const error = getCoordinateValidationError(lat, lon, context);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Invalid coordinates detected:', error);
      console.warn('  Latitude:', lat);
      console.warn('  Longitude:', lon);
      if (context) {
        console.warn('  Context:', context);
      }
      // `console.trace` is disallowed by our eslint config; log the stack explicitly instead.
      const stack = new Error('Stack trace').stack;
      if (stack) console.warn(stack);
    }
    return false;
  }

  return true;
}
