/**
 * Swell Access Algorithm
 *
 * Computes directional swell access factors for a beach based on landmask data.
 * Determines how much terrain blocks swell from reaching the beach from different directions.
 *
 * Algorithm:
 * 1. For each of 72 directions (0°, 5°, 10°...355°):
 *    a. Cast ray from beach toward swell source
 *    b. Check for first land within swell_ray_length_m
 *    c. If land < blockage_threshold_m: blocked (calculate access factor)
 *    d. If land > blockage_threshold_m or no land: open (access = 1.0)
 * 2. For blocked directions, check for wrap-around:
 *    a. Examine adjacent directions (±5°, ±10°...±max_wrap_angle)
 *    b. If adjacent direction is open (access > 0.7), apply exponential decay
 *    c. Wrap contribution = adjacent_access * exp(-wrap_lambda * angle_offset)
 * 3. Combine direct access + wrap (take max)
 * 4. Apply circular smoothing with kernel [0.25, 0.5, 0.25]
 * 5. Return 72-element array of access factors [0, 1]
 *
 * Direction convention:
 * - direction_deg = swell coming FROM that direction
 * - Ray casts FROM beach TOWARD swell source (same as wind)
 * - 0° = North, 90° = East, 180° = South, 270° = West
 */

import type { TerrainAnalysisParams } from '../../types/terrain'
import type { LandmaskTile } from './landmask-loader'
import { smoothCircular } from './wind-exposure'
import { analyzeSwellPath } from './landmask-loader'
import { toUTM } from './dem-loader'

/**
 * Result of swell access computation
 */
export interface SwellAccessResult {
  /** 72 smoothed access values [0, 1] */
  factors: number[]
  /** 72 direct access values (before wrap) */
  direct_access: number[]
  /** 72 wrap contribution values */
  wrap_access: number[]
}

/**
 * Compute swell access factors for a beach
 *
 * @param latitude Beach latitude (WGS84)
 * @param longitude Beach longitude (WGS84)
 * @param params Analysis parameters
 * @param landmask LandmaskTile covering the beach area
 * @returns Swell access result with factors and debug data
 */
export function computeSwellAccess(
  latitude: number,
  longitude: number,
  params: TerrainAnalysisParams,
  landmask: LandmaskTile
): SwellAccessResult {
  // Convert beach location to UTM
  const { utmX: beachUtmX, utmY: beachUtmY } = toUTM(latitude, longitude)

  // Step 1: Calculate direct access for each direction
  const direct_access: number[] = []

  for (let directionDeg = 0; directionDeg < 360; directionDeg += 5) {
    // Analyze swell path from beach toward swell source
    const pathResult = analyzeSwellPath(
      landmask,
      beachUtmX,
      beachUtmY,
      directionDeg,
      params.swell_ray_length_m,
      params.step_m
    )

    if (!pathResult.reachedWater) {
      // Never reached water - facing inland, completely blocked
      direct_access.push(0)
    } else if (pathResult.distanceToBlockingLand === null) {
      // Reached water, no blocking land - fully open ocean access
      direct_access.push(1.0)
    } else if (pathResult.distanceToBlockingLand > params.blockage_threshold_m) {
      // Blocking land is far enough away - still good access
      direct_access.push(1.0)
    } else {
      // Blocking land within threshold - calculate partial access
      // Smooth transition: distance/threshold raised to power 1.5
      const accessFactor = Math.pow(pathResult.distanceToBlockingLand / params.blockage_threshold_m, 1.5)
      direct_access.push(Math.max(0, Math.min(1, accessFactor)))
    }
  }

  // Step 2: Calculate wrap contribution for blocked directions
  const wrap_access: number[] = []

  for (let i = 0; i < 72; i++) {
    // Skip wrap calculation if already mostly open
    if (direct_access[i] >= 0.8) {
      wrap_access.push(0)
      continue
    }

    // Check adjacent directions for wrap-around effects
    let best_wrap = 0

    for (let offset = 5; offset <= params.max_wrap_angle; offset += 5) {
      // Check both sides (±offset)
      for (const sign of [-1, 1]) {
        // Calculate adjacent bin with wrapping
        const adjacent_bin = ((i + sign * (offset / 5)) % 72 + 72) % 72
        const adjacent_direct = direct_access[adjacent_bin]

        // Only consider wrap if adjacent direction is mostly open
        if (adjacent_direct > 0.7) {
          // Apply exponential decay based on angle offset
          const wrap_factor = adjacent_direct * Math.exp(-params.wrap_lambda * offset)
          best_wrap = Math.max(best_wrap, wrap_factor)
        }
      }
    }

    wrap_access.push(best_wrap)
  }

  // Step 3: Combine direct + wrap (take max, scale wrap by 0.85)
  const combined: number[] = []

  for (let i = 0; i < 72; i++) {
    // Wrap is slightly less effective than direct access (0.85 factor)
    combined.push(Math.max(direct_access[i], wrap_access[i] * 0.85))
  }

  // Step 4: Apply circular smoothing
  const factors = smoothCircular(combined, params.smoothing_kernel as [number, number, number])

  // Clamp to [0, 1] range (should already be in range, but defensive)
  const clampedFactors = factors.map(f => Math.max(0, Math.min(1, f)))

  return {
    factors: clampedFactors,
    direct_access,
    wrap_access,
  }
}
