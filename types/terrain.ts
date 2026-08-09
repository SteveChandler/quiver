/**
 * Terrain-Aware Geometry Scoring Types
 *
 * These types define the terrain analysis data model for directional
 * wind exposure and swell access factors.
 *
 * Note: Once migration 20260120211015_add_terrain_geometry_scoring.sql
 * is applied and types are regenerated, these types will be part of
 * the Beach type in database.generated.ts.
 */

import type { Json } from './database.generated'

// ===================================================
// TERRAIN ANALYSIS TYPES
// ===================================================

/**
 * Terrain analysis status values
 * - 'ok': Both wind and swell analysis completed successfully
 * - 'wind_only': Only wind analysis completed (swell pending/failed)
 * - 'failed': Analysis failed
 */
export type TerrainStatus = 'ok' | 'wind_only' | 'failed'

/**
 * Parameters used during terrain analysis
 * Stored in terrain_params JSONB column for reproducibility
 */
export interface TerrainAnalysisParams {
  /** Maximum radius for wind ray casting (meters) */
  max_radius_m: number
  /** Distance for swell blockage detection (meters) */
  blockage_threshold_m: number
  /** Swell ray length for land detection (meters) */
  swell_ray_length_m: number
  /** Sample step distance (typically DEM resolution * 2) */
  step_m: number
  /** Wind shelter threshold angle (degrees) */
  angle_mid: number
  /** Sigmoid steepness for wind exposure curve */
  k: number
  /** Minimum exposure floor (prevents "perfect wind") */
  min_exposure: number
  /** Swell wrap exponential decay per degree */
  wrap_lambda: number
  /** Maximum refraction angle considered for wrap */
  max_wrap_angle: number
  /** Smoothing kernel for bin averaging */
  smoothing_kernel: [number, number, number]
  /** DEM data source identifier */
  dem_source: string
  /** DEM resolution in meters */
  resolution_m: number
  /** Near/far split distance for wind exposure (meters) */
  near_far_split_m: number
}

/**
 * Debug data stored in terrain_analysis_debug JSONB column
 * Used for visualization and troubleshooting, not in hot path
 */
export interface TerrainAnalysisDebug {
  /** Raw horizon angles before sigmoid transform (72 values) */
  wind_horizon_angles?: number[]
  /** Direct access values before wrap combination (72 values) */
  swell_direct_access?: number[]
  /** Wrap contribution values (72 values) */
  swell_wrap_access?: number[]
  /** Detected headland locations */
  headland_detections?: Array<{
    direction_deg: number
    distance_m: number
    type: 'blocking' | 'wrapping'
  }>
  /** Analysis metadata */
  analysis_metadata?: {
    beach_elevation_m: number
    utm_zone: string
    processing_time_ms: number
    dem_coverage_pct: number
  }
}

/**
 * Terrain analysis fields for Beach type
 * These fields are added to the beaches table by migration 20260120211015
 */
export interface BeachTerrainFields {
  /**
   * Directional wind exposure factors as 72-element array (5-degree bins: 0, 5, 10... 355)
   * Values: 1.0 = fully exposed, 0.0 = fully sheltered
   * Index mapping: direction_deg / 5 (e.g., 90 degrees = index 18)
   */
  wind_exposure_factors: number[] | null

  /**
   * Directional swell access factors as 72-element array (5-degree bins)
   * Includes both direct access and wrap-around effects
   * Values: 1.0 = fully accessible, 0.0 = fully blocked
   */
  swell_access_factors: number[] | null

  /**
   * Terrain analysis method identifier (e.g., 'dem_horizon_v1')
   * Used for cache invalidation when algorithm changes
   */
  terrain_method: string | null

  /**
   * Analysis parameters as JSONB
   * Contains all algorithm parameters for reproducibility
   */
  terrain_params: Json | null

  /**
   * SHA256 hash of canonical terrain_params JSON
   * Used for fast cache validation without full JSON comparison
   */
  terrain_params_hash: string | null

  /**
   * Timestamp when terrain analysis was completed
   * Covers both wind and swell if terrain_status = 'ok'
   */
  terrain_analyzed_at: string | null

  /**
   * Timestamp when wind exposure analysis completed
   */
  wind_analyzed_at: string | null

  /**
   * Timestamp when swell access analysis completed
   */
  swell_analyzed_at: string | null

  /**
   * Analysis completion status
   */
  terrain_status: TerrainStatus | null

  /**
   * Feature flag for staged rollout
   * When true, terrain factors are used in scoring calculations
   */
  terrain_enabled: boolean

  /**
   * Optional debug data for visualization and troubleshooting
   * Not used in query hot path
   */
  terrain_analysis_debug: Json | null
}

// ===================================================
// EXTENDED BEACH TYPE WITH TERRAIN
// ===================================================

import type { Beach } from './database'

/**
 * Beach type extended with terrain analysis fields
 *
 * Use this type when working with terrain-aware scoring.
 * Once the migration is applied and types regenerated,
 * the base Beach type will include these fields.
 */
export type BeachWithTerrain = Beach & BeachTerrainFields

// ===================================================
// SCORING UTILITY TYPES
// ===================================================

/**
 * Number of directional bins (72 = 360 degrees / 5 degrees per bin)
 */
export const TERRAIN_BINS = 72

/**
 * Degrees per bin
 */
export const DEGREES_PER_BIN = 5

/**
 * Convert degrees to bin index
 *
 * @param deg Direction in degrees (0-359, meteorological convention)
 * @returns Bin index (0-71)
 *
 * @example
 * toBin5(0)   // 0 (North)
 * toBin5(90)  // 18 (East)
 * toBin5(180) // 36 (South)
 * toBin5(270) // 54 (West)
 * toBin5(357) // 71 (just before North)
 * toBin5(362) // 0 (wraps around)
 */
export const toBin5 = (deg: number): number => {
  const norm = ((deg % 360) + 360) % 360
  return Math.floor((norm + 2.5) / 5) % 72
}

/**
 * Convert bin index back to degrees (center of bin)
 *
 * @param bin Bin index (0-71)
 * @returns Direction in degrees (0, 5, 10, ... 355)
 */
export const binToDeg = (bin: number): number => {
  return ((bin % 72) + 72) % 72 * 5
}

/**
 * Check if terrain factors should be used for a beach
 *
 * Requires:
 * 1. Global TERRAIN_SCORING_ENABLED env var (if exists)
 * 2. Beach terrain_enabled flag is true
 * 3. Both factor arrays present and have 72 elements
 */
export const useTerrainFactors = (beach: Partial<BeachTerrainFields>): boolean => {
  // Global kill switch (env var)
  if (
    typeof process !== 'undefined' &&
    process.env.TERRAIN_SCORING_ENABLED === 'false'
  ) {
    return false
  }

  // Per-beach enable flag
  if (!beach.terrain_enabled) return false

  // Factor arrays present and valid length
  if (
    !beach.wind_exposure_factors ||
    !Array.isArray(beach.wind_exposure_factors) ||
    beach.wind_exposure_factors.length !== TERRAIN_BINS
  ) {
    return false
  }

  if (
    !beach.swell_access_factors ||
    !Array.isArray(beach.swell_access_factors) ||
    beach.swell_access_factors.length !== TERRAIN_BINS
  ) {
    return false
  }

  return true
}

// ===================================================
// DEFAULT ANALYSIS PARAMETERS
// ===================================================

/**
 * Default terrain analysis parameters
 * These match the values specified in the design document
 */
export const DEFAULT_TERRAIN_PARAMS: TerrainAnalysisParams = {
  max_radius_m: 5000,
  blockage_threshold_m: 3000,
  swell_ray_length_m: 3500, // blockage_threshold + 500
  step_m: 60, // Assumes 30m DEM * 2
  angle_mid: 8.0,
  k: 3.0,
  min_exposure: 0.15,
  wrap_lambda: 0.04,
  max_wrap_angle: 45,
  smoothing_kernel: [0.25, 0.5, 0.25],
  dem_source: 'copernicus',
  resolution_m: 30,
  near_far_split_m: 500,
}
