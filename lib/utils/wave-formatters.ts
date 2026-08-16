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
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
  type WaveHeightSourceTag,
  type WaveHeightTransformProvenance,
  type SwellComponentInput,
  BASE_SHOALING,
  calculatePeriodFactor,
  calculateDirectionFactor,
} from './wave-height-transformer';
import {
  METERS_TO_FEET,
  metersToFeet as convertMetersToFeet,
} from './unit-conversions';
import { createContextLogger } from '@/lib/logger';
import {
  CDIP_OUTLIER_THRESHOLD,
  MAX_TRUSTED_CDIP_FT,
} from '@/lib/config/forecast-staleness';
import type { ForecastHandoffBlendMetadata } from './forecast-handoff-blend';

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
// Water Temperature Formatting
// ============================================================================

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
 * Accepts a [min, max] tuple, a single NPC height, or separate horizon-strip
 * min/max heights. Tuple calls support decimal or integer precision.
 * @returns Formatted range string (e.g., "3.5-5.0ft" or "3-5ft")
 *
 * @example
 * ```typescript
 * formatWaveRange([3.2, 5.8])             // "3.2-5.8ft"
 * formatWaveRange([3.2, 5.8], "integer")  // "3-6ft"
 * formatWaveRange([4, 4])                 // "4.0ft"
 * formatWaveRange(3.5)                   // "3-4ft"
 * formatWaveRange(2, 4)                   // "2-4ft"
 * ```
 */
export function formatWaveRange(
  range: [number, number],
  precision?: "decimal" | "integer"
): string;
export function formatWaveRange(heightFt: number): string;
export function formatWaveRange(minHeight: number, maxHeight: number): string;
export function formatWaveRange(
  rangeOrMin: [number, number] | number,
  precisionOrMax: "decimal" | "integer" | number = "decimal"
): string {
  if (typeof rangeOrMin === "number") {
    if (typeof precisionOrMax !== "number") {
      const lower = Math.max(0, Math.floor(rangeOrMin - 0.5));
      const upper = Math.ceil(rangeOrMin + 0.5);
      return `${lower}-${upper}ft`;
    }

    const minHeight = rangeOrMin;
    const maxHeight = precisionOrMax;
    if (minHeight <= 0 && maxHeight <= 0) return "Flat";

    const minInt = Math.max(0, Math.floor(minHeight));
    const maxInt = Math.ceil(maxHeight);
    if (minInt === maxInt) return `${minInt}ft`;
    return `${minInt}-${maxInt}ft`;
  }

  const [min, max] = rangeOrMin;
  const precision = precisionOrMax === "integer" ? "integer" : "decimal";

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
export function metersToFeet(m?: number | null): number | undefined {
  const converted = convertMetersToFeet(m, null);
  return converted == null || !isFinite(converted) ? undefined : converted;
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
 * Format a wave height range as a compact string for display.
 *
 * Surfline-parity format: brackets the input range by floor(low)/ceil(high)
 * and outputs "X-Yft" (or "Xft" when collapsed). Drops the prior " sets"
 * suffix so Quiver matches Surfline's surf.min / surf.max convention.
 *
 * Callers that previously synthesized `high = face × 1.5` to render a "sets"
 * expansion should now pass `high = low` (or use {@link formatWaveHeightRange}
 * with a single arg) to avoid inflating the upper bound. Callers that pass
 * a real range (e.g. min/max wave heights across an hour window) get that
 * range honored.
 *
 * @param low Lower face wave height in feet
 * @param high Upper face wave height in feet (pass `low` for single-point inputs)
 * @returns Formatted range like "3-4ft" or "4ft"
 */
export function formatWaveHeightRangeString(low: number, high: number): string {
  const lo = Math.floor(low);
  const hi = Math.ceil(high);
  if (lo === hi) return `${lo}ft`;
  return `${lo}-${hi}ft`;
}

// ============================================================================
// Wave Height Source Selection (from wave-height-formatter.ts)
// ============================================================================

/**
 * Wave height source selection input parameters
 */
export interface WaveHeightSourceParams {
  /** Explicit nowcast/guardrail observation anchor in meters. Wins over forecast sources. */
  nowcastAnchorM?: number | null;
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
  /**
   * Source identifier. Used downstream by `transformToFaceHeight` to gate
   * the per-beach `shoaling_factors` short-circuit (only valid when source
   * === 'cdip_sig'). Type imported from wave-height-transformer to keep the
   * two files in sync.
   */
  source: WaveHeightSourceTag;
  /**
   * Set when CDIP Hs was passed in but the selector rejected it as an
   * outlier and fell back to a non-CDIP source. Populated for traceability
   * (see `WaveHeightDebugInfo`). Absent when CDIP was either chosen as the
   * source or simply not available.
   */
  cdipRejection?: {
    reason: 'cdip_too_large' | 'cdip_outlier_vs_model';
    rawCdipHs: number;
    rawModelHs: number | null;
  };
}

/**
 * Select the best available wave height source using priority rules
 *
 * Priority:
 * 1. Explicit nowcast anchor
 * 2. CDIP significant height (when reasonable and not outlier vs model)
 * 3. Model primary swell
 * 4. CDIP swell
 * 5. Model Hs
 * 6. NDBC buoy
 *
 * @param params Wave height source parameters
 * @returns Best available source with height, or null if no valid source
 */
export function selectWaveHeightSource(
  params: WaveHeightSourceParams
): WaveHeightSource | null {
  const nowcastAnchor = metersToFeet(params.nowcastAnchorM);
  const cdipSig = validateWaveHeight(params.cdipSigFt);
  const cdipSwell = validateWaveHeight(params.cdipSwellFt);
  const modelSwell = metersToFeet(params.modelSwellM);
  const modelHs = metersToFeet(params.modelHsM);
  const ndbcBuoy = metersToFeet(params.ndbcBuoyM);

  if (nowcastAnchor !== undefined) {
    return { heightFt: nowcastAnchor, source: 'nowcast_anchor' };
  }

  // Prefer CDIP significant height when available and within reasonable range
  if (cdipSig !== undefined && cdipSig <= MAX_TRUSTED_CDIP_FT) {
    // If we also have model swell and CDIP is a large outlier, defer to model
    if (
      modelSwell !== undefined &&
      cdipSig > modelSwell * CDIP_OUTLIER_THRESHOLD &&
      !isCdipCorroboratedByModelHs(cdipSig, modelHs)
    ) {
      return {
        heightFt: modelSwell,
        source: 'model_swell',
        cdipRejection: {
          reason: 'cdip_outlier_vs_model',
          rawCdipHs: cdipSig,
          rawModelHs: modelSwell,
        },
      };
    }
    return { heightFt: cdipSig, source: 'cdip_sig' };
  }

  // CDIP present but exceeds MAX_TRUSTED_CDIP_FT — record rejection so the
  // caller can surface why we fell off the CDIP path.
  const cdipTooLargeRejection: WaveHeightSource['cdipRejection'] | undefined =
    cdipSig !== undefined && cdipSig > MAX_TRUSTED_CDIP_FT
      ? {
          reason: 'cdip_too_large',
          rawCdipHs: cdipSig,
          rawModelHs: modelSwell ?? null,
        }
      : undefined;

  // Prefer model primary swell
  if (modelSwell !== undefined) {
    return {
      heightFt: modelSwell,
      source: 'model_swell',
      ...(cdipTooLargeRejection ? { cdipRejection: cdipTooLargeRejection } : {}),
    };
  }

  // CDIP swell as fallback
  if (cdipSwell !== undefined) {
    return {
      heightFt: cdipSwell,
      source: 'cdip_swell',
      ...(cdipTooLargeRejection ? { cdipRejection: cdipTooLargeRejection } : {}),
    };
  }

  // Model Hs as last resort
  if (modelHs !== undefined) {
    return {
      heightFt: modelHs,
      source: 'model_hs',
      ...(cdipTooLargeRejection ? { cdipRejection: cdipTooLargeRejection } : {}),
    };
  }

  // NDBC buoy as final fallback
  if (ndbcBuoy !== undefined) {
    return {
      heightFt: ndbcBuoy,
      source: 'ndbc_buoy',
      ...(cdipTooLargeRejection ? { cdipRejection: cdipTooLargeRejection } : {}),
    };
  }

  return null;
}

function isCdipCorroboratedByModelHs(
  cdipSigFt: number,
  modelHsFt: number | undefined,
): boolean {
  return modelHsFt !== undefined &&
    cdipSigFt <= modelHsFt * CDIP_OUTLIER_THRESHOLD;
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
  /** Allows guarded nowcast anchors to use calibrated per-beach shoaling factors. */
  allowCalibratedShoaling?: boolean;
}

/**
 * Convert various swell/height inputs to a display face height in feet.
 *
 * Applies beach-specific wave transformation including:
 * - Base shoaling factor (1.0x generic; population prior for uncalibrated beaches)
 *   - raw model data already accounts for shoaling
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

  // Transform using beach-specific factors.
  // `source.source` is forwarded so the transformer can gate its per-beach
  // shoaling_factors short-circuit: the bucket multiplier is only valid when
  // the input came from CDIP Hs, not when selectWaveHeightSource fell back
  // to model swell / model Hs / NDBC buoy.
  const faceHeight = transformToFaceHeight({
    rawHeightFt: source.heightFt,
    periodS: params.periodS ?? null,
    swellDirectionDeg: params.swellDirectionDeg ?? null,
    beach: params.beach ?? null,
    source: source.source,
    allowCalibratedShoaling: params.allowCalibratedShoaling,
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
 * Parameters for decomposed face-height transformation.
 *
 * Extends `FaceHeightParams` with an explicit per-component slot so the
 * forecast builder (and anywhere that has raw WW3 components on hand) can
 * run the alignment-weighted decomposition pipeline instead of the
 * single-bucket short-circuit. When `components` is empty or all null,
 * behavior is identical to `toFaceHeightFeet`.
 */
export interface DecomposedFaceHeightParams extends FaceHeightParams {
  /**
   * Per-swell-component inputs (heights in feet, not meters). Caller is
   * responsible for the unit conversion so this API stays consistent with
   * the scalar `toFaceHeightFeet` path. Null slots are permitted and mean
   * "no data" for that component.
   */
  components: Array<SwellComponentInput | null>;
}

/**
 * Decomposed face-height variant of `toFaceHeightFeet`.
 *
 * Applies per-component alignment weighting + short-period cutoff + RMS
 * sum via `transformToFaceHeightDecomposed`. Falls back to the scalar
 * pipeline when no components are populated (bad/missing WW3 data) — in
 * that case the return value is byte-identical to `toFaceHeightFeet`.
 *
 * Introduced as part of the Workstream A shoaling decomposition fix; the
 * forecast builder uses this path for rows where it has WW3 component
 * data on hand, falling through to `toFaceHeightFeet` otherwise. Scalar
 * callers (scoring, discovery) keep using `toFaceHeightFeet` unchanged.
 */
export function toFaceHeightFeetDecomposed(
  params: DecomposedFaceHeightParams,
): string | null {
  return toFaceHeightFeetDecomposedWithDebug(params).value;
}

/**
 * Provenance metadata emitted alongside a face-height computation.
 *
 * Surfaced from the forecast builder into `enhanced_forecasts.raw_forecast`
 * so future "why does Quiver show X?" questions can be answered from one row.
 *
 * Fields:
 * - `source`: which raw input was actually used (after CDIP outlier checks).
 * - `rawHeightFt`: the raw input height in feet, before transformation.
 * - `provenance`: `'measured'`, `'population_prior_v1'`, or `'generic'`.
 * - `transformPath`: which math path inside the transformer fired.
 *   - `'scalar_calibrated'`: `transformToFaceHeightWithMetadata` ran the
 *     per-beach `shoaling_factors` short-circuit (CDIP source + bucket hit).
 *   - `'scalar_generic'`: legacy `base × period × direction` path.
 *   - `'decomposed'`: per-component RMS sum with alignment weighting.
 * - `componentsUsed`: true when the decomposed branch RMS-summed components.
 * - `calibratedShoalingFired`: true when the empirical bucket lookup hit
 *   (only possible when source is `cdip_sig` and the beach has factors).
 * - `calibrationBucketQuarantined`: true when a low long-period CDIP bucket
 *   was skipped and the generic transformer path rendered the row instead.
 * - `cdipRejection`: present when `selectWaveHeightSource` rejected CDIP as
 *   an outlier and fell back to model/NDBC. Records the why for traceability.
 */
export interface WaveHeightDebugInfo {
  source: WaveHeightSourceTag | null;
  rawHeightFt: number | null;
  provenance: WaveHeightTransformProvenance;
  transformPath: 'scalar_calibrated' | 'scalar_generic' | 'decomposed' | null;
  componentsUsed: boolean;
  calibratedShoalingFired: boolean;
  calibrationBucketQuarantined?: boolean;
  handoffDiscontinuityFt?: number;
  handoffBlend?: ForecastHandoffBlendMetadata;
  cdipRejection?: {
    reason: 'cdip_too_large' | 'cdip_outlier_vs_model';
    rawCdipHs: number;
    rawModelHs: number | null;
  };
}

/**
 * Sibling of `toFaceHeightFeetDecomposed` that also returns provenance
 * metadata. Used by the forecast builder to populate `raw_forecast` so every
 * stored row carries enough information to explain its own number.
 *
 * Behavior is identical to `toFaceHeightFeetDecomposed` — same selector,
 * same transformer, same clamp/round. The only difference is the return
 * shape includes `debug`.
 */
export function toFaceHeightFeetDecomposedWithDebug(
  params: DecomposedFaceHeightParams,
): { value: string | null; debug: WaveHeightDebugInfo } {
  const source = selectWaveHeightSource(params);
  if (!source) {
    return {
      value: null,
      debug: {
        source: null,
        rawHeightFt: null,
        provenance: 'generic',
        transformPath: null,
        componentsUsed: false,
        calibratedShoalingFired: false,
      },
    };
  }

  const result = transformToFaceHeightDecomposed({
    components: params.components,
    beach: params.beach ?? {},
    source: source.source,
    rawHeightFt: source.heightFt,
    periodS: params.periodS ?? null,
    swellDirectionDeg: params.swellDirectionDeg ?? null,
    allowCalibratedShoaling: params.allowCalibratedShoaling,
  });

  const clamped = clampWaveHeight(result.faceHeightFt);
  const rounded = roundWaveHeight(clamped);

  const transformPath: WaveHeightDebugInfo['transformPath'] =
    result.path === 'decomposed'
      ? 'decomposed'
      : result.isCalibrated
        ? 'scalar_calibrated'
        : 'scalar_generic';

  return {
    value: `${rounded} ft`,
    debug: {
      source: source.source,
      rawHeightFt: source.heightFt,
      provenance: result.provenance,
      transformPath,
      componentsUsed: result.path === 'decomposed',
      calibratedShoalingFired: result.isCalibrated,
      ...(result.calibrationBucketQuarantined
        ? { calibrationBucketQuarantined: true }
        : {}),
      ...(source.cdipRejection ? { cdipRejection: source.cdipRejection } : {}),
    },
  };
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

  // Surfline-parity: face Hs bracketed by floor/ceil, no × 1.5 expansion.
  return formatWaveHeightRangeString(low, low);
}
