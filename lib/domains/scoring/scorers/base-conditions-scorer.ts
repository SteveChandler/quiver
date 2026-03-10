/**
 * Base Conditions Scorer
 *
 * Scores wave height and period against beach thresholds.
 * These are the fundamental conditions for surfability.
 *
 * Weight: 0.25 (25% of total score)
 *
 * DOMAIN KNOWLEDGE:
 *
 * Wave Height Scoring:
 * - Ideal range varies by beach but defaults to 2-5ft
 * - Below ideal: Compressed curve (0 → 55 at idealMin)
 * - Ideal range: Ramp from 55 at idealMin to 100 at idealMax
 * - Above ideal: More challenging, requires skill (moderate penalty from 100 → 70)
 * - Very large: Epic conditions for skilled surfers (85)
 *
 * Wave Period Scoring:
 * - Period indicates swell energy (longer = more power)
 * - <6s: Wind swell, short-lived weak waves
 * - 6-10s: Fair conditions, moderate energy
 * - 10s+: Ground swell, well-organized powerful waves
 * - Uses exponential asymptotic curve to reward longer periods
 *   with diminishing returns (18s is better than 14s, but not 2x better)
 */

import type { ScorerPlugin, ScorerInput, ScorerResult } from '../types';
import { SCORER_WEIGHTS } from '../types';
import type { SkillLevel } from '../../spot-profile/types';
import { SKILL_WAVE_RANGES } from '../../user-preferences/skill-level';

// ============================================================================
// Configuration Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

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
 * Get wave config adjusted for the beach's skill level.
 *
 * The idealMin for each skill level is derived from SKILL_WAVE_RANGES.ideal.min
 * (canonical source in user-preferences/skill-level.ts) rather than being
 * duplicated here. The hard gate counterpart (SKILL_LEVEL_MINIMUMS) lives in
 * surf-call-logic.ts and is derived from SKILL_WAVE_RANGES.acceptable.min
 * (with an intentional expert override — see that file for details).
 *
 * Returns DEFAULT_WAVE_CONFIG for null/unknown skill levels.
 */
function getWaveConfigForProfile(skillLevel: SkillLevel | null): WaveHeightConfig {
  if (!skillLevel) return DEFAULT_WAVE_CONFIG;
  const ranges = SKILL_WAVE_RANGES[skillLevel];
  if (!ranges) return DEFAULT_WAVE_CONFIG;
  return {
    idealMin: ranges.ideal.min,
    idealMax: DEFAULT_WAVE_CONFIG.idealMax,
    absoluteMax: DEFAULT_WAVE_CONFIG.absoluteMax,
  };
}

/**
 * Period thresholds for scoring tiers.
 */
const PERIOD_THRESHOLDS = {
  /** Excellent period threshold (seconds) - used for documentation */
  excellent: 14,
  /** Good period threshold (seconds) - base of asymptotic curve */
  good: 10,
  /** Fair period threshold (seconds) - below this is wind swell */
  fair: 6,
};

/**
 * Period scoring parameters for exponential asymptotic curve.
 *
 * Formula: score = BASE_GOOD_SCORE + SCORE_RANGE * (1 - e^(-DECAY_CONSTANT * excess))
 * where excess = period - PERIOD_THRESHOLDS.good
 *
 * This produces scores like:
 * - 10s → 70
 * - 14s → 84
 * - 18s → 91
 * - 22s → 95
 */
const PERIOD_SCORING = {
  /** Decay constant controlling how quickly scores approach maximum */
  decayConstant: 0.15,
  /** Minimum score for periods >= good threshold (10s) */
  baseGoodScore: 70,
  /** Additional points available above base (70→100 range) */
  scoreRange: 30,
  /** Score threshold for "Strong swell energy" reason message */
  strongSwellThreshold: 85,
  /** Maximum score for fair period range (6-10s) */
  fairMaxScore: 70,
  /** Minimum score for fair period range (6-10s) */
  fairMinScore: 40,
  /** Maximum score for poor period range (<6s) */
  poorMaxScore: 40,
};

/**
 * Wave height scoring parameters.
 *
 * Sub-ideal waves cap at subIdealCeiling (55) to compress scores for
 * waves below idealMin.  The ideal range then ramps from 55 → 100 so
 * that idealMin is the transition point and idealMax is the peak.
 */
const WAVE_HEIGHT_SCORING = {
  /** Maximum score at idealMax (top of ideal range) */
  idealMaxScore: 100,
  /** Score at idealMin (bottom of ideal range / ceiling for sub-ideal) */
  subIdealCeiling: 55,
  /** Maximum penalty for large waves (100 - this = minimum score) */
  largeWavePenalty: 30,
  /** Minimum score for waves above ideal but below absolute max */
  largeWaveMinScore: 70,
  /** Score for epic/very large swells */
  epicSwellScore: 85,
  /** Threshold below which "small but rideable" message appears */
  smallWaveThreshold: 1,
};

/**
 * General condition thresholds.
 */
const CONDITION_THRESHOLDS = {
  /** Wave height below which conditions are considered flat */
  flatConditionsFt: 0.5,
  /** Wave height below which "may be too small" warning appears */
  tooSmallWarningFt: 1,
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

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Score wave height fit (0-100).
 *
 * Scoring logic:
 * - Below ideal: Linear ramp from 0 → subIdealCeiling (55)
 * - Ideal range:  Ramp from subIdealCeiling (55) at idealMin → 100 at idealMax
 * - Above ideal but rideable: Linear ramp from 100 → 70
 * - Very large (epic): 85 (skill adjustment handles appropriateness)
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
  const { subIdealCeiling, idealMaxScore } = WAVE_HEIGHT_SCORING;

  // Below ideal - compressed partial score (0 → 55)
  if (height < idealMin) {
    const ratio = height / idealMin;
    const score = Math.round(ratio * subIdealCeiling);
    return {
      score: Math.max(0, Math.min(subIdealCeiling, score)),
      reason: height >= WAVE_HEIGHT_SCORING.smallWaveThreshold
        ? `Below ideal range (${height.toFixed(1)}ft < ${idealMin}ft minimum)`
        : null,
    };
  }

  // Ideal range - ramp from subIdealCeiling (55) at idealMin → 100 at idealMax
  if (height >= idealMin && height <= idealMax) {
    const progress = (height - idealMin) / Math.max(idealMax - idealMin, 1);
    const rampRange = idealMaxScore - subIdealCeiling; // 45
    const score = Math.round(subIdealCeiling + progress * rampRange);
    return {
      score,
      reason: `Good wave size (${height.toFixed(1)}ft)`,
    };
  }

  // Above ideal but below absolute max
  if (height > idealMax && height < absoluteMax) {
    // Linear from 100 at idealMax to 70 at absoluteMax
    const range = absoluteMax - idealMax;
    const excess = height - idealMax;
    const penalty = (excess / range) * WAVE_HEIGHT_SCORING.largeWavePenalty;
    const score = Math.round(idealMaxScore - penalty);
    return {
      score: Math.max(WAVE_HEIGHT_SCORING.largeWaveMinScore, score),
      reason: `Larger swell (${height.toFixed(1)}ft)`,
    };
  }

  // Very large swell (>= absoluteMax) - epic conditions!
  // Let skill-based adjustment in discovery-adapter handle appropriateness
  // Advanced/expert surfers should see high scores for big waves
  return {
    score: WAVE_HEIGHT_SCORING.epicSwellScore,
    reason: `Epic swell (${height.toFixed(1)}ft)`,
  };
}

/**
 * Score period energy (0-100).
 *
 * Uses exponential asymptotic scoring for periods >= 10s to properly
 * reward longer periods with diminishing returns.
 *
 * Scoring tiers:
 * - 10s+: Exponential asymptotic curve (70→100)
 * - 6-10s: Linear interpolation (40→70)
 * - <6s: Linear from 0 (0→40)
 */
function scorePeriod(period: number): { score: number; reason: string | null } {
  if (period <= 0) {
    return { score: 0, reason: null };
  }

  const { good, fair } = PERIOD_THRESHOLDS;
  const {
    decayConstant,
    baseGoodScore,
    scoreRange,
    strongSwellThreshold,
    fairMaxScore,
    fairMinScore,
    poorMaxScore,
  } = PERIOD_SCORING;

  // Good to excellent period (10s+)
  // Exponential asymptotic approach: rewards longer periods with diminishing returns
  if (period >= good) {
    const excessPeriod = period - good;
    const asymptote = 1 - Math.exp(-decayConstant * excessPeriod);
    const score = Math.round(baseGoodScore + scoreRange * asymptote);

    return {
      score: Math.min(100, score),
      reason: score >= strongSwellThreshold
        ? `Strong swell energy (${period.toFixed(1)}s period)`
        : 'Good swell energy',
    };
  }

  // Fair period (6-10s)
  if (period >= fair) {
    const range = good - fair;
    const progress = (period - fair) / range;
    const score = Math.round(fairMinScore + progress * (fairMaxScore - fairMinScore));
    return {
      score,
      reason: null,
    };
  }

  // Poor period (<6s - wind swell)
  const score = Math.round((period / fair) * poorMaxScore);
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
  const isTooSmall = snapshot.waveHeight < CONDITION_THRESHOLDS.flatConditionsFt;
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

  if (snapshot.waveHeight < CONDITION_THRESHOLDS.tooSmallWarningFt) {
    warnings.push('Waves may be too small');
  }
  if (snapshot.wavePeriod < PERIOD_THRESHOLDS.fair) {
    warnings.push('Short period wind swell');
  }

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

// ============================================================================
// Exported Scorer Plugin
// ============================================================================

/**
 * Base conditions scorer plugin.
 *
 * Evaluates wave height and period to determine baseline surfability.
 * This is the foundation - if base conditions are poor, nothing else matters.
 */
export const baseConditionsScorer: ScorerPlugin = {
  name: 'baseConditions',
  weight: SCORER_WEIGHTS.baseConditions,
  score: (input) => scoreBaseConditions(input, getWaveConfigForProfile(input.profile.skillLevel)),
};

