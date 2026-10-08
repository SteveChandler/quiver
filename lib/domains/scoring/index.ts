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
export { ScoringEngine } from './scoring-engine';

// Scorers
export { baseConditionsScorer } from './scorers/base-conditions-scorer';
export { swellAlignmentScorer } from './scorers/swell-alignment-scorer';
export { swellInterferenceScorer } from './scorers/swell-interference-scorer';
export { windQualityScorer } from './scorers/wind-quality-scorer';
export { tideFitScorer } from './scorers/tide-fit-scorer';
export { tideDirectionScorer } from './scorers/tide-direction-scorer';
export { detectSetupRisk, LOW_TIDE_HEAVY_SWELL_WARNING, setupRiskScorer } from './scorers/setup-risk-scorer';
export { windowStabilityScorer } from './scorers/window-stability-scorer';
export { trendPreferenceScorer } from './scorers/trend-preference-scorer';

// Condition character classifier (qualitative category + label)
export type {
  ConditionCharacter,
  ConditionCharacterCategory,
} from './condition-character';
export { getConditionCharacter } from './condition-character';

// Discovery adapter (backwards compatibility with surf-discovery-service)
export {
  createDiscoveryScoringEngine,
  discoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  compositeToDetailedScore,
  scoreBeachWithEngine,
  // Wave size scoring configuration and helper functions




} from './discovery-adapter';
