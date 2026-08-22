/**
 * Get optimal marker position for beach locations
 * Places markers directly at beach coordinates with minimal smart offset
 * @param lat Latitude coordinate
 * @param lng Longitude coordinate
 * @param beachName Optional beach name for specific positioning logic
 * @returns Tuple of [longitude, latitude] for Mapbox (lng, lat order)
 */
function getOptimalMarkerPosition(
  lat: number,
  lng: number,
  beachName?: string
): [number, number] {
  // TESTING: No offset at all - place markers directly on beach coordinates
  // This eliminates any positioning errors and places markers exactly where beaches are located
  return [lng, lat]; // [lng, lat] for Mapbox - no offset applied
  
  // Original offset code commented out for testing:
  /*
  // Use minimal offset for visual clarity while keeping markers on/near beaches
  // Offset is much smaller (~25m) and beach-specific where needed
  let offsetLat = lat;
  let offsetLng = lng;
  
  // Apply minimal smart offset based on coastal geography
  if (beachName) {
    const name = beachName.toLowerCase();
    
    // Beach-specific micro-adjustments for optimal marker placement
    if (name.includes('la jolla')) {
      // La Jolla faces more southwest, slight adjustment
      offsetLat = lat - 0.0002; // ~20m south
      offsetLng = lng - 0.0003; // ~30m west
    } else if (name.includes('pacific beach') || name.includes('pb')) {
      // Pacific Beach faces west-southwest
      offsetLat = lat - 0.0001; // ~10m south
      offsetLng = lng - 0.0002; // ~20m west
    } else if (name.includes('ocean beach') || name.includes('ob')) {
      // Ocean Beach faces more directly west
      offsetLng = lng - 0.0002; // ~20m west
    } else if (name.includes('mission beach')) {
      // Mission Beach is more protected, minimal offset
      offsetLat = lat - 0.0001; // ~10m south
      offsetLng = lng - 0.0001; // ~10m west
    } else {
      // Default: very small offset to avoid overlapping with beach point
      offsetLat = lat - 0.0001; // ~10m south
      offsetLng = lng - 0.0001; // ~10m west
    }
  } else {
    // Generic small offset when beach name not available
    offsetLat = lat - 0.0001; // ~10m south  
    offsetLng = lng - 0.0001; // ~10m west
  }
  
  return [offsetLng, offsetLat]; // [lng, lat] for Mapbox
  */
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getOptimalMarkerPosition instead
 */
export function getOffshorePosition(
  lat: number,
  lng: number
): [number, number] {
  return getOptimalMarkerPosition(lat, lng);
}

/**
 * Check if viewport has significantly changed to reduce API calls
 * @param current Current viewport coordinates and zoom
 * @param previous Previous viewport coordinates and zoom
 * @returns True if viewport has changed significantly
 */
export function hasViewportChanged(
  current: { lat: number; lon: number; zoom: number },
  previous: { lat: number; lon: number; zoom: number } | null
): boolean {
  if (!previous) return true;

  // Use larger coordinate thresholds to reduce calls (0.01 degrees ≈ 1km)
  const latChanged = Math.abs(current.lat - previous.lat) >= 0.01;
  const lonChanged = Math.abs(current.lon - previous.lon) >= 0.01;
  const zoomChanged = Math.abs(current.zoom - previous.zoom) >= 1;

  return latChanged || lonChanged || zoomChanged;
}

/**
 * Create location-based cache key with reasonable precision
 * @param prefix Cache key prefix
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param precision Number of decimal places (default 3 ≈ 100m precision)
 * @returns Formatted cache key string
 */
function createLocationCacheKey(
  prefix: string,
  latitude: number,
  longitude: number,
  precision: number = 3
): string {
  const lat = latitude.toFixed(precision);
  const lng = longitude.toFixed(precision);
  return `${prefix}:${lat}:${lng}`;
}
