/**
 * Window Stability Scorer
 *
 * Scores how stable/consistent conditions are over a time window.
 * Stable conditions are preferable - surfers can plan their session.
 *
 * Weight: 0.10 (10% of total score)
 *
 * Key behaviors:
 * - Stable conditions (low variance): Bonus up to +20
 * - High variance: Penalty up to -15
 * - Single snapshot: Neutral (can't assess stability)
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS, createNeutralResult } from '../types';
import { isWindowStable, describeWindowStability } from '../../conditions';

/**
 * Stability scoring thresholds.
 */
const STABILITY_THRESHOLDS = {
  /** Wave height variance threshold for "very stable" */
  veryStableWaveVariance: 0.3,
  /** Wave height variance threshold for "stable" */
  stableWaveVariance: 0.5,
  /** Wave height variance threshold for "acceptable" */
  acceptableWaveVariance: 1.0,
  /** Wave height variance threshold for "unstable" */
  unstableWaveVariance: 2.0,

  /** Wind variance threshold for "very stable" */
  veryStableWindVariance: 2,
  /** Wind variance threshold for "stable" */
  stableWindVariance: 4,
  /** Wind variance threshold for "acceptable" */
  acceptableWindVariance: 6,
};

/**
 * Window stability scorer plugin.
 *
 * NEW scorer that addresses a gap in the existing scoring system:
 * Individual forecast points were scored, but not the consistency
 * of conditions over time.
 *
 * This scorer:
 * 1. Analyzes wave height variance over the window
 * 2. Analyzes wind variance over the window
 * 3. Rewards stable conditions, penalizes erratic conditions
 */
export const windowStabilityScorer: ScorerPlugin = {
  name: 'windowStability',
  weight: SCORER_WEIGHTS.windowStability,

  score(input: ScorerInput): ScorerResult {
    const { window } = input;

    // If no window data (single snapshot), return neutral
    if (!window || window.snapshots.length < 2) {
      return createNeutralResult('windowStability', SCORER_WEIGHTS.windowStability);
    }

    // Calculate stability scores
    const waveScore = scoreWaveStability(window.waveHeightVariance);
    const windScore = scoreWindStability(window.windVariance);

    // Combine scores (wave stability weighted more heavily - 60/40)
    const combinedScore = Math.round(waveScore * 0.6 + windScore * 0.4);

    // Build reasons and warnings
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Get human-readable description
    const description = describeWindowStability(window);

    if (combinedScore >= 80) {
      reasons.push('Consistent conditions throughout');
    } else if (combinedScore >= 60) {
      reasons.push(description);
    }

    if (combinedScore < 50) {
      warnings.push('Variable conditions - timing may be tricky');
    }

    // Check for specific variance issues
    if (window.waveHeightVariance > STABILITY_THRESHOLDS.unstableWaveVariance) {
      warnings.push('Wave height varying significantly');
    }
    if (window.windVariance > STABILITY_THRESHOLDS.acceptableWindVariance) {
      warnings.push('Wind conditions changing');
    }

    return {
      name: 'windowStability',
      score: combinedScore,
      weight: SCORER_WEIGHTS.windowStability,
      reasons,
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};

/**
 * Stability band configuration for variance-to-score mapping.
 * Each band defines a variance threshold and the score at that threshold.
 */
interface StabilityBand {
  threshold: number;
  score: number;
}

/**
 * Generic stability scorer using band-based interpolation.
 *
 * @param variance - The variance value to score
 * @param bands - Array of bands in ascending threshold order, each with a threshold and score at that threshold
 * @param overflowPenaltyRate - Score penalty per unit variance beyond last band
 * @param floorScore - Minimum score to return
 */
function scoreStability(
  variance: number,
  bands: StabilityBand[],
  overflowPenaltyRate: number,
  floorScore: number
): number {
  // Perfect stability - below first threshold
  if (variance <= bands[0].threshold) {
    return 100;
  }

  // Find the band we're in and interpolate
  for (let i = 1; i < bands.length; i++) {
    if (variance <= bands[i].threshold) {
      const prevBand = bands[i - 1];
      const currBand = bands[i];
      const progress = (variance - prevBand.threshold) / (currBand.threshold - prevBand.threshold);
      return Math.round(prevBand.score - progress * (prevBand.score - currBand.score));
    }
  }

  // Beyond all bands - apply overflow penalty
  const lastBand = bands[bands.length - 1];
  const overflow = variance - lastBand.threshold;
  return Math.max(floorScore, Math.round(lastBand.score - overflow * overflowPenaltyRate));
}

/** Wave stability scoring bands */
const WAVE_STABILITY_BANDS: StabilityBand[] = [
  { threshold: STABILITY_THRESHOLDS.veryStableWaveVariance, score: 100 },
  { threshold: STABILITY_THRESHOLDS.stableWaveVariance, score: 90 },
  { threshold: STABILITY_THRESHOLDS.acceptableWaveVariance, score: 70 },
  { threshold: STABILITY_THRESHOLDS.unstableWaveVariance, score: 40 },
];

/** Wind stability scoring bands */
const WIND_STABILITY_BANDS: StabilityBand[] = [
  { threshold: STABILITY_THRESHOLDS.veryStableWindVariance, score: 100 },
  { threshold: STABILITY_THRESHOLDS.stableWindVariance, score: 85 },
  { threshold: STABILITY_THRESHOLDS.acceptableWindVariance, score: 60 },
];

/**
 * Score wave height stability (0-100).
 */
function scoreWaveStability(variance: number): number {
  return scoreStability(variance, WAVE_STABILITY_BANDS, 5, 20);
}

/**
 * Score wind stability (0-100).
 */
function scoreWindStability(variance: number): number {
  return scoreStability(variance, WIND_STABILITY_BANDS, 5, 30);
}
