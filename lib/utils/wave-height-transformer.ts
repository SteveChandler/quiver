/**
 * Wave Height Transformer
 *
 * Transforms raw buoy significant wave height (Hs) into estimated face heights
 * that match what surfers expect from services like Surfline/Surf Captain.
 *
 * The transformation applies:
 * 1. Base shoaling factor (1.0x generic, population prior on uncalibrated beaches)
 *    - raw model data already accounts for shoaling
 * 2. Period amplification - longer periods (14-20s) = bigger faces
 * 3. Beach-specific swell access - uses terrain swell_access_factors
 *
 * Formula:
 *   face_height = Hs x base_shoaling x period_factor x direction_factor
 *
 * Example: 3.5ft Hs @ 14s with good direction = 3.5 x 1.0 x 1.2 x 1.0 = 4.2ft face
 */

import { toBin5, TERRAIN_BINS } from '@/types/terrain';
import type { WaveHeightSourceTag } from './wave-height-source';

export type { WaveHeightSourceTag } from './wave-height-source';

/**
 * One bucket in a period-keyed shoaling factor lookup table.
 * Matches on `tp_min_s <= periodS < tp_max_s`.
 */
export interface ShoalingBucket {
  tp_min_s: number;
  tp_max_s: number;
  factor: number;
}

/**
 * Empirically calibrated shoaling factor lookup for a specific beach.
 *
 * When a beach has this configured, the wave-height transformer short-circuits
 * the generic `BASE_SHOALING × period × direction` pipeline and multiplies raw
 * Hs by the bucket factor directly. This is how we represent the true ratio of
 * face height to raw CDIP buoy Hs on breaks where the generic pipeline's 1.2x
 * period cap is far too low.
 *
 * Matches the shape stored in the `beaches.shoaling_factors` JSONB column.
 */
export interface ShoalingFactors {
  version: 1;
  type: 'period_lookup';
  buckets: ShoalingBucket[];
  /** Provenance metadata for the calibration — not used at runtime */
  calibration?: Record<string, unknown>;
}

/**
 * Identifies which shoaling basis produced a transformed face height.
 * `population_prior_v1` is deliberately distinct from measured calibration.
 */
export type WaveHeightTransformProvenance =
  | 'generic'
  | 'measured'
  | 'population_prior_v1';

export const POPULATION_PRIOR_PROVENANCE = 'population_prior_v1' as const;

/**
 * Measured population correction for beaches without per-beach observations.
 * These values are the base factor for the same four period buckets used by
 * `shoaling_factors`; they are not a `ShoalingFactors` value and must not be
 * persisted in `beaches.shoaling_factors`.
 */
export const POPULATION_PRIOR_BUCKETS: readonly ShoalingBucket[] = [
  { tp_min_s: 0, tp_max_s: 8, factor: 0.955 },
  { tp_min_s: 8, tp_max_s: 12, factor: 1.020 },
  { tp_min_s: 12, tp_max_s: 16, factor: 1.119 },
  { tp_min_s: 16, tp_max_s: 999, factor: 1.139 },
] as const;

/**
 * Beach terrain configuration needed for wave height transformation
 */
export interface BeachTerrainConfig {
  swell_access_factors?: number[] | null;
  terrain_enabled?: boolean;
  /**
   * Optional per-beach empirically calibrated shoaling lookup.
   * When present, short-circuits the generic period/direction factor pipeline.
   */
  shoaling_factors?: ShoalingFactors | null;
  /**
   * Swell-window center in compass degrees (bearing the open ocean lies from
   * the break). When present together with `swell_window_halfwidth_deg`,
   * `transformToFaceHeightDecomposed` uses it to alignment-weight each swell
   * component so cross-shore / blocked components don't contribute to face
   * height. Null on uncalibrated beaches — decomposition then degrades
   * gracefully to alignment = 1.0. The legacy `transformToFaceHeight` path
   * ignores these fields entirely; they exist on this shape so the new
   * decomposed path and other callers can share one beach descriptor.
   */
  swell_window_center_deg?: number | null;
  /** Half-width of the swell window in degrees (see `swell_window_center_deg`). */
  swell_window_halfwidth_deg?: number | null;
  /**
   * Multiplicative decay factor for deep-water model data at sheltered beaches.
   * Applied to raw component heights before shoaling/alignment math when the
   * source is NOT `cdip_sig` (CDIP buoy data already reflects nearshore
   * conditions — decaying it would double-correct). A value of 0.4 means only
   * 40% of the deep-water energy reaches the break. Null or undefined defaults
   * to 1.0 (no attenuation).
   */
  deepwater_decay_factor?: number | null;
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
  /**
   * Which upstream source produced rawHeightFt. Required to gate the
   * empirically calibrated `shoaling_factors` short-circuit: the calibration
   * was measured against CDIP Hs specifically, so applying it to a model
   * height or buoy swell would produce a wrong answer. When omitted, the
   * short-circuit is skipped and the legacy pipeline runs (safe default).
   */
  source?: WaveHeightSourceTag;
  /**
   * Guarded nowcast anchors may opt into per-beach shoaling buckets when the
   * caller has already proven that the nearshore observation is a valid local
   * floor. Normal nowcast anchors leave this false and use the generic path.
   */
  allowCalibratedShoaling?: boolean;
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
 * Minimum alignment weight for a swell component that is genuinely INSIDE the
 * beach's swell window. The `cos²` taper in `alignmentFactor` falls to ~0 near
 * the window edge, which crushed real long-period groundswell that was in-window
 * but off-center (e.g. a 2 ft 15s swell from 190° at Malibu, center 220°/±40°,
 * rendered as ~0.4 ft). This floor keeps a qualifying in-window component from
 * being attenuated below a meaningful contribution. It applies ONLY to the
 * in-window cos² return — the short-period gate (0) and out-of-window gate (0)
 * are unaffected.
 */
export const ALIGNMENT_FLOOR = 0.35;

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
 * Look up the shoaling factor for a given period from a calibrated lookup table.
 *
 * Returns null when the period is missing/invalid or when no bucket matches.
 * Callers fall back to the generic `base × period × direction` pipeline when
 * the lookup yields null.
 *
 * @param periodS Wave period in seconds
 * @param factors Calibrated shoaling factor lookup
 * @returns Bucket factor or null if no match
 */
export function lookupShoalingBucket(
  periodS: number | null | undefined,
  factors: ShoalingFactors | null | undefined
): number | null {
  if (!factors || factors.type !== 'period_lookup' || !Array.isArray(factors.buckets)) {
    return null;
  }
  // A period of exactly 0 almost always indicates a CDIP NaN sentinel or an
  // uninitialized field — not a real short-wind-chop reading. Reject it along
  // with negative and non-finite values so we fall through to the legacy
  // pipeline where PERIOD_REF=10s provides a safe default.
  if (periodS == null || !Number.isFinite(periodS) || periodS <= 0) {
    return null;
  }
  for (const bucket of factors.buckets) {
    if (periodS >= bucket.tp_min_s && periodS < bucket.tp_max_s) {
      return bucket.factor;
    }
  }
  return null;
}

function lookupPopulationPrior(periodS: number | null | undefined): number | null {
  if (periodS == null || !Number.isFinite(periodS) || periodS <= 0) {
    return null;
  }

  return POPULATION_PRIOR_BUCKETS.find(
    (bucket) => periodS >= bucket.tp_min_s && periodS < bucket.tp_max_s,
  )?.factor ?? null;
}

function getGenericBaseShoalingFactor(
  periodS: number | null | undefined,
  beach: BeachTerrainConfig | null | undefined,
): { factor: number; provenance: WaveHeightTransformProvenance } {
  // A null value is the explicit database representation of an uncalibrated
  // beach. Do not infer that status when no beach calibration field was passed.
  if (beach?.shoaling_factors === null) {
    const priorFactor = lookupPopulationPrior(periodS);
    if (priorFactor != null) {
      return { factor: priorFactor, provenance: POPULATION_PRIOR_PROVENANCE };
    }
  }

  return { factor: BASE_SHOALING, provenance: 'generic' };
}

const QUARANTINED_BUCKET_MIN_PERIOD_S = 15;
const QUARANTINED_BUCKET_MAX_FACTOR = 1;

function isQuarantinedShoalingBucket(
  periodS: number | null | undefined,
  bucketFactor: number,
): boolean {
  return (
    periodS != null &&
    Number.isFinite(periodS) &&
    periodS >= QUARANTINED_BUCKET_MIN_PERIOD_S &&
    bucketFactor < QUARANTINED_BUCKET_MAX_FACTOR
  );
}

/**
 * Transform raw buoy significant wave height to estimated face height
 *
 * Applies shoaling, period amplification, and direction factors to convert
 * raw Hs measurements to face heights that match surfer expectations.
 *
 * When the beach has empirically calibrated `shoaling_factors` AND the
 * caller indicates the input came from CDIP significant height (`source ===
 * 'cdip_sig'`), the transform short-circuits the generic pipeline:
 * `face = raw × bucket_factor(periodS)`. The calibration was measured as
 * `surfline_face_ft / cdip_hs_ft` for each beach's reference buoy, so the
 * bucket multiplier is ONLY valid against that specific input. For model
 * swell, model Hs, or NDBC buoy inputs, the short-circuit is skipped and
 * the legacy `base × period × direction` pipeline runs instead. This matters
 * on XL days where `selectWaveHeightSource` falls back from CDIP to model
 * swell (CDIP > 10 ft or CDIP is an outlier vs model): without the gate we
 * would multiply a model height by a CDIP-denominated factor and produce
 * nonsense. The generic pipeline's `PERIOD_FACTOR_MAX=1.2` cap is the
 * correct treatment for model inputs; only raw CDIP Hs at calibrated beaches
 * gets the larger empirical multipliers (1.6-2.4x).
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
 *
 * // 1.7ft @ 14s at Blacks with shoaling_factors, input is CDIP Hs:
 * //   1.7 × 2.1 = 3.57ft (rounded 3.6) — short-circuit fires
 * transformToFaceHeight({
 *   rawHeightFt: 1.7,
 *   periodS: 14,
 *   swellDirectionDeg: 270,
 *   beach: { shoaling_factors: { version: 1, type: 'period_lookup', buckets: [...] } },
 *   source: 'cdip_sig',
 * })
 *
 * // Same beach, same period, but input came from model swell instead:
 * //   1.7 × 1.0 × 1.2 × 1.0 = 2.04 → 2.0ft — legacy pipeline runs
 * transformToFaceHeight({
 *   rawHeightFt: 1.7,
 *   periodS: 14,
 *   swellDirectionDeg: 270,
 *   beach: { shoaling_factors: blacksFactors },
 *   source: 'model_swell',
 * })
 */
export function transformToFaceHeight(params: TransformParams): number {
  return transformToFaceHeightWithMetadata(params).faceHeightFt;
}

/**
 * Result of a face-height transform with calibration metadata.
 *
 * `isCalibrated` is `true` only when the empirical shoaling short-circuit
 * actually fired for this specific render — i.e. the beach has a
 * `shoaling_factors` lookup, the source is `cdip_sig`, and the period
 * resolved to a valid bucket. A beach with factors in the DB can still
 * render `isCalibrated: false` for a specific reading when its period
 * falls outside the bucket table, the source fell back to model swell,
 * or the raw height is invalid.
 */
export interface FaceHeightWithMetadata {
  faceHeightFt: number;
  isCalibrated: boolean;
  provenance: WaveHeightTransformProvenance;
  calibrationBucketQuarantined?: boolean;
}

/**
 * Transform raw Hs to face height AND report whether the calibration
 * short-circuit actually fired. Used internally when a caller needs to
 * know whether THIS specific reading flowed through the empirical
 * bucket lookup.
 *
 * The `faceHeightFt` value is guaranteed to equal `transformToFaceHeight`
 * for the same params — the two functions share the exact same math path,
 * this one just surfaces the gate decision as a boolean alongside.
 *
 * **Beach-level vs per-reading.** This function returns the **per-reading**
 * state — `isCalibrated: true` means the short-circuit actually fired for
 * THIS particular call with THIS particular period/source combination. The
 * API envelope `EnhancedForecastEntity.isCalibrated` exposed to the client
 * is **beach-level** (`beaches.shoaling_factors IS NOT NULL`), and the UI
 * (`WaveHeightDisplay`) consumes that beach-level signal directly. The
 * two values can diverge: a calibrated beach with a period outside the
 * bucket table, or a reading that fell back to model swell instead of
 * CDIP Hs, will return `isCalibrated: false` from this function but still
 * ship with `isCalibrated: true` on the envelope (because the beach as a
 * population is still calibrated). This is an intentional trade-off
 * documented in `types/forecast.ts` — the honesty layer makes a
 * population-level brand claim ("we've dialed this beach in"), not a
 * per-reading claim.
 *
 * If a future call site needs the true per-reading state (e.g. a data-
 * quality dashboard, a pipeline audit log), hand the result of this
 * function through directly rather than trying to thread a new field
 * through the API envelope.
 */
export function transformToFaceHeightWithMetadata(
  params: TransformParams
): FaceHeightWithMetadata {
  const {
    rawHeightFt,
    periodS,
    swellDirectionDeg,
    beach,
    source,
    allowCalibratedShoaling,
  } = params;

  // Validate input - return 0 for invalid values (not calibrated: a
  // meaningless number cannot be "calibrated").
  if (!Number.isFinite(rawHeightFt) || rawHeightFt < 0) {
    return { faceHeightFt: 0, isCalibrated: false, provenance: 'generic' };
  }

  let calibrationBucketQuarantined = false;

  // Short-circuit: empirically calibrated per-beach shoaling lookup.
  // GATED on source === 'cdip_sig' because the bucket factor is measured as
  // `surfline_face_ft / cdip_hs_ft` — applying it to a model-derived height
  // when CDIP has been rejected (>10ft, outlier, or null) produces the wrong
  // answer. When source is anything else (or omitted), fall through to the
  // generic pipeline which is the correct treatment for model inputs.
  if (canUseCalibratedShoaling(source, allowCalibratedShoaling)) {
    const bucketFactor = lookupShoalingBucket(periodS, beach?.shoaling_factors);
    if (bucketFactor != null) {
      if (shouldQuarantineCalibratedShoalingBucket(source, periodS, bucketFactor)) {
        calibrationBucketQuarantined = true;
      } else {
        const shadow = calibratedShadowFactor(swellDirectionDeg, beach);
        return {
          faceHeightFt: Math.round(rawHeightFt * bucketFactor * shadow * 10) / 10,
          isCalibrated: true,
          provenance: 'measured',
        };
      }
    }
  }

  // Generic path: base × period × direction. Explicitly uncalibrated beaches
  // use the measured population prior as the base; measured beaches that do
  // not take the CDIP short-circuit remain on the original 1.0 base.
  const periodFactor = calculatePeriodFactor(periodS);
  const dirFactor = calculateDirectionFactor(swellDirectionDeg, beach);
  const baseShoaling = getGenericBaseShoalingFactor(periodS, beach);

  // Apply deepwater decay for model data sources.
  // CDIP buoy data already reflects nearshore conditions — decay would double-correct.
  // Model data (Open-Meteo, WW3) predicts deep-water energy that may not reach sheltered beaches.
  const decay = (shouldApplyDeepwaterDecay(source) && beach?.deepwater_decay_factor != null)
    ? beach.deepwater_decay_factor
    : 1.0;

  // Apply transformation
  const faceHeight = rawHeightFt * decay * baseShoaling.factor * periodFactor * dirFactor;

  // Round to 1 decimal place
  return {
    faceHeightFt: Math.round(faceHeight * 10) / 10,
    isCalibrated: false,
    provenance: baseShoaling.provenance,
    ...(calibrationBucketQuarantined ? { calibrationBucketQuarantined } : {}),
  };
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

// ===================================================
// PER-COMPONENT DECOMPOSITION (W-A)
// ===================================================

/**
 * Short-period cutoff used by `alignmentFactor`. Any swell component with
 * period strictly less than this value contributes zero face height, on the
 * grounds that sub-8s energy is wind-swell / sea-state that doesn't produce
 * organized surf regardless of direction. Exposed as a constant so tests
 * and regression scripts can reference the same threshold.
 */
export const SHORT_PERIOD_CUTOFF_S = 8;

/**
 * Wind-wave partitions are less trustworthy as surf-height contributors than
 * swell partitions. Treat borderline 8-9s wind-wave as conditions/texture
 * unless it has clearly organized beyond local wind-sea.
 */
export const WIND_WAVE_FACE_HEIGHT_CUTOFF_S = 9;

const LONG_PERIOD_SOUTH_SWELL_FLOOR_MIN_PERIOD_S = 15;
export const CALIBRATION_BUCKET_QUARANTINE_MIN_PERIOD_S = 15;
export const CALIBRATION_BUCKET_QUARANTINE_MAX_FACTOR = 0.8;
const LONG_PERIOD_SOUTH_SWELL_FLOOR_MIN_ACCESS = 0.02;
const SOUTH_SWELL_FLOOR_MIN_DIRECTION_DEG = 160;
const SOUTH_SWELL_FLOOR_MAX_DIRECTION_DEG = 230;

/**
 * Compute the alignment weight for a single swell component against a beach's
 * swell window.
 *
 * Returns a value in [0, 1] that `transformToFaceHeightDecomposed` multiplies
 * into the component's face-height contribution. Semantics:
 *
 * - `0` when `periodS <= shortPeriodCutoffS` (default 8s). Sub-8s energy is
 *   treated as wind-swell regardless of direction — a west wind-swell that
 *   happens to fall inside Tourmaline's 180-315° window still contributes
 *   zero because the waves simply don't organize into clean faces at the
 *   break. **The cutoff value itself is excluded** (exactly 8.0s returns 0,
 *   8.01s returns positive) so the gate only admits genuine groundswell.
 * - `0` when the component direction lies outside the window
 *   `[center - halfwidth, center + halfwidth]` (angular, so the short arc).
 * - `cos²` falloff inside the window: `cos²(distance / halfwidth × π/2)`.
 *   At the center → 1.0. At the edge → 0.0. Halfway between → 0.5.
 * - `1.0` when `windowCenterDeg` or `windowHalfwidthDeg` is null. This is
 *   the "graceful degradation" path for uncalibrated beaches: we don't want
 *   to fabricate an alignment signal we can't measure, so the component
 *   passes through at full weight and the bucket factor alone does the work.
 * - `1.0` when `componentDirDeg` is null — we can't compute angular distance
 *   without a direction, so degrade open rather than zero out. The bucket
 *   factor is still applied by the caller.
 *
 * Angular distance is the short-arc delta normalized to `[0, 180]`.
 */
export function alignmentFactor(
  componentDirDeg: number | null | undefined,
  periodS: number | null | undefined,
  windowCenterDeg: number | null | undefined,
  windowHalfwidthDeg: number | null | undefined,
  opts?: { shortPeriodCutoffS?: number },
): number {
  const cutoff = opts?.shortPeriodCutoffS ?? SHORT_PERIOD_CUTOFF_S;

  // Short-period gate: wind-swell never contributes face height. The cutoff
  // value itself is excluded — only periods strictly greater than 8s count
  // as groundswell.
  if (periodS == null || !Number.isFinite(periodS) || periodS <= cutoff) {
    return 0;
  }

  // Graceful degradation when the window is uncalibrated.
  if (
    windowCenterDeg == null ||
    windowHalfwidthDeg == null ||
    !Number.isFinite(windowCenterDeg) ||
    !Number.isFinite(windowHalfwidthDeg) ||
    windowHalfwidthDeg <= 0
  ) {
    return 1.0;
  }

  // Graceful degradation when the component direction is missing.
  if (componentDirDeg == null || !Number.isFinite(componentDirDeg)) {
    return 1.0;
  }

  // Short-arc angular distance in [0, 180].
  const rawDelta = ((componentDirDeg - windowCenterDeg) % 360 + 540) % 360 - 180;
  const distance = Math.abs(rawDelta);

  if (distance >= windowHalfwidthDeg) {
    return 0;
  }

  const normalized = distance / windowHalfwidthDeg; // [0, 1)
  const cosValue = Math.cos((normalized * Math.PI) / 2);
  return Math.max(cosValue * cosValue, ALIGNMENT_FLOOR);
}

/**
 * Direction-aware shadow multiplier for the CDIP calibrated short-circuit.
 *
 * The period bucket (surfline_face / cdip_hs) is direction-blind, so on the
 * CDIP path a south swell at a Point-Loma-shadowed break can read the full
 * offshore Hs. This applies a floored geometric-shadow factor, but only when
 * the incident direction is outside the beach's swell window.
 */
export function calibratedShadowFactor(
  swellDirectionDeg: number | null | undefined,
  beach: BeachTerrainConfig | null | undefined,
): number {
  if (swellDirectionDeg == null || !Number.isFinite(swellDirectionDeg)) {
    return 1.0;
  }

  const center = beach?.swell_window_center_deg;
  const halfwidth = beach?.swell_window_halfwidth_deg;
  if (
    center == null ||
    halfwidth == null ||
    !Number.isFinite(center) ||
    !Number.isFinite(halfwidth) ||
    halfwidth <= 0
  ) {
    return 1.0;
  }

  const rawDelta = ((swellDirectionDeg - center) % 360 + 540) % 360 - 180;
  const distance = Math.abs(rawDelta);
  if (distance < halfwidth) {
    return 1.0;
  }

  const access = beach?.swell_access_factors;
  if (!Array.isArray(access) || access.length !== TERRAIN_BINS) {
    return 1.0;
  }

  const rawAccess = access[toBin5(swellDirectionDeg)];
  if (!Number.isFinite(rawAccess)) {
    return 1.0;
  }

  const clampedAccess = Math.max(0, Math.min(1, rawAccess));
  return DIRECTION_FACTOR_MIN + Math.sqrt(clampedAccess) * DIRECTION_FACTOR_RANGE;
}

function hasValidSwellAccessFactors(
  beach: BeachTerrainConfig | null | undefined,
): beach is BeachTerrainConfig & { swell_access_factors: number[] } {
  return (
    beach?.terrain_enabled === true &&
    Array.isArray(beach.swell_access_factors) &&
    beach.swell_access_factors.length === TERRAIN_BINS
  );
}

function isTerrainWeightedModelSource(
  source: WaveHeightSourceTag | undefined,
): boolean {
  return source === 'model_swell' || source === 'model_hs';
}

function isCdipObservationSource(
  source: WaveHeightSourceTag | undefined,
): boolean {
  return source === 'cdip_sig' || source === 'cdip_swell';
}

function terrainAccessFactor(access: number): number {
  if (access <= 0) {
    return 0;
  }

  return DIRECTION_FACTOR_MIN + Math.sqrt(access) * DIRECTION_FACTOR_RANGE;
}

function directObservationFloorAccessFactor(access: number): number {
  if (access <= 0) {
    return 0;
  }

  return Math.sqrt(access);
}

function isLongPeriodSouthSwell(
  componentDirDeg: number,
  periodS: number,
): boolean {
  const direction = ((componentDirDeg % 360) + 360) % 360;
  return periodS >= LONG_PERIOD_SOUTH_SWELL_FLOOR_MIN_PERIOD_S &&
    direction >= SOUTH_SWELL_FLOOR_MIN_DIRECTION_DEG &&
    direction <= SOUTH_SWELL_FLOOR_MAX_DIRECTION_DEG;
}

function canUseCalibratedShoaling(
  source: WaveHeightSourceTag | undefined,
  allowCalibratedShoaling?: boolean,
): boolean {
  return source === 'cdip_sig' ||
    (source === 'nowcast_anchor' && allowCalibratedShoaling === true);
}

function shouldQuarantineCalibratedShoalingBucket(
  source: WaveHeightSourceTag | undefined,
  periodS: number | null | undefined,
  bucketFactor: number,
): boolean {
  return source === 'cdip_sig' &&
    periodS != null &&
    Number.isFinite(periodS) &&
    periodS >= CALIBRATION_BUCKET_QUARANTINE_MIN_PERIOD_S &&
    bucketFactor < CALIBRATION_BUCKET_QUARANTINE_MAX_FACTOR;
}

function shouldApplyDeepwaterDecay(
  source: WaveHeightSourceTag | undefined,
): boolean {
  return source !== 'cdip_sig' && source !== 'nowcast_anchor';
}

/**
 * Compute the per-component access factor used by decomposed face heights.
 *
 * CDIP and other calibrated/direct sources keep the strict swell-window
 * alignment. Model-derived sources can use terrain swell access instead,
 * because deep-water model partitions otherwise get over-zeroed at protected
 * or canyon-amplified beaches where partial access is real.
 */
export function componentAccessFactor(
  componentDirDeg: number | null | undefined,
  periodS: number | null | undefined,
  beach: BeachTerrainConfig | null | undefined,
  source?: WaveHeightSourceTag,
  opts?: { shortPeriodCutoffS?: number },
): number {
  const cutoff = opts?.shortPeriodCutoffS ?? SHORT_PERIOD_CUTOFF_S;

  if (periodS == null || !Number.isFinite(periodS) || periodS <= cutoff) {
    return 0;
  }

  if (
    hasValidSwellAccessFactors(beach) &&
    componentDirDeg != null &&
    Number.isFinite(componentDirDeg)
  ) {
    const bin = toBin5(componentDirDeg);
    const access = Math.max(0, Math.min(1, beach.swell_access_factors[bin]));

    if (isTerrainWeightedModelSource(source)) {
      return terrainAccessFactor(access);
    }

    const strictAlignment = alignmentFactor(
      componentDirDeg,
      periodS,
      beach?.swell_window_center_deg ?? null,
      beach?.swell_window_halfwidth_deg ?? null,
      opts,
    );

    if (strictAlignment > 0) {
      return strictAlignment;
    }

    if (
      isCdipObservationSource(source) &&
      access >= LONG_PERIOD_SOUTH_SWELL_FLOOR_MIN_ACCESS &&
      isLongPeriodSouthSwell(componentDirDeg, periodS)
    ) {
      return directObservationFloorAccessFactor(access);
    }

    return strictAlignment;
  }

  return alignmentFactor(
    componentDirDeg,
    periodS,
    beach?.swell_window_center_deg ?? null,
    beach?.swell_window_halfwidth_deg ?? null,
    opts,
  );
}

/**
 * Single swell-component input for `transformToFaceHeightDecomposed`.
 * Heights must already be in feet; callers converting from meters should
 * do that upstream (typically via `metersToFeet`). A null slot signals
 * "no data" — pass nulls for absent components rather than omitting them.
 */
export interface SwellComponentInput {
  heightFt: number;
  periodS: number;
  directionDeg: number | null;
  partition?: 'swell' | 'wind_wave';
}

/**
 * Result of `transformToFaceHeightDecomposed`.
 *
 * `path` reports which branch fired:
 * - `'decomposed'`: at least one component had usable data and the RMS
 *   sum was computed per-component.
 * - `'legacy'`: all components were absent/invalid so we fell back to
 *   `transformToFaceHeight` with the raw Hs input. Result is identical
 *   to what the existing transform would return — this path exists so
 *   callers can log/telemetry which rows decomposed vs which didn't.
 *
 * `isCalibrated` is `true` only when at least one empirical bucket factor was
 * actually applied. Mirrors `transformToFaceHeightWithMetadata` so downstream
 * consumers can treat the two metadata flags identically.
 */
export interface DecomposedFaceHeightResult {
  faceHeightFt: number;
  isCalibrated: boolean;
  provenance: WaveHeightTransformProvenance;
  path: 'decomposed' | 'legacy';
  calibrationBucketQuarantined?: boolean;
}

/**
 * Per-component, alignment-weighted face-height transform.
 *
 * Motivation — Tourmaline 2026-04-09 blowout: CDIP 201 combined Hs was ~3 ft
 * with peak period 14s, but the reading was a bimodal stack of a ~1 ft 14s
 * SSW groundswell and a ~2.5 ft 7s W wind-swell. The legacy single-bucket
 * transform multiplied 3 × 1.45 = 4.35 ft ("3-5 ft") because it applied the
 * 12-16s calibrated factor to the whole Hs without noticing the short-period
 * component. Reality was ~1.7 ft face because the 7s W energy doesn't reach
 * the protected break.
 *
 * Fix: decompose the swell into the WW3 components the model already
 * reports, weight each by (bucket factor × access/alignment × short-period
 * gate), and RMS-sum the resulting face heights. CDIP/direct sources use
 * strict swell-window alignment. Model sources at terrain-enabled beaches use
 * the beach's swell_access_factors so partial canyon/protection access is not
 * zeroed by an overly narrow cosine window. RMS is physically correct for
 * significant-height sums (variance adds linearly; Hs scales with the square
 * root), so an N-component decomposition never exceeds the naive linear sum
 * and converges to the single-component case when only one component is
 * populated.
 *
 * Fallback policy:
 * - **All slots null or invalid** → delegate to `transformToFaceHeight` with
 *   the legacy inputs. The result is byte-identical to current behavior.
 *   This is the safety valve for rows where WW3 components are missing
 *   (older snapshots, fallback providers, etc.).
 * - **Partial nulls** → skip the null slots and decompose the populated
 *   ones. This is the common case: a beach might only have one dominant
 *   swell component on a flat day. Do NOT full-fallback on partial data,
 *   because doing so would lose the per-component alignment signal for the
 *   component that is populated.
 * - **Null shoaling_factors (uncalibrated beach)** → use the
 *   `population_prior_v1` base factor for the component's period bucket,
 *   multiplied by `calculatePeriodFactor`. The alignment gate and RMS sum
 *   still apply, so the decomposed path remains physically meaningful without
 *   per-beach calibration.
 * - **Null swell window** → CDIP/direct `alignmentFactor` returns 1.0 for
 *   every component, so decomposition becomes "bucket factor × raw height"
 *   RMS-summed. Model sources still use terrain access when available.
 *
 * `isCalibrated` is returned on the `'decomposed'` path iff at least one
 * empirical bucket factor was actually applied. On the `'legacy'` path it
 * mirrors whatever `transformToFaceHeightWithMetadata` would have returned
 * for the raw Hs input.
 */
export function transformToFaceHeightDecomposed(params: {
  components: Array<SwellComponentInput | null>;
  beach: BeachTerrainConfig;
  source?: WaveHeightSourceTag;
  allowCalibratedShoaling?: boolean;
  // Legacy fallback inputs (used when no components are populated).
  rawHeightFt: number;
  periodS: number | null;
  swellDirectionDeg: number | null;
}): DecomposedFaceHeightResult {
  const {
    components,
    beach,
    source,
    allowCalibratedShoaling,
    rawHeightFt,
    periodS,
    swellDirectionDeg,
  } = params;

  // Filter to genuinely populated components. We treat any slot with a
  // non-finite or zero period as "no data" because the shoaling bucket
  // lookup rejects those anyway, and a component with no period carries
  // no usable energy signal.
  const populated = components.filter(
    (c): c is SwellComponentInput =>
      c != null &&
      Number.isFinite(c.heightFt) &&
      c.heightFt > 0 &&
      Number.isFinite(c.periodS) &&
      c.periodS > 0,
  );

  if (populated.length === 0) {
    const legacy = transformToFaceHeightWithMetadata({
      rawHeightFt,
      periodS,
      swellDirectionDeg,
      beach,
      source,
      allowCalibratedShoaling,
    });
    return {
      faceHeightFt: legacy.faceHeightFt,
      isCalibrated: legacy.isCalibrated,
      provenance: legacy.provenance,
      path: 'legacy',
      ...(legacy.calibrationBucketQuarantined
        ? { calibrationBucketQuarantined: true }
        : {}),
    };
  }

  const shoalingFactors = beach.shoaling_factors ?? null;

  // Apply deepwater decay for model data sources.
  // CDIP buoy data already reflects nearshore conditions — decay would double-correct.
  // Model data (Open-Meteo, WW3) predicts deep-water energy that may not reach sheltered beaches.
  const decay = (shouldApplyDeepwaterDecay(source) && beach.deepwater_decay_factor != null)
    ? beach.deepwater_decay_factor
    : 1.0;

  let sumOfSquares = 0;
  let calibrationBucketQuarantined = false;
  let calibratedBucketUsed = false;
  let populationPriorUsed = false;
  for (const component of populated) {
    if (
      component.partition === 'wind_wave' &&
      component.periodS <= WIND_WAVE_FACE_HEIGHT_CUTOFF_S
    ) {
      continue;
    }

    if (component.periodS <= SHORT_PERIOD_CUTOFF_S) {
      continue;
    }

    const accessFactor = componentAccessFactor(
      component.directionDeg,
      component.periodS,
      beach,
      source,
    );
    if (accessFactor === 0) continue;

    // Only use calibrated bucket factors for CDIP sources — the buckets are
    // measured as surfline_face / cdip_hs and produce overshoot on model data.
    const rawBucketFactor = canUseCalibratedShoaling(source, allowCalibratedShoaling)
      ? lookupShoalingBucket(component.periodS, shoalingFactors)
      : null;
    const bucketFactor =
      rawBucketFactor != null &&
      shouldQuarantineCalibratedShoalingBucket(
        source,
        component.periodS,
        rawBucketFactor,
      )
        ? null
        : rawBucketFactor;
    if (rawBucketFactor != null && bucketFactor == null) {
      calibrationBucketQuarantined = true;
    }
    if (bucketFactor != null) {
      calibratedBucketUsed = true;
    }
    const periodFactor = calculatePeriodFactor(component.periodS);
    const baseShoaling = getGenericBaseShoalingFactor(component.periodS, beach);
    // Terrain-access canyon paths should treat 12s+ model swell as organized
    // groundswell; otherwise the generic 12s=1.1 ramp still undercalls LJS.
    const terrainModelPeriodFactor =
      isTerrainWeightedModelSource(source) &&
      hasValidSwellAccessFactors(beach) &&
      (beach.deepwater_decay_factor ?? 1) > 1 &&
      component.periodS >= 12
        ? Math.max(periodFactor, PERIOD_FACTOR_MAX)
        : periodFactor;
    const perComponentFactor =
      bucketFactor ?? baseShoaling.factor * terrainModelPeriodFactor;

    if (bucketFactor == null && baseShoaling.provenance === POPULATION_PRIOR_PROVENANCE) {
      populationPriorUsed = true;
    }

    const faceI = component.heightFt * decay * perComponentFactor * accessFactor;
    sumOfSquares += faceI * faceI;
  }

  // If every component was zeroed (e.g. all periods ≤ 8s or all components are
  // outside the beach window), fall back to legacy rather than displaying 0 ft.
  if (sumOfSquares === 0) {
    const legacy = transformToFaceHeightWithMetadata({
      rawHeightFt, periodS, swellDirectionDeg, beach, source,
      allowCalibratedShoaling,
    });
    return {
      faceHeightFt: legacy.faceHeightFt,
      isCalibrated: legacy.isCalibrated,
      provenance: legacy.provenance,
      path: 'legacy',
      ...(legacy.calibrationBucketQuarantined
        ? { calibrationBucketQuarantined: true }
        : {}),
    };
  }

  const faceHs = Math.sqrt(sumOfSquares);
  const rounded = Math.round(faceHs * 10) / 10;

  return {
    faceHeightFt: rounded,
    isCalibrated: calibratedBucketUsed,
    provenance: calibratedBucketUsed
      ? 'measured'
      : populationPriorUsed
        ? POPULATION_PRIOR_PROVENANCE
        : 'generic',
    path: 'decomposed',
    ...(calibrationBucketQuarantined ? { calibrationBucketQuarantined } : {}),
  };
}
