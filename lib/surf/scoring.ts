// Surf scoring helpers
// These utilities intentionally mirror the logic used in DB scoring but can be
// extended or tuned independently for client/server usage.

type Grade = "epic" | "good" | "fair" | "poor";

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
  const tideFt = tideHeightM * 3.28084;
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
  const offFromCenter = Math.abs(((normalizeDeg(waveDirectionDeg) - (center + 540)) % 360) - 180);
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

  const windScore = computeWindScore(
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
  const swellDirScore = computeSwellDirScore(
    waveDirectionDeg,
    params.swellWindowMinDeg,
    params.swellWindowMaxDeg
  );

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
  };
  const wind = computeWindScore(m.wind_dir_deg ?? null, m.wind_spd_kts != null ? m.wind_spd_kts / 1.94384449 : null, params.windOffshoreDeg, params.windCrossOkKts);
  const tide = computeTideScore(tideFt / 3.28084, params.tidePreferredFtMin, params.tidePreferredFtMax);
  const swell = computeSwellDirScore(m.swell_dir_deg ?? null, params.swellWindowMinDeg, params.swellWindowMaxDeg);
  const total0to100 = Math.round(
    100 * clamp01(0.4 * clamp01(wind) + 0.2 * clamp01(tide) + 0.4 * clamp01(swell))
  );
  return total0to100;
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

const HOUR_MS = 60 * 60 * 1000;
const SCAN_STEP_MS = 5 * 60 * 1000;    // 5-minute scan resolution
const SNAP_MS = 15 * 60 * 1000;         // 15-minute snap increments
const MAX_SHIFT_MS = 45 * 60 * 1000;    // Max 45-minute edge shift
const MIN_DURATION_MS = 60 * 60 * 1000; // Min 60-minute window

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
