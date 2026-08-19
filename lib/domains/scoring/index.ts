/**
 * Scoring Domain
 *
 * Pluggable scoring engine for surf conditions.
 */

// Types
export type {
  ScorerInput,
  ScorerResult,
  ScorerPlugin,
  CompositeScore,
  MatchQuality,
  ScoringEngineConfig,
  ScoringDecisionEffect,
  ScoringEffectSeverity,
} from './types';

export { SCORER_WEIGHTS, DEFAULT_SCORING_CONFIG, createSkipResult, createNeutralResult } from './types';

// Engine
export { ScoringEngine, createScoringEngine, scoreWithPlugins } from './scoring-engine';

// Scorers
export {
  baseConditionsScorer,
  swellAlignmentScorer,
  swellInterferenceScorer,
  windQualityScorer,
  tideFitScorer,
  tideDirectionScorer,
  detectSetupRisk,
  LOW_TIDE_HEAVY_SWELL_WARNING,
  setupRiskScorer,
  windowStabilityScorer,
  trendPreferenceScorer,
} from './scorers';

// Condition character classifier (qualitative category + label)
export type {
  ConditionCharacter,
  ConditionCharacterCategory,
} from './condition-character';
export { getConditionCharacter } from './condition-character';

// Discovery adapter (backwards compatibility with surf-discovery-service)
export type {
  DiscoveryScoringOptions,
  SkillCeilingResult,
  BeachSkillMatchResult,
} from './discovery-adapter';
export {
  createDiscoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  compositeToDetailedScore,
  scoreBeachWithEngine,
  // Wave size scoring configuration and helper functions
  WAVE_SIZE_SCORING_CONFIG,
  SKILL_WAVE_RANGES,
  checkSkillCeiling,
  calculateBeachSkillMatchBonus,
} from './discovery-adapter';
