/**
 * Per-beach display-height offset correction.
 *
 * The forecast pipeline emits a display wave-height value per beach. Empirical
 * residual analysis (raw_display - observed) shows a systematic per-beach bias.
 * This module:
 *   1. Parses the display TEXT shape from forecast-builder / enhanced_forecasts
 *      (`"Flat"`, `"3ft"`, `"3-4ft"`, etc.) into a numeric face-feet midpoint
 *      and original range spread.
 *   2. Applies a freshness/sample/improvement-gated rolling-median offset.
 *   3. Re-emits the corrected value preserving the original range shape.
 *
 * Sign convention: `offset_m = display_forecast_m - observed_m`. Apply by
 * subtracting: `corrected = display - offset`. Positive offset means the
 * forecast is biased high; subtracting lowers it.
 */

import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";

const WARN_PREFIX = "[apply-beach-height-offset]";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export interface ParsedDisplayHeight {
  /** Numeric face-feet midpoint. `null` if unparseable; `0` for "Flat". */
  numericFt: number | null;
  /** Original range spread (e.g. "3-4ft" → 1). `null` for single-value or flat. */
  rangeSpread: number | null;
}

/**
 * Parse the wave_height TEXT shape used by forecast-builder /
 * enhanced_forecasts.wave_height. Returns the numeric midpoint and the
 * original range spread so callers can re-emit the corrected value with the
 * original shape preserved.
 */
export function parseDisplayHeightFt(
  raw: string | null | undefined
): ParsedDisplayHeight {
  if (raw == null) return { numericFt: null, rangeSpread: null };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { numericFt: null, rangeSpread: null };

  const lower = trimmed.toLowerCase();
  if (lower === "flat") {
    return { numericFt: 0, rangeSpread: null };
  }

  // Strip trailing "ft" units (with or without space) for parsing.
  const stripped = lower.replace(/\s*ft\s*$/i, "").trim();

  // Range form: "3-4", "3 - 4", "3 to 4"
  const rangeMatch = stripped.match(
    /^(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)$/
  );
  if (rangeMatch) {
    const lo = Number(rangeMatch[1]);
    const hi = Number(rangeMatch[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      console.warn(`${WARN_PREFIX} could not parse wave_height: ${raw}`);
      return { numericFt: null, rangeSpread: null };
    }
    return {
      numericFt: (lo + hi) / 2,
      rangeSpread: Math.abs(hi - lo),
    };
  }

  // Single value: "3", "2.5"
  const singleMatch = stripped.match(/^(-?\d+(?:\.\d+)?)$/);
  if (singleMatch) {
    const v = Number(singleMatch[1]);
    if (!Number.isFinite(v)) {
      console.warn(`${WARN_PREFIX} could not parse wave_height: ${raw}`);
      return { numericFt: null, rangeSpread: null };
    }
    return { numericFt: v, rangeSpread: null };
  }

  console.warn(`${WARN_PREFIX} could not parse wave_height: ${raw}`);
  return { numericFt: null, rangeSpread: null };
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

export interface FormatDisplayHeightOpts {
  /** Corrected midpoint in feet. */
  numericFt: number;
  /** Original range spread; `null` for single-value form. */
  rangeSpread: number | null;
}

/**
 * Re-emit a display height. When `rangeSpread` is null this delegates to
 * `formatWaveHeightRange` (single-value form). When provided, the spread is
 * preserved around the corrected midpoint, with low clamped at 0.
 */
export function formatDisplayHeightFt(opts: FormatDisplayHeightOpts): string {
  const { numericFt, rangeSpread } = opts;

  if (!Number.isFinite(numericFt) || numericFt <= 0) return "Flat";

  if (rangeSpread == null) {
    return formatWaveHeightRange(numericFt);
  }

  const half = rangeSpread / 2;
  const lowRaw = numericFt - half;
  const highRaw = numericFt + half;
  const low = Math.max(0, lowRaw);
  const high = highRaw;

  if (low <= 0 && high <= 0) return "Flat";

  const lowInt = Math.floor(low);
  const highInt = Math.ceil(high);

  if (lowInt === highInt) return `${lowInt}ft`;
  return `${lowInt}-${highInt}ft`;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export interface ApplyBeachHeightOffsetArgs {
  /** Pre-correction face-feet height (from parser). */
  heightFt: number;
  /** Rolling-median offset in METERS. `offset_m = display_m - observed_m`. */
  offsetM?: number | null;
  /** Number of (predicted, observed) pairs in the offset window. */
  sampleCount?: number | null;
  /** Per-beach feature flag. */
  enabled: boolean;
  /** Forecast lead-time in hours; nowcasts (<24h) are not corrected by default. */
  forecastHorizonHours: number;
  /** When the offset row was computed. ISO string or Date. */
  computedAt?: Date | string | null;
  /** MAE before correction (meters) on the offset's training window. */
  maeBeforeM?: number | null;
  /** MAE after correction (meters) on the offset's training window. */
  maeAfterM?: number | null;
  /** Default 30 — do not apply with fewer samples. */
  minSampleCount?: number;
  /** Default 14 — do not apply if computedAt older than this. */
  maxOffsetAgeDays?: number;
  /** Default 24 — Gap #4: protect nowcasts. */
  minHorizonHours?: number;
  /** Injectable for tests. */
  now?: Date;
}

/**
 * Apply the per-beach height offset under a multi-gate guard. Returns the
 * original `heightFt` if any gate fails so the helper is safe to wire in
 * unconditionally.
 */
export function applyBeachHeightOffset(
  args: ApplyBeachHeightOffsetArgs
): number {
  const {
    heightFt,
    offsetM,
    sampleCount,
    enabled,
    forecastHorizonHours,
    computedAt,
    maeBeforeM,
    maeAfterM,
    minSampleCount = 30,
    maxOffsetAgeDays = 14,
    minHorizonHours = 24,
    now = new Date(),
  } = args;

  if (!Number.isFinite(heightFt)) return heightFt;
  if (!enabled) return heightFt;
  if (offsetM == null || !Number.isFinite(offsetM)) return heightFt;
  if (sampleCount == null || sampleCount < minSampleCount) return heightFt;
  if (forecastHorizonHours < minHorizonHours) return heightFt;

  if (computedAt == null) return heightFt;
  const computedAtDate =
    computedAt instanceof Date ? computedAt : new Date(computedAt);
  if (!Number.isFinite(computedAtDate.getTime())) return heightFt;
  const ageMs = now.getTime() - computedAtDate.getTime();
  if (ageMs > maxOffsetAgeDays * 24 * 60 * 60 * 1000) return heightFt;

  if (maeBeforeM == null || maeAfterM == null) return heightFt;
  if (!(maeAfterM < maeBeforeM)) return heightFt;

  const offsetFt = offsetM * METERS_TO_FEET;
  return Math.max(0, heightFt - offsetFt);
}
