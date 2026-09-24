/**
 * Tide Fit Scorer
 *
 * Scores tide height against beach preferences.
 * Some beaches work better at different tide heights.
 *
 * Weight: 0.10 (10% of total score)
 *
 * Key behaviors:
 * - Within preferred range: Full score
 * - Outside range: Gradual degradation
 * - Extreme tides: Can trigger warnings
 * - Curated bands: a known tide outside the band caps the verdict
 */

import type { ScorerPlugin, ScorerInput, ScorerResult, ScoringDecisionEffect } from '../types';
import { SCORER_WEIGHTS } from '../types';

/** Band edges are approximate; ignore the first quarter foot outside them. */
const TIDE_BAND_TOLERANCE_FT = 0.25;

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

function tideBandEffect(
  excessFt: number,
  side: 'high' | 'low',
): ScoringDecisionEffect | null {
  if (excessFt <= TIDE_BAND_TOLERANCE_FT) return null;
  const tier = TIDE_BAND_CEILINGS.find((entry) => excessFt <= entry.maxExcessFt)!;
  return {
    code: 'tide_outside_band',
    severity: 'material',
    verdictCeiling: tier.ceiling,
    // Matches the scorer warning text so the engine does not surface both.
    message: excessFt > 1.5 ? `Tide is ${side}` : `Tide a bit ${side}`,
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

    // If very wide preferences (no real preference), give moderate score
    if (maxHeightFt - minHeightFt >= 10) {
      return {
        name: 'tideFit',
        score: 70,
        weight: SCORER_WEIGHTS.tideFit,
        reasons: [],
        warnings: [],
        skip: false,
        skipReason: null,
      };
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

      if (diff > 1.5) {
        warnings.push('Tide is low');
      } else if (diff > 0.5) {
        warnings.push('Tide a bit low');
      }
    }
    // Above preferred range
    else {
      const diff = tideHeight - maxHeightFt;
      offsetFt = diff;
      // Linear degradation: lose 25 points per foot above
      score = Math.max(20, Math.round(100 - diff * 25));

      if (diff > 1.5) {
        warnings.push('Tide is high');
      } else if (diff > 0.5) {
        warnings.push('Tide a bit high');
      }
    }

    // Only a curated band and a real tide reading can cap the verdict.
    const effect =
      tidePreferences.explicitRange && snapshot.tide.heightKnown !== false && offsetFt !== 0
        ? tideBandEffect(Math.abs(offsetFt), offsetFt > 0 ? 'high' : 'low')
        : null;

    return {
      name: 'tideFit',
      score,
      weight: SCORER_WEIGHTS.tideFit,
      reasons,
      warnings,
      ...(effect ? { effects: [effect] } : {}),
      skip: false,
      skipReason: null,
    };
  },
};
