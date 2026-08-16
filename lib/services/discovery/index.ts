/**
 * Discovery Services
 *
 * Barrel export for surf discovery related services.
 *
 * @module lib/services/discovery
 */

// Orchestrator (main entry point)
export {
  discoverSurfSpots,
  getBatchSunTimes,
} from './surf-discovery-orchestrator';

// Candidate Pool Builder
export {
  buildCandidatePool,
  CANDIDATE_POOL_LIMIT,
  CANDIDATE_POOL_RADIUS_TIERS_MILES,
  MAX_CANDIDATE_RADIUS_MILES,
  MIN_CANDIDATES,
  type CandidatePoolOptions,
  type CandidatePoolResult,
} from './candidate-pool-builder';

// Pre-forecast preference fit used to order the candidate pool
export {
  effectiveDistanceMiles,
  preferenceFit,
  PREFERENCE_DETOUR_BUDGET_MILES,
  type PoolFitBeach,
  type PoolPreferenceProfile,
} from './candidate-pool-fit';

// Distance friction
export {
  calculateDistancePenalty,
  compareDiscoveryRecommendations,
  DISTANCE_FRICTION_HOME_ZONE_MILES,
  DISTANCE_FRICTION_MAX_PENALTY,
  DISTANCE_FRICTION_PENALTY_PER_MILE,
  DISTANCE_TIE_BREAKER_POINTS,
  WORTH_THE_DRIVE_DISTANCE_MILES,
  WORTH_THE_DRIVE_REASON,
} from './distance-friction';

// Forecast Batch Fetcher
export {
  batchFetchForecasts,
  DEFAULT_FORECAST_WINDOW_HOURS,
  type ForecastBatchOptions,
  type ForecastBatchResult,
} from './forecast-batch-fetcher';

// Window Selector
export {
  selectBestWindow,
  capEndTimeToTimeSlot,
  scoreForecastWindow,
  scoreWindowConditionDetails,
  scoreWindowConditionScore,
  type WindowSelectorOptions,
} from './window-selector';

// Response Formatter
export {
  enrichWithPhotos,
  generateDiscoverySummary,
  getRecommendationLabel,
  getRecommendationLabelGated,
  buildDiscoveryMessage,
  FALLBACK_IMAGE_BY_NAME,
} from './response-formatter';

// Personalization Layer (batch personalization, avoids N+1 per-beach queries)
export {
  fetchPersonalizationContext,
  calculatePersonalizationBonus,
  type PersonalizationContext,
  type PersonalizationBonusResult,
} from './personalization-layer';
