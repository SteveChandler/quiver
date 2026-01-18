/**
 * Discovery Services
 *
 * Barrel export for surf discovery related services.
 *
 * @module lib/services/discovery
 */

export {
  buildCandidatePool,
  type CandidatePoolOptions,
  type CandidatePoolResult,
} from './candidate-pool-builder';

export {
  batchFetchForecasts,
  DEFAULT_FORECAST_WINDOW_HOURS,
  type ForecastBatchOptions,
  type ForecastBatchResult,
} from './forecast-batch-fetcher';

export {
  selectBestWindow,
  capEndTimeToTimeSlot,
  scoreForecastWindow,
  type WindowSelectorOptions,
} from './window-selector';
