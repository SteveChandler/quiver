/**
 * Scoring Domain Types
 *
 * Defines the pluggable scoring architecture.
 * Scorers are independent modules that each contribute to the final score.
 */

import type { SpotProfile } from '../spot-profile/types';
import type { UserPreferences } from '../user-preferences/types';
import type { ConditionsSnapshot, ConditionsWindow } from '../conditions/types';

/**
 * Input provided to each scorer.
 */
export interface ScorerInput {
  /** Beach/spot profile with thresholds */
  readonly profile: SpotProfile;

  /** Current conditions snapshot */
  readonly snapshot: ConditionsSnapshot;

  /** Conditions window for trend analysis (null if single point) */
  readonly window: ConditionsWindow | null;

  /** User preferences for personalization (null if anonymous) */
  readonly preferences: UserPreferences | null;
}

/**
 * Result from a single scorer.
 */
export interface ScorerResult {
  /** Scorer name (for debugging/display) */
  readonly name: string;

  /** Score from this scorer (0-100) */
  readonly score: number;

  /** Weight of this scorer (0-1, will be normalized) */
  readonly weight: number;

  /** Positive factors that contributed to the score */
  readonly reasons: readonly string[];

  /** Negative factors or warnings */
  readonly warnings: readonly string[];

  /** If true, conditions are disqualifying (skip this beach) */
  readonly skip: boolean;

  /** Reason for skipping (if skip is true) */
  readonly skipReason: string | null;

  /** Structured decision effects. Strings remain presentation-only context. */
  readonly effects?: readonly ScoringDecisionEffect[];
}

export type ScoringEffectSeverity = 'informational' | 'material' | 'severe';

export interface ScoringDecisionEffect {
  readonly code: 'crossing_swells' | (string & {});
  readonly severity: ScoringEffectSeverity;
  /** Maximum condition/verdict score when this effect is present. */
  readonly verdictCeiling?: number;
  readonly message: string;
}

/**
 * Plugin interface for scorers.
 * Each scorer is responsible for one aspect of the evaluation.
 */
export interface ScorerPlugin {
  /** Unique name for this scorer */
  readonly name: string;

  /** Default weight (0-1) */
  readonly weight: number;

  /**
   * Compute score for the given input.
   * Should be a pure function with no side effects.
   */
  score(input: ScorerInput): ScorerResult;
}

/**
 * Match quality classification based on total score.
 */
export type MatchQuality = 'perfect' | 'excellent' | 'good' | 'fair' | 'skip';

/**
 * Combined score from all scorers.
 */
export interface CompositeScore {
  /** Total weighted score (0-100) */
  readonly total: number;

  /** Individual scores by scorer name */
  readonly subscores: ReadonlyMap<string, number>;

  /** Quality classification */
  readonly matchQuality: MatchQuality;

  /** Combined positive reasons (top 5) */
  readonly reasons: readonly string[];

  /** Combined warnings */
  readonly warnings: readonly string[];

  /** If set, beach should be skipped */
  readonly skipReason: string | null;

  /** Confidence in the score (0-100, based on data quality) */
  readonly confidence: number;

  /** Structured cautions/effects that must survive every adapter boundary. */
  readonly effects?: readonly ScoringDecisionEffect[];
}

/**
 * Configuration for the scoring engine.
 */
export interface ScoringEngineConfig {
  /** Minimum score to not be classified as 'skip' */
  readonly minScoreThreshold: number;

  /** Score thresholds for quality classification */
  readonly qualityThresholds: {
    readonly perfect: number;
    readonly excellent: number;
    readonly good: number;
    readonly fair: number;
  };

  /** Maximum reasons to include in output */
  readonly maxReasons: number;
}

/**
 * Default scoring engine configuration.
 */
export const DEFAULT_SCORING_CONFIG: ScoringEngineConfig = {
  minScoreThreshold: 40,
  qualityThresholds: {
    perfect: 85,
    excellent: 70,
    good: 55,
    fair: 40,
  },
  maxReasons: 5,
};

/**
 * Scorer weights as defined in the plan.
 */
export const SCORER_WEIGHTS = {
  /** Base conditions (wave height, period) */
  baseConditions: 0.25,

  /** Swell alignment with beach window */
  swellAlignment: 0.15,

  /** Swell interference (primary vs secondary) */
  swellInterference: 0.15,

  /** Wind quality (offshore/cross/onshore) */
  windQuality: 0.15,

  /** Tide fit (height only - direction moved to tideDirection) */
  tideFit: 0.05,

  /** Tide direction match with beach preference - NEW */
  tideDirection: 0.15,

  /** Setup-specific red-flag guardrails */
  setupRisk: 0,

  /** Window stability */
  windowStability: 0.05,

  /** Trend preference (improving conditions) */
  trendPreference: 0.05,
} as const;

/**
 * Helper to create a "skip" result.
 */
export function createSkipResult(
  name: string,
  reason: string,
  weight: number = 0
): ScorerResult {
  return {
    name,
    score: 0,
    weight,
    reasons: [],
    warnings: [reason],
    skip: true,
    skipReason: reason,
  };
}

/**
 * Helper to create a neutral result (no impact).
 */
export function createNeutralResult(
  name: string,
  weight: number = 0
): ScorerResult {
  return {
    name,
    score: 50,
    weight,
    reasons: [],
    warnings: [],
    skip: false,
    skipReason: null,
  };
}
