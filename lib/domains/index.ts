/**
 * Domains - Domain-Driven Scoring Architecture
 *
 * Re-exports all domain modules for convenient imports.
 *
 * @example
 * // Import specific items
 * import { createSpotProfile, ScoringEngine, analyzeSwell } from '@/lib/domains';
 *
 * // Or import from specific domains
 * import { createSpotProfile } from '@/lib/domains/spot-profile';
 * import { ScoringEngine } from '@/lib/domains/scoring';
 */

// Spot Profile Domain
export type {
  SpotProfile,
  SwellWindow,
  WindThresholds,
  TidePreferences,
  SkillLevel,
} from './spot-profile';

export {
  SPOT_PROFILE_DEFAULTS,
  createSpotProfile,
  angularDifference,
  isDirectionInWindow,
  calculateWindowAlignment,
} from './spot-profile';

// Conditions Domain
export type {
  SwellComponent,
  WindState,
  TideDirection,
  TideStatus,
  TideState,
  ConditionsSnapshot,
  TrendDirection,
  ConditionsWindow,
  SwellAnalysis,
} from './conditions';

export {
  CONDITIONS_CONSTANTS,
  analyzeSwell,
  createSwellComponent,
  areSwellsAligned,
  areSwellsCrossing,
  analyzeConditionsWindow,
  detectTrend,
  computeVariance,
  isWindowImproving,
  isWindowDegrading,
  isWindowStable,
  describeWindowStability,
} from './conditions';

// Scoring Domain
export type {
  ScorerInput,
  ScorerResult,
  ScorerPlugin,
  CompositeScore,
  MatchQuality,
  ScoringEngineConfig,
  DiscoveryScoringOptions,
} from './scoring';

export {
  SCORER_WEIGHTS,
  DEFAULT_SCORING_CONFIG,
  createSkipResult,
  createNeutralResult,
  ScoringEngine,
  createScoringEngine,
  scoreWithPlugins,
  baseConditionsScorer,
  swellAlignmentScorer,
  swellInterferenceScorer,
  windQualityScorer,
  tideFitScorer,
  windowStabilityScorer,
  trendPreferenceScorer,
  createDiscoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  compositeToDetailedScore,
  scoreBeachWithEngine,
} from './scoring';

// User Preferences Domain
export type {
  WaveSizePreference,
  CrowdPreference,
  OnboardingPreferences,
  LearnedPreferences,
  BeachAffinity,
  UserPreferences,
  PreferenceMatch,
} from './user-preferences';

export { WAVE_SIZE_RANGES, USER_PREFERENCES_DEFAULTS } from './user-preferences';

// Shared Utilities
export { normalizeAngle, angleDifference, directionName } from './shared';
