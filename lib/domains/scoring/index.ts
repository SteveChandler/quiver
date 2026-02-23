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
  windowStabilityScorer,
  trendPreferenceScorer,
} from './scorers';

// Discovery adapter (backwards compatibility with surf-discovery-service)
export type {
  DiscoveryScoringOptions,
  SkillCeilingResult,
  SkillBonusResult,
  PreferenceAdjustmentResult,
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
  PREF_WAVE_RANGES,
  checkSkillCeiling,
  calculateSkillBonus,
  calculatePreferenceAdjustment,
} from './discovery-adapter';
