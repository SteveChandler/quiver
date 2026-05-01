/**
 * Setup Suitability — hero-only post-process factor.
 *
 * Asks: "is this beach the right venue for THIS swell setup?"
 *
 * Foundation: reuses `calculateWindowAlignment` (wraparound-safe; handles
 * windows like OB Pier's 220° → 5° through-north correctly via the
 * `SwellWindow` factory at `lib/domains/spot-profile/spot-profile.ts:75-99`).
 *
 * Adds an exposure-vs-period dimension the engine doesn't have: on
 * short-period swells, the value of "exposure" is non-monotone in
 * window half-width — narrow windows miss the energy, moderately-wide
 * wraparound windows catch it best, and absurdly-wide windows are so
 * non-selective that they catch noise as readily as signal. The graded
 * curve below (peaking at hw=75°, decaying to 0 at hw=110°) is a single
 * knob that differentiates OB-style wraparound from PB-style merely-wide
 * AND from Crystal-style absurdly-wide.
 *
 * Mid/long period: alignment matters; absurdly-wide windows artificially
 * inflate alignment via huge denominators in `calculateWindowAlignment`,
 * so we apply a flat penalty there as well.
 *
 * Output is intentionally NOT clamped at 100 for short-period setups —
 * values up to ~140 are valid and necessary to preserve differentiation.
 * The composer in `hero-window-score.ts` clamps the final hero score.
 */

import type { SpotProfile } from "@/lib/domains/spot-profile/types";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { calculateWindowAlignment } from "@/lib/domains/spot-profile/spot-profile";

const NEUTRAL_FALLBACK = 50;
const SHORT_PERIOD_THRESHOLD = 8;
const LONG_PERIOD_THRESHOLD = 12;

// Exposure-curve constants. The curve produces -BONUS_RANGE at the narrow
// cutoff, peaks at WIDE_PEAK (a typical wraparound-wide beach break ~75°),
// and decays back to 0 at ABSURDLY_WIDE (windows so wide the alignment
// signal is unreliable — Crystal Pier's 128° lives here).
const BONUS_RANGE = 40;
const NARROW_CUTOFF_DEG = 35;
const WIDE_PEAK_DEG = 75;
const ABSURDLY_WIDE_DEG = 110;
const ABSURDLY_WIDE_PENALTY = 25;

/**
 * Pulls a finite numeric value from a forecast field that may be a string
 * (e.g. "270", "12s") or a number (the `_om` raw fields). Returns null if
 * the value is missing or unparseable.
 */
function readNumeric(
  primary: number | string | null | undefined,
  fallback: number | null | undefined,
): number | null {
  if (typeof primary === "number" && Number.isFinite(primary)) return primary;
  if (typeof primary === "string") {
    const parsed = Number.parseFloat(primary);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return null;
}

/**
 * Returns the short-period exposure adjustment for a window of the given
 * half-width. Piecewise-linear: -BONUS_RANGE at hw ≤ NARROW_CUTOFF_DEG,
 * rising to +BONUS_RANGE at WIDE_PEAK_DEG, then decaying back to 0 at
 * ABSURDLY_WIDE_DEG and beyond.
 */
function shortPeriodExposureBonus(halfWidthDeg: number): number {
  if (halfWidthDeg <= NARROW_CUTOFF_DEG) return -BONUS_RANGE;
  if (halfWidthDeg >= ABSURDLY_WIDE_DEG) return 0;
  if (halfWidthDeg < WIDE_PEAK_DEG) {
    const t = (halfWidthDeg - NARROW_CUTOFF_DEG) / (WIDE_PEAK_DEG - NARROW_CUTOFF_DEG);
    return -BONUS_RANGE + 2 * BONUS_RANGE * t;
  }
  const t = (halfWidthDeg - WIDE_PEAK_DEG) / (ABSURDLY_WIDE_DEG - WIDE_PEAK_DEG);
  return BONUS_RANGE - BONUS_RANGE * t;
}

/**
 * Computes a setup-suitability score for the candidate beach against the
 * current swell setup. Output is in the 0–~140 range — the composer in
 * `hero-window-score.ts` clamps the final hero score.
 *
 *  - Short-period (≤8s): alignment + graded exposure bonus.
 *  - Long-period (≥12s): alignment, with flat penalty for absurdly-wide
 *    windows (their alignment is a wide-denominator artifact, not signal).
 *  - Mid period (8–12s): alignment, with half the absurdly-wide penalty.
 *
 * Returns the neutral fallback (50) when direction or period is missing —
 * we don't know enough to reward or penalize the candidate.
 */
export function computeSetupSuitability(
  profile: SpotProfile,
  forecast: EnhancedForecastEntity,
): number {
  const window = profile.swellWindow;
  if (!window) return NEUTRAL_FALLBACK;

  // Direction: prefer the string `wave_direction` field, fall back to OM raw.
  const direction = readNumeric(forecast.wave_direction, forecast.wave_direction_om);
  // Period: prefer primary swell, fall back to overall wave period, then OM raw.
  const period =
    readNumeric(forecast.swell_1_period, forecast.swell_period_om) ??
    readNumeric(forecast.wave_period, forecast.wave_period_om);

  if (direction === null || period === null) return NEUTRAL_FALLBACK;

  const alignment = calculateWindowAlignment(direction, window);
  const halfWidth = window.halfWidthDeg;

  if (period <= SHORT_PERIOD_THRESHOLD) {
    return alignment + shortPeriodExposureBonus(halfWidth);
  }

  if (period >= LONG_PERIOD_THRESHOLD) {
    if (halfWidth >= ABSURDLY_WIDE_DEG) return alignment - ABSURDLY_WIDE_PENALTY;
    return alignment;
  }

  // Mid period (8 < p < 12): mild absurdly-wide penalty.
  if (halfWidth >= ABSURDLY_WIDE_DEG) return alignment - ABSURDLY_WIDE_PENALTY / 2;
  return alignment;
}
