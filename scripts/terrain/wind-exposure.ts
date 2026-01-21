/**
 * Wind Exposure Algorithm
 *
 * Computes directional wind exposure factors for a beach based on terrain/elevation data.
 * Uses horizon angle analysis to determine how much terrain shelters the beach from wind.
 *
 * Algorithm:
 * 1. For each of 72 directions (0°, 5°, 10°...355°):
 *    - Cast ray upwind from beach
 *    - Sample elevation at step intervals up to max_radius_m
 *    - Track maximum horizon angle (split: 0-500m near, 500m+ far)
 *    - Blend: max_horizon = 0.6 * near + 0.4 * far
 *    - Apply sigmoid: exposure = sigmoid((8.0 - max_horizon) / 3.0)
 * 2. Apply circular smoothing with kernel [0.25, 0.5, 0.25]
 * 3. Return 72-element array of exposure factors [0, 1]
 *
 * Direction convention:
 * - direction_deg = wind coming FROM that direction
 * - Ray casts UPWIND (opposite direction from beach)
 * - 0° = North, 90° = East, 180° = South, 270° = West
 */

import type { TerrainAnalysisParams, TerrainAnalysisDebug } from '../../types/terrain'
import type { DEMTile } from './dem-loader'
import { toUTM, getBeachElevation, getElevation, pointAtDistanceAndBearing } from './dem-loader'

/**
 * Result of wind exposure computation
 */
export interface WindExposureResult {
  /** 72 smoothed exposure values [0, 1] */
  factors: number[]
  /** 72 raw horizon angles (degrees) */
  horizon_angles: number[]
  /** Beach elevation in meters */
  beach_elevation: number
  /** UTM zone identifier */
  utm_zone: string
}

/**
 * Sigmoid function for smooth transitions
 *
 * @param x Input value
 * @returns Sigmoid output in range (0, 1)
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Apply circular smoothing to an array
 *
 * Uses a kernel (e.g., [0.25, 0.5, 0.25]) to smooth values,
 * wrapping around at boundaries (0° = 360°).
 *
 * @param arr Array to smooth (length 72)
 * @param kernel Smoothing kernel (e.g., [0.25, 0.5, 0.25])
 * @returns Smoothed array (length 72)
 */
export function smoothCircular(arr: number[], kernel: number[]): number[] {
  const n = arr.length
  const smoothed: number[] = Array(n).fill(0)

  // Kernel should be symmetric and odd-length
  const halfKernel = Math.floor(kernel.length / 2)

  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < kernel.length; j++) {
      const offset = j - halfKernel
      const idx = (i + offset + n) % n // Wrap around
      sum += arr[idx] * kernel[j]
    }
    smoothed[i] = sum
  }

  return smoothed
}

/**
 * Compute wind exposure factors for a beach
 *
 * @param latitude Beach latitude (WGS84)
 * @param longitude Beach longitude (WGS84)
 * @param params Analysis parameters
 * @param demTile DEM tile covering the beach area
 * @returns Wind exposure result with factors and debug data
 */
export function computeWindExposure(
  latitude: number,
  longitude: number,
  params: TerrainAnalysisParams,
  demTile: DEMTile
): WindExposureResult {
  // Convert beach location to UTM
  const { utmX: beachUtmX, utmY: beachUtmY, zone: utmZone } = toUTM(latitude, longitude)

  // Get beach elevation (handles water coordinates)
  const beachElevation = getBeachElevation(demTile, beachUtmX, beachUtmY)

  // Arrays to store results
  const horizonAngles: number[] = Array(72).fill(0)
  const rawExposure: number[] = Array(72).fill(0)

  // Analyze each direction (0°, 5°, 10°...355°)
  for (let directionDeg = 0; directionDeg < 360; directionDeg += 5) {
    const binIndex = directionDeg / 5

    let maxHorizonNear = 0 // 0-500m (micro-shelter: dunes, bluffs)
    let maxHorizonFar = 0 // 500m-max_radius

    // Cast ray upwind from beach
    for (let distance = params.step_m; distance <= params.max_radius_m; distance += params.step_m) {
      // Calculate sample point along ray
      const { utmX: sampleUtmX, utmY: sampleUtmY } = pointAtDistanceAndBearing(
        beachUtmX,
        beachUtmY,
        distance,
        directionDeg
      )

      // Get elevation at sample point
      const elevation = getElevation(demTile, sampleUtmX, sampleUtmY)

      // No data: contributes 0 blocking, continue ray
      if (elevation === null) {
        continue
      }

      // Calculate horizon angle
      // atan2(elevation_delta, horizontal_distance) in degrees
      const elevationDelta = elevation - beachElevation
      const horizonAngleRad = Math.atan2(elevationDelta, distance)
      const horizonAngleDeg = (horizonAngleRad * 180) / Math.PI

      // Track maximum in near/far zones
      if (distance <= params.near_far_split_m) {
        maxHorizonNear = Math.max(maxHorizonNear, horizonAngleDeg)
      } else {
        maxHorizonFar = Math.max(maxHorizonFar, horizonAngleDeg)
      }
    }

    // Blend near and far (near-field weighted higher for micro-shelter)
    const maxHorizon = 0.6 * maxHorizonNear + 0.4 * maxHorizonFar

    // Store raw horizon angle for debug
    horizonAngles[binIndex] = maxHorizon

    // Apply sigmoid: high angle → low exposure
    // sigmoid((angle_mid - max_horizon) / k)
    const sigmoidInput = (params.angle_mid - maxHorizon) / params.k
    rawExposure[binIndex] = sigmoid(sigmoidInput)
  }

  // Apply circular smoothing
  const smoothedFactors = smoothCircular(rawExposure, params.smoothing_kernel as [number, number, number])

  // Clamp to [0, 1] range (should already be in range, but defensive)
  const clampedFactors = smoothedFactors.map(f => Math.max(0, Math.min(1, f)))

  return {
    factors: clampedFactors,
    horizon_angles: horizonAngles,
    beach_elevation: beachElevation,
    utm_zone: utmZone,
  }
}
