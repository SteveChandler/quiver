/**
 * Setup Suitability — hero-only post-process factor.
 *
 * Asks: "is this beach the right venue for THIS swell setup?"
 *
 * **Input contract changed in Task 8:** the function now consumes a
 * cluster-shared `SharedSetupSignal` derived once across the comparison
 * cluster (see `./shared-setup-signal.ts`), NOT each beach's own forecast
 * row. This avoids the divergent-swell category error where each beach
 * was being scored against its own local swell — flipping the hero on
 * combo days where one beach is geometrically blocked from the long-period
 * train.
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
import { calculateWindowAlignment } from "@/lib/domains/spot-profile/spot-profile";

import type { SharedSetupSignal } from "./shared-setup-signal";

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
const ABSURDLY_WIDE_PENALTY = 36;

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
 * cluster-shared swell setup. Output is in the 0–~140 range — the composer in
 * `hero-window-score.ts` clamps the final hero score.
 *
 *  - Short-period (≤8s): alignment + graded exposure bonus.
 *  - Long-period (≥12s): alignment, with flat penalty for absurdly-wide
 *    windows (their alignment is a wide-denominator artifact, not signal).
 *  - Mid period (8–12s): alignment, with half the absurdly-wide penalty.
 *
 * Returns the neutral fallback (50) when the signal carries no resolvable
 * direction or period — we don't know enough to reward or penalize.
 */
export function computeSetupSuitability(
  profile: SpotProfile,
  signal: SharedSetupSignal,
): number {
  const window = profile.swellWindow;
  if (!window) return NEUTRAL_FALLBACK;
  if (signal.directionDeg === null || signal.periodS === null) return NEUTRAL_FALLBACK;

  const alignment = calculateWindowAlignment(signal.directionDeg, window);
  const halfWidth = window.halfWidthDeg;

  if (signal.periodS <= SHORT_PERIOD_THRESHOLD) {
    return alignment + shortPeriodExposureBonus(halfWidth);
  }

  if (signal.periodS >= LONG_PERIOD_THRESHOLD) {
    if (halfWidth >= ABSURDLY_WIDE_DEG) return alignment - ABSURDLY_WIDE_PENALTY;
    return alignment;
  }

  // Mid period (8 < p < 12): mild absurdly-wide penalty.
  if (halfWidth >= ABSURDLY_WIDE_DEG) return alignment - ABSURDLY_WIDE_PENALTY / 2;
  return alignment;
}
