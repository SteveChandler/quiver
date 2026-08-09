// Surf scoring helpers
// These utilities intentionally mirror the logic used in DB scoring but can be
// extended or tuned independently for client/server usage.

import {
  toBin5,
  useTerrainFactors,
  TERRAIN_BINS,
} from '@/types/terrain';
import { METERS_TO_FEET } from '@/lib/utils/unit-conversions';

type Grade = "epic" | "good" | "fair" | "poor";

/** Minimum wind exposure floor (prevents "perfect wind" in extreme shelter) */
export const MIN_EXPOSURE = 0.15;

// Generalized types used by range-based window picker
export interface BeachMeta {
  id?: string;
  name?: string;
  break_type?: string | null;
  wind_offshore_deg?: number;
  wind_cross_ok_kts?: number;
  swell_window_min_deg?: number;
  swell_window_max_deg?: number;
  tide_min_ft?: number;
  tide_max_ft?: number;
  // Terrain-aware scoring fields
  wind_exposure_factors?: number[] | null;
  swell_access_factors?: number[] | null;
  terrain_enabled?: boolean;
}

export interface HourlyMarine {
  ts: Date;
  hs_m: number; // significant wave height (m)
  tp_s: number | null; // period (s)
  swell_dir_deg: number | null;
  wind_spd_kts: number | null;
  wind_dir_deg: number | null;
}

export interface HourlyTide {
  ts: Date;
  tide_ft: number; // tide height in feet
}

interface BeachScoringParams {
  windOffshoreDeg: number; // degrees (0-360)
  windCrossOkKts: number; // knots
  swellWindowMinDeg: number; // degrees (0-360)
  swellWindowMaxDeg: number; // degrees (0-360)
  tidePreferredFtMin: number; // feet
  tidePreferredFtMax: number; // feet
  // Terrain-aware scoring
  terrainEnabled?: boolean;
  windExposureFactors?: number[] | null;
  swellAccessFactors?: number[] | null;
}

export interface HourInputs {
  // Marine
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  // Local wind
  windDirectionDeg: number | null;
  windSpeedMs: number | null; // meters/second
  // Tide
  tideHeightM: number | null; // meters
  // Calibration
  params: BeachScoringParams;
}

interface HourScoreBreakdown {
  windScore: number; // 0..1
  tideScore: number; // 0..1
  swellDirScore: number; // 0..1
  periodScore: number; // reserved
  heightScore: number; // reserved
  total0to100: number; // 0..100
  // Terrain telemetry (optional)
  terrainFactorsApplied?: boolean;
  windExposure?: number; // 0..1, from terrain factors
  swellAccess?: number; // 0..1, from terrain factors
}

function toKnots(ms: number | null): number {
  return ms == null ? 0 : ms * 1.94384449;
}

function normalizeDeg(deg: number): number {
  // Normalize any number to [0,360)
  const d = ((deg % 360) + 360) % 360;
  return d;
}

function angularDistance(aDeg: number, bDeg: number): number {
  const a = normalizeDeg(aDeg);
  const b = normalizeDeg(bDeg);
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff; // 0..180
}

function computeWindScore(
  windDirectionDeg: number | null,
  windSpeedMs: number | null,
  offshoreDeg: number,
  crossOkKts: number
): number {
  if (windDirectionDeg == null) return 0;
  const offBy = angularDistance(windDirectionDeg, offshoreDeg);
  // Cosine falloff: 0° off = 1, 180° off = 0
  const facing = (1 + Math.cos((offBy * Math.PI) / 180)) / 2;
  // Penalize high onshore speed beyond threshold
  const onshorePenalty = Math.max(0, toKnots(windSpeedMs) - crossOkKts) / 10;
  return clamp01(facing * (1 - onshorePenalty));
}

function computeTideScore(
  tideHeightM: number | null,
  tideMinFt: number,
  tideMaxFt: number
): number {
  if (tideHeightM == null) return 0;
  const tideFt = tideHeightM * METERS_TO_FEET;
  const center = (tideMinFt + tideMaxFt) / 2;
  const half = (tideMaxFt - tideMinFt) / 2;
  if (half === 0) return 0;
  // Triangle band: 1 at center, 0 at edges, clamp below 0
  const score = 1 - Math.abs(tideFt - center) / half;
  return clamp01(score);
}

function computeSwellDirScore(
  waveDirectionDeg: number | null,
  windowMinDeg: number,
  windowMaxDeg: number
): number {
  if (waveDirectionDeg == null) return 0;
  // Represent the window as center/span to handle wrap-around
  const span = ((windowMaxDeg - windowMinDeg + 360) % 360);
  const min = windowMinDeg;
  const center = min + span / 2;
  // Circular distance from the window center (0..180). Reuse angularDistance —
  // the previous inline `(center + 540)` wrap math was wrong and returned a
  // value >180 for every direction, zeroing swellDirScore even at window center.
  const offFromCenter = angularDistance(waveDirectionDeg, center);
  const inside = Math.max(0, span / 2 - offFromCenter);
  // Fade to 0 in the next 30° beyond the window
  const beyond = Math.max(0, offFromCenter - span / 2);
  const fade = Math.max(0, 1 - beyond / 30);
  const base = span > 0 ? inside / (span / 2 || 1) : 0;
  return clamp01(Math.max(base, fade));
}

function computeHourScoreObject(input: HourInputs): HourScoreBreakdown {
  const {
    waveDirectionDeg,
    windDirectionDeg,
    windSpeedMs,
    tideHeightM,
    params,
  } = input;

  // Check if terrain factors should be applied
  const hasTerrainData =
    params.terrainEnabled &&
    params.windExposureFactors &&
    params.swellAccessFactors &&
    Array.isArray(params.windExposureFactors) &&
    Array.isArray(params.swellAccessFactors) &&
    params.windExposureFactors.length === TERRAIN_BINS &&
    params.swellAccessFactors.length === TERRAIN_BINS;

  // Compute raw scores first
  const rawWindScore = computeWindScore(
    windDirectionDeg,
    windSpeedMs,
    params.windOffshoreDeg,
    params.windCrossOkKts
  );
  const tideScore = computeTideScore(
    tideHeightM,
    params.tidePreferredFtMin,
    params.tidePreferredFtMax
  );
  const rawSwellDirScore = computeSwellDirScore(
    waveDirectionDeg,
    params.swellWindowMinDeg,
    params.swellWindowMaxDeg
  );

  // Default terrain factors (no adjustment)
  let windExposure = 1.0;
  let swellAccess = 1.0;
  let windScore = rawWindScore;
  let swellDirScore = rawSwellDirScore;

  // Apply terrain factors if available
  if (hasTerrainData && windDirectionDeg !== null) {
    const windBin = toBin5(windDirectionDeg);
    windExposure = clamp01(params.windExposureFactors![windBin]);

    // Apply wind exposure: reduces penalty of bad wind
    // effectiveExposure = MIN_EXPOSURE + (1 - MIN_EXPOSURE) * windExposure
    const effectiveExposure = MIN_EXPOSURE + (1 - MIN_EXPOSURE) * windExposure;
    const rawWindPenalty = 1 - rawWindScore;
    const adjustedWindPenalty = rawWindPenalty * effectiveExposure;
    windScore = 1 - adjustedWindPenalty;
  }

  if (hasTerrainData && waveDirectionDeg !== null) {
    const swellBin = toBin5(waveDirectionDeg);
    swellAccess = clamp01(params.swellAccessFactors![swellBin]);

    // Apply swell access: gates how much swell direction score counts
    swellDirScore = rawSwellDirScore * swellAccess;
  }

  // Reserved scoring dimensions (for future tuning)
  const periodScore = 0;
  const heightScore = 0;

  const total0to100 = Math.round(
    100 * clamp01(
      0.4 * clamp01(windScore) +
        0.2 * clamp01(tideScore) +
        0.4 * clamp01(swellDirScore)
    )
  );

  return {
    windScore: clamp01(windScore),
    tideScore: clamp01(tideScore),
    swellDirScore: clamp01(swellDirScore),
    periodScore,
    heightScore,
    total0to100,
    // Include terrain telemetry
    terrainFactorsApplied: !!hasTerrainData,
    windExposure: hasTerrainData ? windExposure : undefined,
    swellAccess: hasTerrainData ? swellAccess : undefined,
  };
}

// Overload: computeHourScore for generalized inputs returns 0..100
export function computeHourScore(beach: BeachMeta, m: HourlyMarine, tideFt: number): number;
export function computeHourScore(input: HourInputs): HourScoreBreakdown;
export function computeHourScore(arg1: any, arg2?: any, arg3?: any): any {
  // Signature A: object-based breakdown
  if (typeof arg1 === "object" && arg1 && "params" in arg1) {
    const input = arg1 as HourInputs;
    const breakdown = computeHourScoreObject(input as HourInputs);
    return breakdown;
  }
  // Signature B: BeachMeta + HourlyMarine + tideFt
  const beach = arg1 as BeachMeta;
  const m = arg2 as HourlyMarine;
  const tideFt = (arg3 as number) ?? 0;
  const params: BeachScoringParams = {
    windOffshoreDeg: beach.wind_offshore_deg ?? 0,
    windCrossOkKts: beach.wind_cross_ok_kts ?? 15,
    swellWindowMinDeg: beach.swell_window_min_deg ?? 0,
    swellWindowMaxDeg: beach.swell_window_max_deg ?? 0,
    tidePreferredFtMin: beach.tide_min_ft ?? 0.5,
    tidePreferredFtMax: beach.tide_max_ft ?? 3.5,
    // Pass through terrain factors
    terrainEnabled: beach.terrain_enabled ?? false,
    windExposureFactors: beach.wind_exposure_factors,
    swellAccessFactors: beach.swell_access_factors,
  };

  // Use the object-based scoring to get terrain-aware results
  const input: HourInputs = {
    waveDirectionDeg: m.swell_dir_deg,
    wavePeriodS: m.tp_s,
    windDirectionDeg: m.wind_dir_deg,
    windSpeedMs: m.wind_spd_kts != null ? m.wind_spd_kts / 1.94384449 : null,
    tideHeightM: tideFt / METERS_TO_FEET,
    params,
  };
  const breakdown = computeHourScoreObject(input);
  return breakdown.total0to100;
}

// Keep the object-based implementation available under a named export
export const computeHourScoreBreakdown = computeHourScoreObject;

// Overloaded boardCall
export function boardCall(score0to100: number): Grade;
export function boardCall(avgHsFt: number, breakType?: string | null): string;
export function boardCall(a: number, breakType?: string | null): any {
  if (breakType === undefined) {
    // Grade variant
    const score0to100 = a;
    if (score0to100 >= 85) return "epic";
    if (score0to100 >= 70) return "good";
    if (score0to100 >= 55) return "fair";
    return "poor";
  }
  // Simple board suggestion based on face height and break type
  const hs = a;
  const bt = (breakType || "").toLowerCase();
  if (hs < 2) return "Longboard";
  if (hs < 4) return bt.includes("point") ? "Mid-length" : "Funboard";
  if (hs < 6) return "Shortboard";
  return "Step-up";
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ============================================================================
// Window Refinement Types and Constants
// ============================================================================

/** Window refinement configuration constants */
export const REFINEMENT_CONFIG = {
  /** Duration of one hour in milliseconds */
  HOUR_MS: 60 * 60 * 1000,
  /** Scan resolution for finding eligibility boundaries (5 minutes) */
  SCAN_STEP_MS: 5 * 60 * 1000,
  /** Snap boundaries to 15-minute increments for user-friendly times */
  SNAP_MS: 15 * 60 * 1000,
  /** Maximum allowed shift from hourly boundary (45 minutes) */
  MAX_SHIFT_MS: 45 * 60 * 1000,
  /** Minimum viable window duration (60 minutes) */
  MIN_DURATION_MS: 60 * 60 * 1000,
} as const;

// Destructure for internal use
const { HOUR_MS, SCAN_STEP_MS, SNAP_MS, MAX_SHIFT_MS, MIN_DURATION_MS } = REFINEMENT_CONFIG;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Linear interpolation between two values.
 * @param from - Starting value
 * @param to - Ending value
 * @param alpha - Interpolation factor (clamped to [0,1])
 * @returns Interpolated value
 */
function lerp(from: number, to: number, alpha: number): number {
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  return from + clampedAlpha * (to - from);
}

export type FallbackReason =
  | 'missing_scores'
  | 'inverted'
  | 'duration_collapsed'
  | 'no_eligible_found'
  | 'window_too_short';

export interface RefineWindowBoundsParams {
  hourlyStart: Date;
  hourlyEnd: Date;
  scoreAtStart: number;
  scoreAtNextHour: number;
  scoreAtPrevHour: number;
  scoreAtEnd: number;
  threshold: number;
  getTideHeightAtTime: (t: Date) => number | null;
  tideMin: number | null;
  tideMax: number | null;
  isLightOk: (t: Date) => boolean;
}

export interface RefinedWindow {
  start: Date;
  end: Date;
  rawStartDeltaMin: number;
  rawEndDeltaMin: number;
  finalStartDeltaMin: number;
  finalEndDeltaMin: number;
  clampedStart: boolean;
  clampedEnd: boolean;
  usedInterpolation: boolean;
  fallbackReason?: FallbackReason;
}

// ============================================================================
// Window Refinement Implementation
// ============================================================================

/** Parameters for tide constraint checking */
interface TideConstraints {
  getTideHeightAtTime: (t: Date) => number | null;
  tideMin: number | null;
  tideMax: number | null;
}

/** Result from edge scanning */
interface EdgeScanResult {
  time: Date;
  found: boolean;
}

/**
 * Creates a fallback RefinedWindow with original hourly boundaries.
 */
function createFallbackWindow(
  hourlyStart: Date,
  hourlyEnd: Date,
  reason: FallbackReason
): RefinedWindow {
  return {
    start: hourlyStart,
    end: hourlyEnd,
    rawStartDeltaMin: 0,
    rawEndDeltaMin: 0,
    finalStartDeltaMin: 0,
    finalEndDeltaMin: 0,
    clampedStart: false,
    clampedEnd: false,
    usedInterpolation: false,
    fallbackReason: reason,
  };
}

/**
 * Creates an eligibility checker function for a given set of constraints.
 */
function createEligibilityChecker(
  threshold: number,
  isLightOk: (t: Date) => boolean,
  tideConstraints: TideConstraints
): (t: Date, interpScore: number) => boolean {
  const { getTideHeightAtTime, tideMin, tideMax } = tideConstraints;

  return (t: Date, interpScore: number): boolean => {
    // 1. Score check (cheap, first)
    if (interpScore < threshold) return false;

    // 2. Light check (cheap boolean)
    if (!isLightOk(t)) return false;

    // 3. Tide check (may involve interpolation lookup)
    if (tideMin !== null || tideMax !== null) {
      const tideHeight = getTideHeightAtTime(t);
      if (tideHeight !== null) {
        if (tideMin !== null && tideHeight < tideMin) return false;
        if (tideMax !== null && tideHeight > tideMax) return false;
      }
      // tideHeight === null → pass (permissive on missing data)
    }

    return true;
  };
}

/**
 * Scans forward from hourlyStart to find the earliest eligible time.
 */
function scanStartEdge(
  hourlyStart: Date,
  scoreAtStart: number,
  scoreAtNextHour: number,
  isEligible: (t: Date, score: number) => boolean
): EdgeScanResult {
  for (let offset = 0; offset < HOUR_MS; offset += SCAN_STEP_MS) {
    const t = new Date(hourlyStart.getTime() + offset);
    const interpScore = lerp(scoreAtStart, scoreAtNextHour, offset / HOUR_MS);

    if (isEligible(t, interpScore)) {
      return { time: t, found: true };
    }
  }
  return { time: hourlyStart, found: false };
}

/**
 * Scans backward from hourlyEnd to find the latest eligible time.
 */
function scanEndEdge(
  hourlyEnd: Date,
  scoreAtPrevHour: number,
  scoreAtEnd: number,
  isEligible: (t: Date, score: number) => boolean
): EdgeScanResult {
  const endScanStart = hourlyEnd.getTime() - HOUR_MS;
  for (let offset = HOUR_MS - SCAN_STEP_MS; offset >= 0; offset -= SCAN_STEP_MS) {
    const t = new Date(endScanStart + offset);
    const interpScore = lerp(scoreAtPrevHour, scoreAtEnd, offset / HOUR_MS);

    if (isEligible(t, interpScore)) {
      return { time: t, found: true };
    }
  }
  return { time: hourlyEnd, found: false };
}

/**
 * Applies clamping, snapping, and validation to refined boundaries.
 * Returns null if validation fails (inversion or duration collapse).
 */
function snapAndValidate(
  refinedStart: Date,
  refinedEnd: Date,
  hourlyStart: Date,
  hourlyEnd: Date
): {
  snappedStartMs: number;
  snappedEndMs: number;
  clampedStart: boolean;
  clampedEnd: boolean;
  rawStartDeltaMin: number;
  rawEndDeltaMin: number;
} | null {
  // Guard negative deltas (defensive)
  const startDeltaMs = Math.max(0, refinedStart.getTime() - hourlyStart.getTime());
  const endDeltaMs = Math.max(0, hourlyEnd.getTime() - refinedEnd.getTime());

  const rawStartDeltaMin = startDeltaMs / 60000;
  const rawEndDeltaMin = endDeltaMs / 60000;

  // Clamp to max shift
  let clampedStart = false;
  let clampedEnd = false;
  let clampedStartMs = refinedStart.getTime();
  let clampedEndMs = refinedEnd.getTime();

  if (startDeltaMs > MAX_SHIFT_MS) {
    clampedStartMs = hourlyStart.getTime() + MAX_SHIFT_MS;
    clampedStart = true;
  }
  if (endDeltaMs > MAX_SHIFT_MS) {
    clampedEndMs = hourlyEnd.getTime() - MAX_SHIFT_MS;
    clampedEnd = true;
  }

  // Directional snap: start = ceil, end = floor
  const snappedStartMs = Math.ceil(clampedStartMs / SNAP_MS) * SNAP_MS;
  const snappedEndMs = Math.floor(clampedEndMs / SNAP_MS) * SNAP_MS;

  // Validation: check for inversion
  if (snappedStartMs >= snappedEndMs) {
    return null;
  }

  // Validation: check minimum duration
  if (snappedEndMs - snappedStartMs < MIN_DURATION_MS) {
    return null;
  }

  return {
    snappedStartMs,
    snappedEndMs,
    clampedStart,
    clampedEnd,
    rawStartDeltaMin,
    rawEndDeltaMin,
  };
}

/**
 * Refines hourly window boundaries to sub-hour precision by interpolating
 * score, tide, and light conditions.
 *
 * ## Algorithm Overview
 *
 * 1. **Validation**: Ensure window is at least 2 hours (needs interpolation context)
 * 2. **Edge Scanning**:
 *    - Start: Forward scan from hourlyStart to find first eligible time
 *    - End: Backward scan from hourlyEnd to find last eligible time
 * 3. **Interpolation**: Linear interpolation of scores between hourly boundaries
 * 4. **Constraints**: Check score threshold, tide range, and daylight
 * 5. **Clamping**: Limit shifts to 45 min to prevent extreme changes
 * 6. **Snapping**: Align to 15-minute increments (ceil for start, floor for end)
 * 7. **Validation**: Ensure inverted/collapsed windows fall back to hourly
 *
 * @param params - Window parameters and eligibility functions
 * @returns Refined window with telemetry metadata
 */
export function refineWindowBounds(
  params: RefineWindowBoundsParams
): RefinedWindow {
  const {
    hourlyStart,
    hourlyEnd,
    scoreAtStart,
    scoreAtNextHour,
    scoreAtPrevHour,
    scoreAtEnd,
    threshold,
    getTideHeightAtTime,
    tideMin,
    tideMax,
    isLightOk,
  } = params;

  // Early validation: window must be at least 2 hours for interpolation
  const windowMs = hourlyEnd.getTime() - hourlyStart.getTime();
  if (windowMs < 2 * HOUR_MS) {
    return createFallbackWindow(hourlyStart, hourlyEnd, 'window_too_short');
  }

  // Create eligibility checker with all constraints
  const isEligible = createEligibilityChecker(threshold, isLightOk, {
    getTideHeightAtTime,
    tideMin,
    tideMax,
  });

  // Scan edges for eligible boundaries
  const startResult = scanStartEdge(hourlyStart, scoreAtStart, scoreAtNextHour, isEligible);
  const endResult = scanEndEdge(hourlyEnd, scoreAtPrevHour, scoreAtEnd, isEligible);

  // If no eligible time found at either edge, fall back
  if (!startResult.found && !endResult.found) {
    return createFallbackWindow(hourlyStart, hourlyEnd, 'no_eligible_found');
  }

  // Apply clamping, snapping, and validation
  const snapResult = snapAndValidate(
    startResult.time,
    endResult.time,
    hourlyStart,
    hourlyEnd
  );

  // Validation failed (inversion or duration collapse)
  if (!snapResult) {
    // Determine appropriate fallback reason
    const startDeltaMs = startResult.time.getTime() - hourlyStart.getTime();
    const endDeltaMs = hourlyEnd.getTime() - endResult.time.getTime();
    const clampedStartMs = Math.min(startDeltaMs, MAX_SHIFT_MS);
    const clampedEndMs = Math.min(endDeltaMs, MAX_SHIFT_MS);
    const snappedStart = Math.ceil((hourlyStart.getTime() + clampedStartMs) / SNAP_MS) * SNAP_MS;
    const snappedEnd = Math.floor((hourlyEnd.getTime() - clampedEndMs) / SNAP_MS) * SNAP_MS;

    if (snappedStart >= snappedEnd) {
      return createFallbackWindow(hourlyStart, hourlyEnd, 'inverted');
    }
    return createFallbackWindow(hourlyStart, hourlyEnd, 'duration_collapsed');
  }

  // Calculate final deltas and changed status
  const finalStartDeltaMin = (snapResult.snappedStartMs - hourlyStart.getTime()) / 60000;
  const finalEndDeltaMin = (hourlyEnd.getTime() - snapResult.snappedEndMs) / 60000;
  const changed =
    snapResult.snappedStartMs !== hourlyStart.getTime() ||
    snapResult.snappedEndMs !== hourlyEnd.getTime();

  return {
    start: new Date(snapResult.snappedStartMs),
    end: new Date(snapResult.snappedEndMs),
    rawStartDeltaMin: snapResult.rawStartDeltaMin,
    rawEndDeltaMin: snapResult.rawEndDeltaMin,
    finalStartDeltaMin,
    finalEndDeltaMin,
    clampedStart: snapResult.clampedStart,
    clampedEnd: snapResult.clampedEnd,
    usedInterpolation: changed,
  };
}
