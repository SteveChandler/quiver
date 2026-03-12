/**
 * Wave Formatting Utilities
 *
 * Shared utilities for formatting wave heights and ranges across the application.
 * Used by forecast components, beach conditions displays, and swell event cards.
 *
 * Consolidates logic previously spread across:
 *   - lib/utils/wave-formatters.ts (formatWaveHeightDecimal, formatWaveRange, size labels)
 *   - lib/utils/wave-height-formatter.ts (formatWaveHeightBucket, parsing, source selection, face-height)
 *
 * @module lib/utils/wave-formatters
 */

import {
  transformToFaceHeight,
  SET_WAVE_VARIANCE,
  type BeachTerrainConfig,
  BASE_SHOALING,
  calculatePeriodFactor,
  calculateDirectionFactor,
} from './wave-height-transformer';
import { METERS_TO_FEET } from './unit-conversions';
import { createContextLogger } from '@/lib/logger';

// Re-export for backward compatibility (consumers may import from here)
export { METERS_TO_FEET };

const log = createContextLogger('WaveHeightFormatter');

// ============================================================================
// Constants
// ============================================================================

/**
 * Regex pattern for extracting numeric wave height values from strings
 * Matches formats like: "3", "3.2", "3.2 ft", "3-5 ft" (extracts first number)
 */
export const WAVE_HEIGHT_NUMBER_PATTERN = /(\d+(?:\.\d+)?)/;

/**
 * Wave height range definitions for display formatting
 * Each entry defines: [maxHeight, displayRange]
 */
const WAVE_HEIGHT_RANGES: ReadonlyArray<readonly [number, string]> = [
  [1, "0-1ft"],
  [2, "1-2ft"],
  [3, "2-3ft"],
  [4, "3-4ft"],
  [5, "4-5ft"],
  [6, "5-6ft"],
  [8, "6-8ft"],
  [10, "8-10ft"],
] as const;

/**
 * Minimum allowed wave height after clamping (feet)
 */
const MIN_WAVE_HEIGHT_FT = 0.5;

/**
 * Maximum allowed wave height after clamping (feet)
 */
const MAX_WAVE_HEIGHT_FT = 15;

/**
 * CDIP outlier threshold - if CDIP exceeds model by this factor, use model instead
 */
const CDIP_OUTLIER_THRESHOLD = 1.8;

/**
 * Maximum CDIP significant height to trust (feet)
 */
const MAX_TRUSTED_CDIP_FT = 10;

/**
 * Minimum transformation ratio that indicates proper transformation occurred.
 * If actual transformation is less than this, debug logging is triggered
 * to help identify issues with wave height calculations.
 * Note: With BASE_SHOALING=1.0, minimum is 0.8 (short period with blocked direction)
 */
const MIN_EXPECTED_TRANSFORM_RATIO = 0.9;

/**
 * Minimum wave height (feet) to trigger transformation debug logging.
 * Below this threshold, low transformation ratios are expected and not logged.
 */
const MIN_HEIGHT_FOR_TRANSFORM_DEBUG = 1.5;

// ============================================================================
// Human-readable size labels (from original wave-formatters.ts)
// ============================================================================

/**
 * Human-readable labels for wave size descriptions
 * Used for display text in UI components
 */
export const WAVE_SIZE_LABELS: Record<string, string> = {
  "knee-high": "Small Swell",
  "waist-high": "Small Swell",
  "chest-high": "Medium Swell",
  "head-high": "Solid Swell",
  overhead: "Big Swell",
  "double-overhead": "Epic Swell",
};

// ============================================================================
// Renamed formatWaveHeight variants (three distinct functions, unique names)
// ============================================================================

/**
 * Format a single wave height for display with one decimal place.
 * (Previously named `formatWaveHeight` in lib/utils/wave-formatters.ts)
 *
 * @param height - Wave height in feet (negative values treated as 0)
 * @returns Formatted string (e.g., "3.5ft" or "Flat")
 *
 * @example
 * ```typescript
 * formatWaveHeightDecimal(3.5) // "3.5ft"
 * formatWaveHeightDecimal(0)   // "Flat"
 * ```
 */
export function formatWaveHeightDecimal(height: number): string {
  // Handle invalid/negative values
  if (height <= 0) return "Flat";
  return `${height.toFixed(1)}ft`;
}

/**
 * Format wave height for display in badges and UI using predefined bucket ranges.
 * (Previously named `formatWaveHeight` in lib/utils/wave-height-formatter.ts)
 *
 * Uses predefined ranges for consistent display.
 *
 * @param waveHeight Wave height in feet (number, string, or null/undefined)
 * @returns Formatted wave height string (e.g., "2-3ft", "8ft+")
 */
export function formatWaveHeightBucket(waveHeight?: number | string | null): string {
  const parsed = parseWaveHeight(waveHeight);

  if (!parsed || parsed === 0) return "0-1ft";

  // Find matching range from predefined list
  for (const [maxHeight, displayRange] of WAVE_HEIGHT_RANGES) {
    if (parsed < maxHeight) return displayRange;
  }

  // Large waves beyond predefined ranges
  return `${Math.floor(parsed)}ft+`;
}

// ============================================================================
// Wave Range Formatting (from original wave-formatters.ts)
// ============================================================================

/**
 * Format a wave height range for display
 *
 * @param range - Tuple of [min, max] wave heights in feet
 * @param precision - "decimal" for one decimal place (default), "integer" for whole numbers
 * @returns Formatted range string (e.g., "3.5-5.0ft" or "3-5ft")
 *
 * @example
 * ```typescript
 * formatWaveRange([3.2, 5.8])             // "3.2-5.8ft"
 * formatWaveRange([3.2, 5.8], "integer")  // "3-6ft"
 * formatWaveRange([4, 4])                 // "4.0ft"
 * ```
 */
export function formatWaveRange(
  range: [number, number],
  precision: "decimal" | "integer" = "decimal"
): string {
  const [min, max] = range;

  if (precision === "integer") {
    const minInt = Math.round(min);
    const maxInt = Math.round(max);
    if (minInt === maxInt) return `${minInt}ft`;
    return `${minInt}-${maxInt}ft`;
  }

  if (min === max) {
    return `${min.toFixed(1)}ft`;
  }
  return `${min.toFixed(1)}-${max.toFixed(1)}ft`;
}

// ============================================================================
// Size Description Utilities (from original wave-formatters.ts)
// ============================================================================

/**
 * Get human-readable wave size description based on height
 *
 * Size categories:
 * - <2ft: knee-high
 * - 2-3ft: waist-high
 * - 3-5ft: chest-high
 * - 5-7ft: head-high
 * - 7-10ft: overhead
 * - 10ft+: double-overhead
 *
 * @param heightFt - Wave height in feet
 * @returns Size description string (e.g., "chest-high", "overhead")
 *
 * @example
 * ```typescript
 * getWaveSizeDescription(4)   // "chest-high"
 * getWaveSizeDescription(8)   // "overhead"
 * getWaveSizeDescription(12)  // "double-overhead"
 * ```
 */
export function getWaveSizeDescription(heightFt: number): string {
  if (heightFt < 2) return "knee-high";
  if (heightFt < 3) return "waist-high";
  if (heightFt < 5) return "chest-high";
  if (heightFt < 7) return "head-high";
  if (heightFt < 10) return "overhead";
  return "double-overhead";
}

/**
 * Get excitement label for a given wave size
 *
 * @param size - Wave size description (from getWaveSizeDescription)
 * @returns Human-readable label for the swell
 *
 * @example
 * ```typescript
 * getWaveSizeLabel("overhead")        // "Big Swell"
 * getWaveSizeLabel("double-overhead") // "Epic Swell"
 * ```
 */
export function getWaveSizeLabel(size: string): string {
  return WAVE_SIZE_LABELS[size] || "Swell Incoming";
}

// ============================================================================
// Utility Functions (from wave-height-formatter.ts)
// ============================================================================

/**
 * Extract the first numeric value from a wave height string
 * @param heightString String containing wave height
 * @returns Numeric value or null if no match
 */
export function extractNumericWaveHeight(heightString: string): number | null {
  const match = heightString.match(WAVE_HEIGHT_NUMBER_PATTERN);
  if (!match) return null;
  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Round wave height to 1 decimal place (standard precision)
 * @param ft Height in feet
 * @returns Rounded value
 */
export function roundWaveHeight(ft: number): number {
  return Math.round(ft * 10) / 10;
}

/**
 * Apply clamping to wave height within reasonable bounds
 * @param ft Height in feet
 * @returns Clamped value between MIN_WAVE_HEIGHT_FT and MAX_WAVE_HEIGHT_FT
 */
export function clampWaveHeight(ft: number): number {
  return Math.min(MAX_WAVE_HEIGHT_FT, Math.max(MIN_WAVE_HEIGHT_FT, ft));
}

/**
 * Convert meters to feet
 * @param m Height in meters
 * @returns Height in feet or undefined if invalid
 */
function metersToFeet(m?: number | null): number | undefined {
  return m == null || !isFinite(m) ? undefined : m * METERS_TO_FEET;
}

/**
 * Validate and normalize a wave height value
 * @param value Raw wave height value
 * @returns Validated number or undefined if invalid
 */
function validateWaveHeight(value?: number | null): number | undefined {
  return value != null && isFinite(value) ? value : undefined;
}

// ============================================================================
// Parsing Functions (from wave-height-formatter.ts)
// ============================================================================

/**
 * Parse wave height from various formats to get numeric value
 * @param waveHeight Wave height as number, string, or null/undefined
 * @returns Numeric wave height in feet or undefined
 */
export function parseWaveHeight(
  waveHeight?: number | string | null
): number | undefined {
  if (waveHeight === null || waveHeight === undefined || waveHeight === "")
    return undefined;

  // If it's already a number, return it
  if (typeof waveHeight === "number") {
    return waveHeight;
  }

  // If it's a string, extract numeric value
  if (typeof waveHeight === "string") {
    const numeric = extractNumericWaveHeight(waveHeight);
    return numeric ?? undefined;
  }

  return undefined;
}

/**
 * Get the raw numeric wave height value from any format
 * @param waveHeight Wave height in any format
 * @returns Numeric value or undefined
 */
export function getWaveHeightValue(
  waveHeight?: number | string | null
): number | undefined {
  return parseWaveHeight(waveHeight);
}

// ============================================================================
// Formatting Functions (from wave-height-formatter.ts)
// ============================================================================

/**
 * Determine if wave height range is small (< 1ft difference)
 * Small ranges use half-foot precision for display.
 */
function isSmallRange(low: number, high: number): boolean {
  return Math.abs(high - low) < 1;
}

/**
 * Round to half-foot precision (0.5ft increments)
 */
function roundToHalfFoot(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Format a wave height value with appropriate precision
 * @param n Wave height value
 * @param useHalfFootPrecision Whether to use half-foot (0.5) precision
 * @returns Formatted string (e.g., "3", "2.5")
 */
function formatWaveHeightValue(n: number, useHalfFootPrecision: boolean): string {
  if (useHalfFootPrecision) {
    const rounded = roundToHalfFoot(n);
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  }
  return Math.round(n).toString();
}

/**
 * Format a wave height range as a compact string for display.
 *
 * Uses integer format when range is >= 1ft, half-foot precision otherwise.
 * Returns single value if low and high round to the same number.
 *
 * @param low Average wave height in feet
 * @param high Set wave height in feet
 * @returns Formatted range like "3-5ft" or "4ft"
 *
 * @example
 * formatWaveHeightRangeString(3.2, 4.8) // "3-5ft"
 * formatWaveHeightRangeString(1.2, 1.8) // "1-2ft"
 * formatWaveHeightRangeString(0.8, 1.2) // "1ft" (both round to same)
 */
export function formatWaveHeightRangeString(low: number, high: number): string {
  const useHalfFoot = isSmallRange(low, high);
  const lowStr = formatWaveHeightValue(low, useHalfFoot);
  const highStr = formatWaveHeightValue(high, useHalfFoot);

  // If they round to the same value, just show single value
  if (lowStr === highStr) return `${lowStr}ft`;
  return `${lowStr}-${highStr}ft`;
}

// ============================================================================
// Wave Height Source Selection (from wave-height-formatter.ts)
// ============================================================================

/**
 * Wave height source selection input parameters
 */
export interface WaveHeightSourceParams {
  cdipSigFt?: number | null;
  cdipSwellFt?: number | null;
  modelSwellM?: number | null;
  modelHsM?: number | null;
  /** NDBC buoy wave height in meters */
  ndbcBuoyM?: number | null;
}

/**
 * Raw wave height source selection result
 */
export interface WaveHeightSource {
  /** Raw height in feet */
  heightFt: number;
  /** Source identifier for debugging/logging */
  source: 'cdip_sig' | 'model_swell' | 'cdip_swell' | 'model_hs' | 'ndbc_buoy';
}

/**
 * Select the best available wave height source using priority rules
 *
 * Priority:
 * 1. CDIP significant height (when reasonable and not outlier vs model)
 * 2. Model primary swell
 * 3. CDIP swell
 * 4. Model Hs
 * 5. NDBC buoy
 *
 * @param params Wave height source parameters
 * @returns Best available source with height, or null if no valid source
 */
export function selectWaveHeightSource(
  params: WaveHeightSourceParams
): WaveHeightSource | null {
  const cdipSig = validateWaveHeight(params.cdipSigFt);
  const cdipSwell = validateWaveHeight(params.cdipSwellFt);
  const modelSwell = metersToFeet(params.modelSwellM);
  const modelHs = metersToFeet(params.modelHsM);
  const ndbcBuoy = metersToFeet(params.ndbcBuoyM);

  // Prefer CDIP significant height when available and within reasonable range
  if (cdipSig !== undefined && cdipSig <= MAX_TRUSTED_CDIP_FT) {
    // If we also have model swell and CDIP is a large outlier, defer to model
    if (modelSwell !== undefined && cdipSig > modelSwell * CDIP_OUTLIER_THRESHOLD) {
      return { heightFt: modelSwell, source: 'model_swell' };
    }
    return { heightFt: cdipSig, source: 'cdip_sig' };
  }

  // Prefer model primary swell
  if (modelSwell !== undefined) {
    return { heightFt: modelSwell, source: 'model_swell' };
  }

  // CDIP swell as fallback
  if (cdipSwell !== undefined) {
    return { heightFt: cdipSwell, source: 'cdip_swell' };
  }

  // Model Hs as last resort
  if (modelHs !== undefined) {
    return { heightFt: modelHs, source: 'model_hs' };
  }

  // NDBC buoy as final fallback
  if (ndbcBuoy !== undefined) {
    return { heightFt: ndbcBuoy, source: 'ndbc_buoy' };
  }

  return null;
}

// ============================================================================
// Main Transformation Functions (from wave-height-formatter.ts)
// ============================================================================

/**
 * Parameters for face height transformation
 */
export interface FaceHeightParams extends WaveHeightSourceParams {
  /** Beach terrain configuration for direction factor */
  beach?: BeachTerrainConfig | null;
  /** Wave period in seconds for period amplification */
  periodS?: number | null;
  /** Swell direction in degrees for terrain-based direction factor */
  swellDirectionDeg?: number | null;
}

/**
 * Convert various swell/height inputs to a display face height in feet.
 *
 * Applies beach-specific wave transformation including:
 * - Base shoaling factor (1.0x) - raw model data already accounts for shoaling
 * - Period amplification - longer periods = bigger faces
 * - Direction factor from terrain swell_access_factors
 *
 * @param params Wave height and beach configuration
 * @returns Formatted face height string (e.g., "3.2 ft") or null if no data
 */
export function toFaceHeightFeet(params: FaceHeightParams): string | null {
  // Select best available source
  const source = selectWaveHeightSource(params);
  if (!source) return null;

  // Calculate factors for debugging
  const periodFactor = calculatePeriodFactor(params.periodS ?? null);
  const directionFactor = calculateDirectionFactor(params.swellDirectionDeg ?? null, params.beach ?? null);

  // Transform using beach-specific factors
  const faceHeight = transformToFaceHeight({
    rawHeightFt: source.heightFt,
    periodS: params.periodS ?? null,
    swellDirectionDeg: params.swellDirectionDeg ?? null,
    beach: params.beach ?? null,
  });

  // Clamp and round
  const clamped = clampWaveHeight(faceHeight);
  const rounded = roundWaveHeight(clamped);

  // Debug logging to trace transformation issues
  // Log when transformation appears to have minimal effect (raw ≈ face)
  const transformRatio = faceHeight / source.heightFt;
  if (transformRatio < MIN_EXPECTED_TRANSFORM_RATIO && source.heightFt > MIN_HEIGHT_FOR_TRANSFORM_DEBUG) {
    log.debug('Wave height transformation debug', {
      source: source.source,
      rawHeightFt: source.heightFt,
      periodS: params.periodS,
      swellDirectionDeg: params.swellDirectionDeg,
      hasBeachTerrain: !!params.beach?.terrain_enabled,
      periodFactor,
      directionFactor,
      baseShoaling: BASE_SHOALING,
      expectedMinFactor: BASE_SHOALING * 0.8, // 0.8 minimum
      actualFactor: transformRatio,
      faceHeight,
      clamped,
      rounded,
    });
  }

  return `${rounded} ft`;
}

/**
 * Convert various swell/height inputs to a face height range string.
 *
 * Uses the same source selection logic as toFaceHeightFeet but returns
 * a range string like "3-5ft" representing average to set waves.
 *
 * @param params Wave height inputs and beach configuration
 * @returns Formatted range string like "3-5ft" or null if no data
 *
 * @example
 * toFaceHeightRangeFeet({ cdipSigFt: 2.0, periodS: 10 })
 * // Returns "3-5ft" (3.2ft average × 1.5 = 4.8ft sets, rounded)
 */
export function toFaceHeightRangeFeet(params: FaceHeightParams): string | null {
  // Get the single height first using existing logic
  const singleHeight = toFaceHeightFeet(params);
  if (!singleHeight) return null;

  // Extract numeric value using shared utility
  const low = extractNumericWaveHeight(singleHeight);
  if (low === null) return null;

  // Calculate set wave height and format as range
  return formatWaveHeightRangeString(low, low * SET_WAVE_VARIANCE);
}
