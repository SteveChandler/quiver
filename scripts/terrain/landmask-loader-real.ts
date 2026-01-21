/**
 * Real Landmask Loader
 *
 * Uses elevation data to determine land vs water:
 * - Elevation > 0: Land
 * - Elevation <= 0: Water
 *
 * This is a reasonable approximation for coastal areas and avoids
 * the complexity of separate coastline data.
 */

import type { TerrainAnalysisParams } from '../../types/terrain'
import type { LandmaskTile } from './landmask-loader'
import { loadRealDEMTile, getRealElevation } from './dem-loader-real'
import { toUTM, fromUTM, pointAtDistanceAndBearing } from './projection'

/**
 * Extended landmask tile with real data support
 */
interface RealLandmaskTile extends LandmaskTile {
  /** Beach UTM coordinates */
  beachUTM: { x: number; y: number; zone: number; hemisphere: 'N' | 'S' }
  /** Elevation grid for land detection */
  elevationGrid: any | null
}

/**
 * Load landmask for a region using elevation data
 *
 * @param latitude Beach latitude (WGS84)
 * @param longitude Beach longitude (WGS84)
 * @param params Analysis parameters
 * @returns Landmask data using elevation-based land detection
 */
export async function loadRealLandmask(
  latitude: number,
  longitude: number,
  params: TerrainAnalysisParams
): Promise<RealLandmaskTile> {
  console.log(`[Landmask] Loading real landmask for (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)

  // Load elevation data (reuse from DEM loader)
  const demTile = await loadRealDEMTile(latitude, longitude, {
    ...params,
    max_radius_m: params.swell_ray_length_m, // Use swell ray length for landmask
  })

  return {
    bounds: demTile.bounds,
    resolution: params.resolution_m,
    utmZone: demTile.utmZone,
    data: [], // Not used - we use elevation for detection
    beachUTM: demTile.beachUTM,
    elevationGrid: demTile.elevationGrid,
  }
}

/**
 * Check if a UTM point is on land using elevation data
 *
 * @param landmask Landmask data
 * @param utmX X coordinate in UTM (meters)
 * @param utmY Y coordinate in UTM (meters)
 * @returns True if point is on land (elevation > 0)
 */
export function isRealLand(landmask: RealLandmaskTile, utmX: number, utmY: number): boolean {
  if (!landmask.elevationGrid) {
    return false // No data = assume water
  }

  // Convert UTM to lat/lon
  const [lon, lat] = fromUTM(utmX, utmY, landmask.beachUTM.zone, landmask.beachUTM.hemisphere)

  // Get elevation at this point
  const elev = getElevationFromLatLon(landmask.elevationGrid, lat, lon)

  // Land if elevation > 0 (with small threshold for noise)
  return elev !== null && elev > 0.5
}

/**
 * Get elevation from lat/lon using elevation grid
 */
function getElevationFromLatLon(grid: any, lat: number, lon: number): number | null {
  if (!grid) return null

  // Check bounds
  if (
    lat > grid.bounds.north ||
    lat < grid.bounds.south ||
    lon > grid.bounds.east ||
    lon < grid.bounds.west
  ) {
    return null
  }

  // Calculate pixel position
  const latFrac = (grid.bounds.north - lat) / (grid.bounds.north - grid.bounds.south)
  const lonFrac = (lon - grid.bounds.west) / (grid.bounds.east - grid.bounds.west)

  const px = Math.floor(lonFrac * grid.width)
  const py = Math.floor(latFrac * grid.height)

  if (px < 0 || px >= grid.width || py < 0 || py >= grid.height) {
    return null
  }

  const elevation = grid.data[py * grid.width + px]
  return elevation === -9999 ? null : elevation
}

/**
 * Find distance to first land point along a ray
 *
 * @param landmask Landmask data
 * @param originUtmX Origin X coordinate in UTM
 * @param originUtmY Origin Y coordinate in UTM
 * @param bearingDeg Bearing in degrees (0 = North, 90 = East)
 * @param maxDistanceM Maximum distance to check
 * @param stepM Step size for ray casting
 * @returns Distance to first land in meters, or null if no land within max distance
 */
export function distanceToRealLand(
  landmask: RealLandmaskTile,
  originUtmX: number,
  originUtmY: number,
  bearingDeg: number,
  maxDistanceM: number,
  stepM: number
): number | null {
  // Cast ray from origin outward
  for (let distance = stepM; distance <= maxDistanceM; distance += stepM) {
    const point = pointAtDistanceAndBearing(originUtmX, originUtmY, distance, bearingDeg)

    if (isRealLand(landmask, point.x, point.y)) {
      return distance
    }
  }

  return null // No land found
}

/**
 * Check if there's any land blocking swell from a direction
 *
 * For swell access, we need to check if there's land between the beach
 * and the open ocean in a given direction.
 *
 * @param landmask Landmask data
 * @param beachUtmX Beach X coordinate
 * @param beachUtmY Beach Y coordinate
 * @param bearingDeg Direction to check (where swell comes FROM)
 * @param blockageThresholdM Distance within which land blocks swell
 * @returns true if swell from this direction is blocked
 */
export function isSwellBlocked(
  landmask: RealLandmaskTile,
  beachUtmX: number,
  beachUtmY: number,
  bearingDeg: number,
  blockageThresholdM: number,
  stepM: number
): boolean {
  const landDistance = distanceToRealLand(
    landmask,
    beachUtmX,
    beachUtmY,
    bearingDeg,
    blockageThresholdM,
    stepM
  )

  // If we find land within the blockage threshold, swell is blocked
  return landDistance !== null
}
