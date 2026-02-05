/**
 * Wave Height Transformer
 *
 * Transforms raw buoy significant wave height (Hs) into estimated face heights
 * that match what surfers expect from services like Surfline/Surf Captain.
 *
 * The transformation applies:
 * 1. Base shoaling factor (1.0x) - raw model data already accounts for shoaling
 * 2. Period amplification - longer periods (14-20s) = bigger faces
 * 3. Beach-specific swell access - uses terrain swell_access_factors
 *
 * Formula:
 *   face_height = Hs x BASE_SHOALING x period_factor x direction_factor
 *
 * Example: 3.5ft Hs @ 14s with good direction = 3.5 x 1.0 x 1.2 x 1.0 = 4.2ft face
 */

import { toBin5, TERRAIN_BINS } from '@/types/terrain';

/**
 * Beach terrain configuration needed for wave height transformation
 */
export interface BeachTerrainConfig {
  swell_access_factors?: number[] | null;
  terrain_enabled?: boolean;
}

/**
 * Parameters for wave height transformation
 */
export interface TransformParams {
  /** Raw significant wave height in feet */
  rawHeightFt: number;
  /** Wave period in seconds (null defaults to 10s) */
  periodS: number | null;
  /** Swell direction in degrees (null skips direction factor) */
  swellDirectionDeg: number | null;
  /** Beach terrain configuration (optional) */
  beach?: BeachTerrainConfig | null;
}

// ===================================================
// TRANSFORMATION CONSTANTS
// ===================================================

/**
 * Base shoaling factor - waves steepen as they approach shore
 * Note: Reduced from 1.6 to 1.0 because raw model data (NOAA/IOOS)
 * may already account for shoaling effects. This brings wave heights
 * in line with services like Surfline (~4x reduction in displayed heights).
 */
export const BASE_SHOALING = 1.0;

/**
 * Reference period for neutral amplification (10 seconds)
 */
export const PERIOD_REF = 10;

/**
 * Period multiplier per second above/below reference
 * Each second adds/subtracts 5% to the factor
 */
export const PERIOD_MULT = 0.05;

/**
 * Minimum period factor (clamped)
 * Short period wind chop gets reduced
 */
export const PERIOD_FACTOR_MIN = 0.8;

/**
 * Maximum period factor (clamped)
 * Long period swells max out at 1.2x (reduced from 1.4x to prevent
 * over-amplification of Caribbean/Pacific long-period groundswells)
 */
export const PERIOD_FACTOR_MAX = 1.2;

/**
 * Minimum direction factor when terrain is fully blocking
 * Prevents zero-height forecasts for blocked directions
 */
export const DIRECTION_FACTOR_MIN = 0.6;

/**
 * Direction factor range added based on swell access
 * Direction factor = MIN + (access * RANGE), giving 0.6-1.0 range
 */
export const DIRECTION_FACTOR_RANGE = 0.4;

/**
 * Set wave variance multiplier
 * Set waves are typically 50% larger than average waves
 * Used to display wave height ranges like "3-5ft"
 */
export const SET_WAVE_VARIANCE = 1.5;

/**
 * Wave height range representing average to set waves
 */
export interface WaveHeightRange {
  /** Average wave face height */
  low: number;
  /** Set wave face height (low × 1.5) */
  high: number;
}

// ===================================================
// TRANSFORMATION FUNCTIONS
// ===================================================

/**
 * Calculate period amplification factor
 *
 * Short periods (6-8s) reduce face height (wind chop)
 * Medium periods (10-12s) are neutral
 * Long periods (14-20s) increase face height (groundswell)
 *
 * @param periodS Wave period in seconds (null defaults to reference)
 * @returns Period factor in range [0.8, 1.2]
 *
 * @example
 * calculatePeriodFactor(8)  // 0.9 (short period)
 * calculatePeriodFactor(10) // 1.0 (reference)
 * calculatePeriodFactor(14) // 1.2 (groundswell, at max)
 * calculatePeriodFactor(20) // 1.2 (clamped max)
 */
export function calculatePeriodFactor(periodS: number | null): number {
  const period = periodS ?? PERIOD_REF;
  const rawFactor = 1.0 + (period - PERIOD_REF) * PERIOD_MULT;
  return Math.min(PERIOD_FACTOR_MAX, Math.max(PERIOD_FACTOR_MIN, rawFactor));
}

/**
 * Calculate direction factor based on beach terrain swell access
 *
 * Uses the beach's swell_access_factors array (72 bins, 5 degrees each)
 * to determine how much swell reaches the beach from the given direction.
 *
 * @param swellDirectionDeg Swell direction in degrees
 * @param beach Beach terrain configuration
 * @returns Direction factor in range [0.6, 1.0]
 *
 * @example
 * // Beach with good SW access (factor 1.0) but blocked NW (factor 0.2)
 * calculateDirectionFactor(225, beach) // 1.0 (SW, full access)
 * calculateDirectionFactor(315, beach) // 0.68 (NW, mostly blocked)
 */
export function calculateDirectionFactor(
  swellDirectionDeg: number | null,
  beach?: BeachTerrainConfig | null
): number {
  // If no direction or no terrain data, return neutral factor
  if (swellDirectionDeg === null) {
    return 1.0;
  }

  if (
    !beach?.terrain_enabled ||
    !beach?.swell_access_factors ||
    !Array.isArray(beach.swell_access_factors) ||
    beach.swell_access_factors.length !== TERRAIN_BINS
  ) {
    return 1.0;
  }

  // Get bin index and clamp access value
  const bin = toBin5(swellDirectionDeg);
  const access = Math.max(0, Math.min(1, beach.swell_access_factors[bin]));

  // Map access [0,1] to direction factor [0.6, 1.0]
  return DIRECTION_FACTOR_MIN + access * DIRECTION_FACTOR_RANGE;
}

/**
 * Transform raw buoy significant wave height to estimated face height
 *
 * Applies shoaling, period amplification, and direction factors to convert
 * raw Hs measurements to face heights that match surfer expectations.
 *
 * @param params Transformation parameters
 * @returns Face height in feet, rounded to 1 decimal place
 *
 * @example
 * // 2ft @ 10s, no terrain = 2.0 x 1.0 x 1.0 x 1.0 = 2.0ft
 * transformToFaceHeight({ rawHeightFt: 2.0, periodS: 10, swellDirectionDeg: null })
 *
 * // 3.5ft @ 14s with good SW access = 3.5 x 1.0 x 1.2 x 1.0 = 4.2ft
 * transformToFaceHeight({
 *   rawHeightFt: 3.5,
 *   periodS: 14,
 *   swellDirectionDeg: 225,
 *   beach: { terrain_enabled: true, swell_access_factors: [...] }
 * })
 */
export function transformToFaceHeight(params: TransformParams): number {
  const { rawHeightFt, periodS, swellDirectionDeg, beach } = params;

  // Validate input - return 0 for invalid values
  if (!Number.isFinite(rawHeightFt) || rawHeightFt < 0) {
    return 0;
  }

  // Calculate component factors
  const periodFactor = calculatePeriodFactor(periodS);
  const dirFactor = calculateDirectionFactor(swellDirectionDeg, beach);

  // Apply transformation
  const faceHeight = rawHeightFt * BASE_SHOALING * periodFactor * dirFactor;

  // Round to 1 decimal place
  return Math.round(faceHeight * 10) / 10;
}

/**
 * Get transformation factors for debugging/transparency
 *
 * Useful for understanding why a particular face height was calculated.
 *
 * @param params Transformation parameters
 * @returns Object with all factors and intermediate values
 */
export function getTransformationFactors(params: TransformParams): {
  rawHeightFt: number;
  baseShoaling: number;
  periodFactor: number;
  directionFactor: number;
  faceHeightFt: number;
} {
  const periodFactor = calculatePeriodFactor(params.periodS);
  const directionFactor = calculateDirectionFactor(params.swellDirectionDeg, params.beach);
  const faceHeightFt = transformToFaceHeight(params);

  return {
    rawHeightFt: params.rawHeightFt,
    baseShoaling: BASE_SHOALING,
    periodFactor,
    directionFactor,
    faceHeightFt,
  };
}

/**
 * Transform raw buoy significant wave height to face height range
 *
 * Returns a range representing average waves (low) to set waves (high).
 * Set waves are typically 50% larger than average waves.
 *
 * @param params Transformation parameters
 * @returns Wave height range with low (average) and high (set) values
 *
 * @example
 * // 3ft @ 10s = 3.0ft average, 4.5ft sets
 * transformToFaceHeightRange({ rawHeightFt: 3.0, periodS: 10, swellDirectionDeg: null })
 * // Returns { low: 3.0, high: 4.5 }
 */
export function transformToFaceHeightRange(params: TransformParams): WaveHeightRange {
  const low = transformToFaceHeight(params);
  const high = Math.round(low * SET_WAVE_VARIANCE * 10) / 10;
  return { low, high };
}
