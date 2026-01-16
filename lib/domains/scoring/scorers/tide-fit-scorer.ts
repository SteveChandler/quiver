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
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS } from '../types';

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

    // Within preferred range - full score
    if (tideHeight >= minHeightFt && tideHeight <= maxHeightFt) {
      score = 100;
      reasons.push('Good tide');
    }
    // Below preferred range
    else if (tideHeight < minHeightFt) {
      const diff = minHeightFt - tideHeight;
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
      // Linear degradation: lose 25 points per foot above
      score = Math.max(20, Math.round(100 - diff * 25));

      if (diff > 1.5) {
        warnings.push('Tide is high');
      } else if (diff > 0.5) {
        warnings.push('Tide a bit high');
      }
    }

    return {
      name: 'tideFit',
      score,
      weight: SCORER_WEIGHTS.tideFit,
      reasons,
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};
