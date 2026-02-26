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
  type CandidatePoolOptions,
  type CandidatePoolResult,
} from './candidate-pool-builder';

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
  scoreWindowWithEngine,
  type WindowSelectorOptions,
} from './window-selector';

// Response Formatter
export {
  enrichWithPhotos,
  generateDiscoverySummary,
  getRecommendationLabel,
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
