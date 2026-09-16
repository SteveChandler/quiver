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




} from './types';


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
export {
  createDiscoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  compositeToDetailedScore,
  scoreBeachWithEngine,
  // Wave size scoring configuration and helper functions




} from './discovery-adapter';
