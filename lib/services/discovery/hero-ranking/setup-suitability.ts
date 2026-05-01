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
 * short-period (≤8s) swells, wide-window beaches CATCH that energy and
 * narrow-window beaches do NOT. Wide vs narrow is keyed off
 * `swellWindow.halfWidthDeg` — generic, no hardcoded slugs.
 *
 * Mid/long period: alignment alone is the right signal — the engine's
 * existing period attenuation handles it without our help.
 */

import type { SpotProfile } from "@/lib/domains/spot-profile/types";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { calculateWindowAlignment } from "@/lib/domains/spot-profile/spot-profile";

const SHORT_PERIOD_THRESHOLD = 8;
const WIDE_HALFWIDTH_THRESHOLD = 55;
const NARROW_HALFWIDTH_THRESHOLD = 30;
const EXPOSURE_BONUS = 15;
const SELECTIVITY_PENALTY = 15;
const NEUTRAL_FALLBACK = 50;

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
 * Computes a 0–100 setup-suitability score for the candidate beach against
 * the current swell setup.
 *
 *  - Foundation: `calculateWindowAlignment` (0–100, wraparound-safe).
 *  - Short-period (≤8s) bonus/penalty based on window half-width:
 *      • halfWidthDeg ≥ 55  → +15 (exposure bonus)
 *      • halfWidthDeg ≤ 30  → −15 (selectivity penalty)
 *      • otherwise no adjustment.
 *  - Mid/long period (>8s): alignment alone.
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

  // Foundation: wraparound-safe alignment 0–100.
  const alignment = calculateWindowAlignment(direction, window);

  if (period <= SHORT_PERIOD_THRESHOLD) {
    if (window.halfWidthDeg >= WIDE_HALFWIDTH_THRESHOLD) {
      return Math.min(100, alignment + EXPOSURE_BONUS);
    }
    if (window.halfWidthDeg <= NARROW_HALFWIDTH_THRESHOLD) {
      return Math.max(0, alignment - SELECTIVITY_PENALTY);
    }
    return alignment;
  }

  return alignment;
}
