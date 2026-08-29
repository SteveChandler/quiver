/**
 * Landmask Loader
 *
 * Detects land vs water using elevation data from DEM tiles.
 * Uses real data by default, with mock fallback for testing.
 *
 * Land detection: elevation > 0.5m = land, else water
 *
 * Environment:
 * - USE_MOCK_TERRAIN=true: Use mock all-water (for testing)
 * - Default: Use real elevation-based detection
 */

import type { TerrainAnalysisParams } from '../../types/terrain'
import { loadDEMTile, getElevation, pointAtDistanceAndBearing } from './dem-loader'
import type { DEMTile, TerrainLoadOptions } from './dem-loader'
import * as projection from './projection'

// Check for mock mode
const USE_MOCK = process.env.USE_MOCK_TERRAIN === 'true'

/**
 * Landmask tile structure
 */
export interface LandmaskTile {
  /** Bounds of the mask in UTM coordinates */
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  /** Resolution in meters */
  resolution: number
  /** UTM zone string */
  utmZone: string
  /** Land/water bitmap - not used in elevation-based detection */
  data: boolean[][]
  /** DEM tile for elevation-based detection */
  _demTile?: DEMTile
}

/**
 * Load landmask for region using elevation data
 */
export async function loadLandmask(
  latitude: number,
  longitude: number,
  params: TerrainAnalysisParams,
  options: TerrainLoadOptions = {}
): Promise<LandmaskTile> {
  const shouldLog = options.log !== false
  if (USE_MOCK) {
    if (shouldLog) console.log(`[Landmask] Loading landmask for (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) with radius ${params.swell_ray_length_m}m`)
    return createMockLandmaskTile(latitude, longitude, params.swell_ray_length_m)
  }

  if (shouldLog) console.log(`[Landmask] Loading real landmask for (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)

  // Load DEM tile for elevation-based detection
  const demTile = await loadDEMTile(latitude, longitude, {
    ...params,
    max_radius_m: params.swell_ray_length_m,
  }, options)

  return {
    bounds: demTile.bounds,
    resolution: params.resolution_m,
    utmZone: demTile.utmZone,
    data: [],
    _demTile: demTile,
  }
}

/**
 * Check if a UTM point is on land
 *
 * Uses elevation-based detection: elevation > 0.5m = land
 */
export function isLand(landmask: LandmaskTile, utmX: number, utmY: number): boolean {
  // Check bounds
  if (
    utmX < landmask.bounds.minX ||
    utmX > landmask.bounds.maxX ||
    utmY < landmask.bounds.minY ||
    utmY > landmask.bounds.maxY
  ) {
    return false
  }

  // Use elevation-based detection if DEM available
  if (landmask._demTile) {
    const elevation = getElevation(landmask._demTile, utmX, utmY)
    // Land if elevation > 0.5m (threshold for noise)
    return elevation !== null && elevation > 0.5
  }

  // Mock: all water
  return false
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
export function distanceToLand(
  landmask: LandmaskTile,
  originUtmX: number,
  originUtmY: number,
  bearingDeg: number,
  maxDistanceM: number,
  stepM: number
): number | null {
  // Cast ray from origin outward
  for (let distance = stepM; distance <= maxDistanceM; distance += stepM) {
    const { utmX, utmY } = pointAtDistanceAndBearing(originUtmX, originUtmY, distance, bearingDeg)

    if (isLand(landmask, utmX, utmY)) {
      return distance
    }
  }

  return null // No land found
}

/**
 * Result of swell path analysis
 */
export interface SwellPathResult {
  /** Did we reach water (ocean) in this direction? */
  reachedWater: boolean
  /** Distance to water from beach (how far to get past shoreline) */
  distanceToWater: number | null
  /** Distance from water edge to blocking land, or null if open */
  distanceToBlockingLand: number | null
}

/**
 * Analyze swell path for blocking land
 *
 * This handles the case where the beach itself is on land:
 * 1. First, skip past the beach's landmass until we reach water
 * 2. Then, check if there's land beyond that would block swell
 *
 * @param landmask Landmask data
 * @param originUtmX Origin X coordinate in UTM
 * @param originUtmY Origin Y coordinate in UTM
 * @param bearingDeg Bearing in degrees (0 = North, 90 = East)
 * @param maxDistanceM Maximum distance to check
 * @param stepM Step size for ray casting
 * @returns SwellPathResult with water/land information
 */
export function analyzeSwellPath(
  landmask: LandmaskTile,
  originUtmX: number,
  originUtmY: number,
  bearingDeg: number,
  maxDistanceM: number,
  stepM: number
): SwellPathResult {
  let foundWater = false
  let waterStartDistance = 0

  // Cast ray from origin outward
  for (let distance = stepM; distance <= maxDistanceM; distance += stepM) {
    const { utmX, utmY } = pointAtDistanceAndBearing(originUtmX, originUtmY, distance, bearingDeg)
    const onLand = isLand(landmask, utmX, utmY)

    if (!foundWater) {
      // Phase 1: Looking for water (exiting the beach landmass)
      if (!onLand) {
        foundWater = true
        waterStartDistance = distance
      }
    } else {
      // Phase 2: We've reached water, now check for blocking land
      if (onLand) {
        // Found land beyond water - this blocks swell
        return {
          reachedWater: true,
          distanceToWater: waterStartDistance,
          distanceToBlockingLand: distance - waterStartDistance,
        }
      }
    }
  }

  if (foundWater) {
    // Reached water, no blocking land - open ocean access
    return {
      reachedWater: true,
      distanceToWater: waterStartDistance,
      distanceToBlockingLand: null,
    }
  }

  // Never reached water - facing inland, completely blocked
  return {
    reachedWater: false,
    distanceToWater: null,
    distanceToBlockingLand: null,
  }
}

/**
 * Create a mock landmask tile for testing
 *
 * Returns an all-water landmask (no land) for algorithm validation.
 */
export function createMockLandmaskTile(
  latitude: number,
  longitude: number,
  radiusM = 5000
): LandmaskTile {
  const utmResult = projection.toUTM(latitude, longitude)
  return {
    bounds: {
      minX: utmResult.x - radiusM,
      maxX: utmResult.x + radiusM,
      minY: utmResult.y - radiusM,
      maxY: utmResult.y + radiusM,
    },
    resolution: 30,
    utmZone: utmResult.zoneString,
    data: [],
  }
}
