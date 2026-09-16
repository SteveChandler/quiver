/**
 * Conditions Domain
 *
 * Interprets forecast data and analyzes trends for scoring.
 */

// Types
export type {
  SwellComponent,

  TideDirection,


  ConditionsSnapshot,

  ConditionsWindow,

} from './types';

export { CONDITIONS_CONSTANTS } from './types';

// Swell analysis
export {
  analyzeSwell,
  createSwellComponent,
  areSwellsAligned,
  areSwellsCrossing,
} from './swell-analyzer';

// Trend detection
export {
  analyzeConditionsWindow,
  detectTrend,
  computeVariance,
  isWindowImproving,
  isWindowDegrading,
  isWindowStable,
  describeWindowStability,
} from './trend-detector';

// Dominant partition picker (shared by forecast-builder + scoring snapshot)
export type {
  SwellPartition,
  SwellPartitions,


} from './dominant-swell';
export { pickDominantSwell,  } from './dominant-swell';
