/**
 * Tide Fit Scorer
 *
 * Scores tide height against beach preferences.
 * Some beaches work better at different tide heights.
 *
 * Weight: 0.05 (5% of total score)
 *
 * Key behaviors:
 * - Within preferred range: Full score
 * - Outside range: Gradual degradation
 * - Extreme tides: Can trigger warnings
 * - Curated bands: a known tide outside the band caps the verdict
 * - Tide swing (flag): rate-aware softening and `tide_swing` effects. This is
 *   the only scorer that emits tide effects.
 */

import type { ScorerPlugin, ScorerInput, ScorerResult, ScoringDecisionEffect } from '../types';
import { SCORER_WEIGHTS } from '../types';
import { isTideSwingEnabled } from '@/lib/flags/tide-swing';
import {
  assessTideSwing,
  softenTideBandCeiling,
  TIDE_BAND_TOLERANCE_FT,
  type TideSwingAssessment,
} from '../tide-swing';

/**
 * Verdict ceilings for a known tide outside a curated band. The first tier
 * keeps a go but never EPIC; beyond a foot the call drops to maybe, and no
 * tier pushes the score below FAIR on tide alone.
 */
const TIDE_BAND_CEILINGS = [
  { maxExcessFt: 1, ceiling: 79 },
  { maxExcessFt: 2, ceiling: 69 },
  { maxExcessFt: Infinity, ceiling: 55 },
] as const;

function tideWarning(diffFt: number, side: 'high' | 'low'): string {
  return diffFt > 1.5 ? `Tide is ${side}` : `Tide a bit ${side}`;
}

function tideBandEffect(
  excessFt: number,
  side: 'high' | 'low',
  reentryMessage: string | null = null,
): ScoringDecisionEffect | null {
  if (excessFt <= TIDE_BAND_TOLERANCE_FT) return null;
  const tier = TIDE_BAND_CEILINGS.find((entry) => excessFt <= entry.maxExcessFt)!;
  if (reentryMessage) {
    // Back in range within the hour: "better from noon", not a dead day.
    return {
      code: 'tide_outside_band',
      severity: 'material',
      verdictCeiling: softenTideBandCeiling(tier.ceiling),
      message: reentryMessage,
    };
  }
  return {
    code: 'tide_outside_band',
    severity: 'material',
    verdictCeiling: tier.ceiling,
    // Same text as the scorer warning: the engine drops effect messages it already shows.
    message: tideWarning(excessFt, side),
  };
}

function withSwing(
  result: ScorerResult,
  swing: TideSwingAssessment | null,
): ScorerResult {
  if (!swing) return result;
  const effects = [...(result.effects ?? []), ...swing.effects];
  return {
    ...result,
    reasons: [...result.reasons, ...swing.reasons],
    warnings: [...result.warnings, ...swing.warnings],
    ...(effects.length > 0 ? { effects } : {}),
  };
}

/**
 * Tide fit scorer plugin.
 *
 * Ported from existing surf-conditions-scorer.ts with improvements:
 * - Uses SpotProfile tide preferences
 * - More informative reasons and warnings
 */
export const tideFitScorer: ScorerPlugin = {
  name: 'tideFit',
  weight: SCORER_WEIGHTS.tideFit,

  score(input: ScorerInput): ScorerResult {
    const { snapshot, profile } = input;
    const tideHeight = snapshot.tide.heightFt;
    const { tidePreferences } = profile;
    const { minHeightFt, maxHeightFt } = tidePreferences;
    const swing = isTideSwingEnabled() ? assessTideSwing(snapshot, profile) : null;

    // If very wide preferences (no real preference), give moderate score
    if (maxHeightFt - minHeightFt >= 10) {
      return withSwing({
        name: 'tideFit',
        score: 70,
        weight: SCORER_WEIGHTS.tideFit,
        reasons: [],
        warnings: [],
        skip: false,
        skipReason: null,
      }, swing);
    }

    const reasons: string[] = [];
    const warnings: string[] = [];
    let score: number;
    let offsetFt = 0;

    // Within preferred range - full score
    if (tideHeight >= minHeightFt && tideHeight <= maxHeightFt) {
      score = 100;
      reasons.push('Good tide');
    }
    // Below preferred range
    else if (tideHeight < minHeightFt) {
      const diff = minHeightFt - tideHeight;
      offsetFt = -diff;
      // Linear degradation: lose 25 points per foot below
      score = Math.max(20, Math.round(100 - diff * 25));

      if (diff > 0.5) warnings.push(tideWarning(diff, 'low'));
    }
    // Above preferred range
    else {
      const diff = tideHeight - maxHeightFt;
      offsetFt = diff;
      // Linear degradation: lose 25 points per foot above
      score = Math.max(20, Math.round(100 - diff * 25));

      if (diff > 0.5) warnings.push(tideWarning(diff, 'high'));
    }

    // Only a curated band and a real tide reading can cap the verdict.
    const effect =
      tidePreferences.explicitRange && snapshot.tide.heightKnown !== false && offsetFt !== 0
        ? tideBandEffect(Math.abs(offsetFt), offsetFt > 0 ? 'high' : 'low', swing?.reentryMessage ?? null)
        : null;

    return withSwing({
      name: 'tideFit',
      score,
      weight: SCORER_WEIGHTS.tideFit,
      reasons,
      warnings,
      ...(effect ? { effects: [effect] } : {}),
      skip: false,
      skipReason: null,
    }, swing);
  },
};
