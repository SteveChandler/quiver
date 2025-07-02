/**
 * Calculate offshore position for map markers
 * Offsets coordinates slightly toward the ocean for better marker placement
 * @param lat Latitude coordinate
 * @param lng Longitude coordinate
 * @returns Tuple of [longitude, latitude] for Mapbox (lng, lat order)
 */
export function getOffshorePosition(
  lat: number,
  lng: number
): [number, number] {
  // For San Diego area, ocean is generally to the west/southwest
  // Offset slightly west and south (~100m)
  const offsetLat = lat - 0.001; // ~100m south
  const offsetLng = lng - 0.001; // ~100m west
  return [offsetLng, offsetLat]; // [lng, lat] for Mapbox
}

/**
 * Check if viewport has significantly changed to reduce API calls
 * @param current Current viewport coordinates and zoom
 * @param previous Previous viewport coordinates and zoom
 * @returns True if viewport has changed significantly
 */
export function hasViewportChanged(
  current: { lat: number; lng: number; zoom: number },
  previous: { lat: number; lng: number; zoom: number } | null
): boolean {
  if (!previous) return true;

  // Use larger threshold for lat/lng to reduce calls (0.01 degrees ≈ 1km)
  const latChanged = Math.abs(current.lat - previous.lat) >= 0.01;
  const lngChanged = Math.abs(current.lng - previous.lng) >= 0.01;
  const zoomChanged = Math.abs(current.zoom - previous.zoom) >= 1;

  return latChanged || lngChanged || zoomChanged;
}

/**
 * Create location-based cache key with reasonable precision
 * @param prefix Cache key prefix
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param precision Number of decimal places (default 3 ≈ 100m precision)
 * @returns Formatted cache key string
 */
export function createLocationCacheKey(
  prefix: string,
  latitude: number,
  longitude: number,
  precision: number = 3
): string {
  const lat = latitude.toFixed(precision);
  const lng = longitude.toFixed(precision);
  return `${prefix}:${lat}:${lng}`;
}
