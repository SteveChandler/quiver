/**
 * Conditions Domain
 *
 * Interprets forecast data and analyzes trends for scoring.
 */

// Types
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
