/**
 * Trend Preference Scorer
 *
 * Prefers improving conditions over degrading conditions.
 * Rising tide with building swell is better than falling tide with dying swell.
 *
 * Weight: 0.10 (10% of total score)
 *
 * Key behaviors:
 * - Improving overall trend: +15 to +20
 * - Stable trend: Neutral (baseline)
 * - Degrading trend: -10 to -20
 * - Tide direction alignment: +10 to +20 or -10 penalty
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS, createNeutralResult } from '../types';
import { isWindowImproving, isWindowDegrading } from '../../conditions';

/**
 * Trend scoring bonuses and penalties.
 */
const TREND_SCORES = {
  /** Bonus for improving conditions */
  improvingBonus: 85,
  /** Base score for stable conditions */
  stableBase: 60,
  /** Penalty for degrading conditions */
  degradingPenalty: 35,

  /** Bonus when tide matches beach preference */
  tideMatchBonus: 15,
  /** Penalty when tide opposes beach preference */
  tideMismatchPenalty: 10,

  /** Bonus for building swell */
  buildingSwellBonus: 10,
  /** Penalty for dying swell */
  dyingSwellPenalty: 5,

  /** Bonus for cleaning up wind */
  cleaningWindBonus: 10,
  /** Penalty for deteriorating wind */
  worseningWindPenalty: 5,
};

/**
 * Trend preference scorer plugin.
 *
 * NEW scorer that addresses a gap in the existing scoring system:
 * Rising tide and building swell were not preferred over static conditions.
 *
 * This scorer:
 * 1. Checks overall trend (improving/stable/degrading)
 * 2. Evaluates tide direction vs beach preference
 * 3. Rewards building swell and cleaning wind
 */
export const trendPreferenceScorer: ScorerPlugin = {
  name: 'trendPreference',
  weight: SCORER_WEIGHTS.trendPreference,

  score(input: ScorerInput): ScorerResult {
    const { window, snapshot, profile } = input;

    // If no window data (single snapshot), return neutral
    if (!window || window.snapshots.length < 2) {
      // Can still score tide direction from single snapshot
      const tideScore = scoreTideDirection(snapshot.tide.direction, profile.tidePreferences.preferredDirection);
      if (tideScore !== 0) {
        return {
          name: 'trendPreference',
          score: 50 + tideScore,
          weight: SCORER_WEIGHTS.trendPreference,
          reasons: tideScore > 0 ? ['Tide moving in preferred direction'] : [],
          warnings: tideScore < 0 ? ['Tide moving against preferred direction'] : [],
          skip: false,
          skipReason: null,
        };
      }
      return createNeutralResult('trendPreference', SCORER_WEIGHTS.trendPreference);
    }

    // Calculate base score from overall trend
    let score: number;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (isWindowImproving(window)) {
      score = TREND_SCORES.improvingBonus;
      reasons.push('Conditions improving');
    } else if (isWindowDegrading(window)) {
      score = TREND_SCORES.degradingPenalty;
      warnings.push('Conditions degrading');
    } else {
      score = TREND_SCORES.stableBase;
    }

    // Add tide direction bonus/penalty
    const tideBonus = scoreTideDirection(
      window.tideTrend === 'improving' ? 'rising' : window.tideTrend === 'degrading' ? 'falling' : 'slack',
      profile.tidePreferences.preferredDirection
    );
    score += tideBonus;

    if (tideBonus > 0) {
      reasons.push('Tide moving favorably');
    } else if (tideBonus < 0) {
      warnings.push('Tide moving against preference');
    }

    // Add wave height trend bonus/penalty
    if (window.waveHeightTrend === 'improving') {
      score += TREND_SCORES.buildingSwellBonus;
      reasons.push('Swell building');
    } else if (window.waveHeightTrend === 'degrading') {
      score -= TREND_SCORES.dyingSwellPenalty;
      warnings.push('Swell fading');
    }

    // Add wind trend bonus/penalty
    if (window.windSpeedTrend === 'improving') {
      score += TREND_SCORES.cleaningWindBonus;
      reasons.push('Wind cleaning up');
    } else if (window.windSpeedTrend === 'degrading') {
      score -= TREND_SCORES.worseningWindPenalty;
      warnings.push('Wind picking up');
    }

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      name: 'trendPreference',
      score,
      weight: SCORER_WEIGHTS.trendPreference,
      reasons,
      warnings,
      skip: false,
      skipReason: null,
    };
  },
};

/**
 * Score tide direction match with beach preference.
 * Returns bonus (positive) or penalty (negative).
 */
function scoreTideDirection(
  actualDirection: 'rising' | 'falling' | 'slack',
  preferredDirection: 'rising' | 'falling' | 'either' | 'slack'
): number {
  // If beach has no preference, no bonus/penalty
  if (preferredDirection === 'either') {
    return 0;
  }

  // If preferred is slack, bonus for slack, penalty for movement
  if (preferredDirection === 'slack') {
    return actualDirection === 'slack' ? TREND_SCORES.tideMatchBonus : -TREND_SCORES.tideMismatchPenalty / 2;
  }

  // Direct match is a bonus
  if (actualDirection === preferredDirection) {
    return TREND_SCORES.tideMatchBonus;
  }

  // Opposite direction is a penalty
  if (
    (actualDirection === 'rising' && preferredDirection === 'falling') ||
    (actualDirection === 'falling' && preferredDirection === 'rising')
  ) {
    return -TREND_SCORES.tideMismatchPenalty;
  }

  // Slack when movement preferred - slight penalty
  return -TREND_SCORES.tideMismatchPenalty / 2;
}
