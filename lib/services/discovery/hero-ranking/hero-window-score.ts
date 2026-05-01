/**
 * Hero window score — weighted composer over the per-candidate evidence.
 *
 * Inputs are the four already-computed signals (representativeSlot,
 * setupSuitability, tideFitAcrossWindow, windQualityScore) plus the raw
 * windowSlotScores + duration that drive persistence/duration.
 *
 * Weights:
 *   setupSuitability    0.30  — venue-vs-setup match (the hero-only edge)
 *   representativeSlot  0.25  — engine score; carries personalization
 *   tideFit             0.15
 *   windQuality         0.15
 *   persistence         0.10
 *   duration            0.05
 *                       ----
 *                       1.00
 *
 * No `userFitAdjustment` — `affinityBonus` is already baked into the engine
 * `score`, so it flows through `representativeSlotScore`. Re-adding it would
 * double-count personalization (decision log #4 in the plan).
 */

import {
  computeWindowDurationScore,
  computeWindowPersistence,
} from "./window-evidence";

export interface HeroWindowScoreInput {
  /** 0-100, already includes affinityBonus from the engine. */
  representativeSlotScore: number;
  /** 0-100. */
  setupSuitability: number;
  /** Raw scorer outputs across the window's slots; drives persistence. */
  windowSlotScores: number[];
  /** Window duration in hours; drives duration score. */
  windowDurationHours: number;
  /** 0-100. Mean of tideFit across slots, scaled to 100. */
  tideFitAcrossWindow: number;
  /** 0-100. Mean of windAlignment across slots, scaled to 100. */
  windQualityScore: number;
}

const WEIGHTS = {
  setupSuitability: 0.3,
  representativeSlot: 0.25,
  persistence: 0.1,
  duration: 0.05,
  tideFit: 0.15,
  windQuality: 0.15,
} as const;

/**
 * Computes the hero window score (0-100) by weighted-summing the input
 * signals. Output is clamped to [0, 100].
 */
export function computeHeroWindowScore(input: HeroWindowScoreInput): number {
  const persistence = computeWindowPersistence(input.windowSlotScores);
  const duration = computeWindowDurationScore(input.windowDurationHours);

  const total =
    WEIGHTS.setupSuitability * input.setupSuitability +
    WEIGHTS.representativeSlot * input.representativeSlotScore +
    WEIGHTS.persistence * persistence +
    WEIGHTS.duration * duration +
    WEIGHTS.tideFit * input.tideFitAcrossWindow +
    WEIGHTS.windQuality * input.windQualityScore;

  return Math.max(0, Math.min(100, total));
}
