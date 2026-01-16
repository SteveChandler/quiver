/**
 * Base Conditions Scorer
 *
 * Scores wave height and period against beach thresholds.
 * These are the fundamental conditions for surfability.
 *
 * Weight: 0.25 (25% of total score)
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS } from '../types';

/**
 * Configuration for wave height scoring.
 */
interface WaveHeightConfig {
  /** Minimum ideal wave height (ft) */
  idealMin: number;
  /** Maximum ideal wave height (ft) */
  idealMax: number;
  /** Maximum rideable wave height (ft) */
  absoluteMax: number;
}

/**
 * Default wave height configuration.
 * Can be overridden per-beach in SpotProfile.
 */
const DEFAULT_WAVE_CONFIG: WaveHeightConfig = {
  idealMin: 2,
  idealMax: 5,
  absoluteMax: 8,
};

/**
 * Period thresholds for scoring.
 */
const PERIOD_THRESHOLDS = {
  /** Excellent period (seconds) */
  excellent: 14,
  /** Good period (seconds) */
  good: 10,
  /** Fair period (seconds) */
  fair: 6,
};

/**
 * Weights for combining wave height and period scores.
 * Height is weighted more heavily as it's the primary surfability factor.
 */
const COMPONENT_WEIGHTS = {
  /** Wave height contribution to combined score */
  waveHeight: 0.6,
  /** Wave period contribution to combined score */
  wavePeriod: 0.4,
};

/**
 * Score wave height fit (0-100).
 *
 * Scoring logic:
 * - Ideal range (2-5ft): 100
 * - Below ideal (1-2ft): Linear ramp from 50-100
 * - Above ideal (5-8ft): Linear ramp from 100-60
 * - Very large (8ft+): Fixed 60 (expert only)
 * - Flat (0ft): 0
 */
function scoreWaveHeight(
  height: number,
  config: WaveHeightConfig = DEFAULT_WAVE_CONFIG
): { score: number; reason: string | null } {
  if (height <= 0) {
    return { score: 0, reason: null };
  }

  const { idealMin, idealMax, absoluteMax } = config;

  // Ideal range - full score
  if (height >= idealMin && height <= idealMax) {
    return {
      score: 100,
      reason: `Good wave size (${height.toFixed(1)}ft)`,
    };
  }

  // Below ideal - partial score
  if (height < idealMin) {
    // Linear from 0 at 0ft to 100 at idealMin
    const score = Math.round((height / idealMin) * 100);
    return {
      score: Math.max(0, Math.min(100, score)),
      reason: height >= 1 ? 'Small but rideable waves' : null,
    };
  }

  // Above ideal but within absolute max
  if (height > idealMax && height <= absoluteMax) {
    // Linear from 100 at idealMax to 60 at absoluteMax
    const range = absoluteMax - idealMax;
    const excess = height - idealMax;
    const penalty = (excess / range) * 40;
    const score = Math.round(100 - penalty);
    return {
      score: Math.max(60, score),
      reason: `Larger swell (${height.toFixed(1)}ft)`,
    };
  }

  // Very large swell - expert only
  return {
    score: 60,
    reason: 'Big swell - expert conditions',
  };
}

/**
 * Score period energy (0-100).
 *
 * Longer periods = more energy = better waves.
 *
 * Scoring logic:
 * - 14s+: 100 (excellent)
 * - 10-14s: 70-100 (good)
 * - 6-10s: 40-70 (fair)
 * - <6s: 0-40 (poor - wind swell)
 */
function scorePeriod(period: number): { score: number; reason: string | null } {
  if (period <= 0) {
    return { score: 0, reason: null };
  }

  const { excellent, good, fair } = PERIOD_THRESHOLDS;

  // Excellent period
  if (period >= excellent) {
    return {
      score: 100,
      reason: `Strong swell energy (${Math.round(period)}s period)`,
    };
  }

  // Good period (10-14s)
  if (period >= good) {
    const range = excellent - good;
    const progress = (period - good) / range;
    const score = Math.round(70 + progress * 30);
    return {
      score,
      reason: 'Good swell energy',
    };
  }

  // Fair period (6-10s)
  if (period >= fair) {
    const range = good - fair;
    const progress = (period - fair) / range;
    const score = Math.round(40 + progress * 30);
    return {
      score,
      reason: null,
    };
  }

  // Poor period (<6s - wind swell)
  const score = Math.round((period / fair) * 40);
  return {
    score: Math.max(0, score),
    reason: null,
  };
}

/**
 * Shared implementation for base conditions scoring.
 * Used by both default scorer and custom-config factory.
 */
function scoreBaseConditions(input: ScorerInput, config: WaveHeightConfig): ScorerResult {
  const { snapshot } = input;

  // Check for skip conditions first
  const isTooSmall = snapshot.waveHeight < 0.5;
  if (isTooSmall) {
    return {
      name: 'baseConditions',
      score: 0,
      weight: SCORER_WEIGHTS.baseConditions,
      reasons: [],
      warnings: ['Flat conditions - no rideable waves'],
      skip: true,
      skipReason: 'Flat conditions - no rideable waves',
    };
  }

  // Score individual components
  const heightResult = scoreWaveHeight(snapshot.waveHeight, config);
  const periodResult = scorePeriod(snapshot.wavePeriod);

  // Combine scores (weighted average: height 60%, period 40%)
  const combinedScore = Math.round(
    heightResult.score * COMPONENT_WEIGHTS.waveHeight +
    periodResult.score * COMPONENT_WEIGHTS.wavePeriod
  );

  // Collect reasons and warnings
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (heightResult.reason) reasons.push(heightResult.reason);
  if (periodResult.reason) reasons.push(periodResult.reason);

  if (snapshot.waveHeight < 1) warnings.push('Waves may be too small');
  if (snapshot.wavePeriod < PERIOD_THRESHOLDS.fair) warnings.push('Short period wind swell');

  return {
    name: 'baseConditions',
    score: combinedScore,
    weight: SCORER_WEIGHTS.baseConditions,
    reasons,
    warnings,
    skip: false,
    skipReason: null,
  };
}

/**
 * Base conditions scorer plugin.
 *
 * Evaluates wave height and period to determine baseline surfability.
 * This is the foundation - if base conditions are poor, nothing else matters.
 */
export const baseConditionsScorer: ScorerPlugin = {
  name: 'baseConditions',
  weight: SCORER_WEIGHTS.baseConditions,
  score: (input) => scoreBaseConditions(input, DEFAULT_WAVE_CONFIG),
};

/**
 * Create a base conditions scorer with custom configuration.
 */
export function createBaseConditionsScorer(
  customConfig?: Partial<WaveHeightConfig>
): ScorerPlugin {
  const config = { ...DEFAULT_WAVE_CONFIG, ...customConfig };
  return {
    name: 'baseConditions',
    weight: SCORER_WEIGHTS.baseConditions,
    score: (input) => scoreBaseConditions(input, config),
  };
}
