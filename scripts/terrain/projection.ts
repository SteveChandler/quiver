/**
 * UTM Projection Utilities
 *
 * Handles conversion between WGS84 (lat/lon) and UTM coordinates
 * for accurate distance-based terrain analysis.
 */

import proj4 from 'proj4'

/**
 * UTM coordinate result
 */
export interface UTMCoordinate {
  /** Easting in meters */
  x: number
  /** Northing in meters */
  y: number
  /** UTM zone number (1-60) */
  zone: number
  /** Hemisphere ('N' or 'S') */
  hemisphere: 'N' | 'S'
  /** Full zone string (e.g., '10N') */
  zoneString: string
}

/**
 * Get UTM zone number from longitude
 *
 * @param longitude Longitude in degrees (-180 to 180)
 * @returns UTM zone number (1-60)
 */
export function getUTMZone(longitude: number): number {
  // Normalize longitude to -180 to 180
  let lon = ((longitude + 180) % 360) - 180

  // UTM zones are 6 degrees wide, starting at -180
  // Zone 1 covers -180 to -174, Zone 2 covers -174 to -168, etc.
  return Math.floor((lon + 180) / 6) + 1
}

/**
 * Get proj4 projection string for a UTM zone
 *
 * @param zone UTM zone number (1-60)
 * @param hemisphere 'N' for northern, 'S' for southern
 * @returns proj4 projection definition string
 */
export function getUTMProjection(zone: number, hemisphere: 'N' | 'S'): string {
  // Central meridian for the zone
  const centralMeridian = (zone - 1) * 6 - 180 + 3

  // False northing: 0 for northern hemisphere, 10000000 for southern
  const falseNorthing = hemisphere === 'S' ? 10000000 : 0

  return `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south' : 'north'} +datum=WGS84 +units=m +no_defs`
}

/**
 * Convert WGS84 lat/lon to UTM coordinates
 *
 * @param latitude Latitude in degrees (-90 to 90)
 * @param longitude Longitude in degrees (-180 to 180)
 * @returns UTM coordinates with zone information
 */
export function toUTM(latitude: number, longitude: number): UTMCoordinate {
  const zone = getUTMZone(longitude)
  const hemisphere: 'N' | 'S' = latitude >= 0 ? 'N' : 'S'

  // Define projections
  const wgs84 = 'EPSG:4326'
  const utmProj = getUTMProjection(zone, hemisphere)

  // Transform coordinates
  const [x, y] = proj4(wgs84, utmProj, [longitude, latitude])

  return {
    x,
    y,
    zone,
    hemisphere,
    zoneString: `${zone}${hemisphere}`,
  }
}

/**
 * Convert UTM coordinates back to WGS84 lat/lon
 *
 * @param x Easting in meters
 * @param y Northing in meters
 * @param zone UTM zone number
 * @param hemisphere 'N' or 'S'
 * @returns [longitude, latitude] in degrees
 */
export function fromUTM(
  x: number,
  y: number,
  zone: number,
  hemisphere: 'N' | 'S'
): [number, number] {
  const wgs84 = 'EPSG:4326'
  const utmProj = getUTMProjection(zone, hemisphere)

  const [longitude, latitude] = proj4(utmProj, wgs84, [x, y])
  return [longitude, latitude]
}

/**
 * Calculate point at distance and bearing from origin (in UTM)
 *
 * @param originX Origin X coordinate in UTM (meters)
 * @param originY Origin Y coordinate in UTM (meters)
 * @param distanceM Distance in meters
 * @param bearingDeg Bearing in degrees (0 = North, 90 = East, clockwise)
 * @returns Destination UTM coordinates
 */
export function pointAtDistanceAndBearing(
  originX: number,
  originY: number,
  distanceM: number,
  bearingDeg: number
): { x: number; y: number } {
  // Convert bearing to radians
  // 0° = North = +Y, 90° = East = +X
  const bearingRad = (bearingDeg * Math.PI) / 180

  return {
    x: originX + distanceM * Math.sin(bearingRad),
    y: originY + distanceM * Math.cos(bearingRad),
  }
}

/**
 * Calculate distance between two UTM points
 *
 * @param x1 First point X
 * @param y1 First point Y
 * @param x2 Second point X
 * @param y2 Second point Y
 * @returns Distance in meters
 */
export function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate bearing from point 1 to point 2 (in UTM)
 *
 * @param x1 First point X
 * @param y1 First point Y
 * @param x2 Second point X
 * @param y2 Second point Y
 * @returns Bearing in degrees (0 = North, 90 = East, clockwise)
 */
export function bearingBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1

  // atan2 gives angle from positive X axis, counter-clockwise
  // We want angle from positive Y axis (North), clockwise
  let bearing = (Math.atan2(dx, dy) * 180) / Math.PI

  // Normalize to 0-360
  if (bearing < 0) bearing += 360

  return bearing
}
