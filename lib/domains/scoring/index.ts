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
  createBaseConditionsScorer,
  swellAlignmentScorer,
  swellInterferenceScorer,
  windQualityScorer,
  tideFitScorer,
  tideDirectionScorer,
  windowStabilityScorer,
  trendPreferenceScorer,
} from './scorers';

// Discovery adapter (backwards compatibility with surf-discovery-service)
export type { DiscoveryScoringOptions } from './discovery-adapter';
export {
  createDiscoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  compositeToDetailedScore,
  scoreBeachWithEngine,
} from './discovery-adapter';
