/**
 * Window Selector Module
 *
 * Selects the best surf window from forecast data using composite scoring.
 * Sunset-aware: caps windows at sunset and skips windows too close to dark.
 *
 * @module lib/services/discovery/window-selector
 */

// Re-export types
export type { WindowSelectorOptions, CandidateWindow, ScoredForecast } from './types';

// Re-export constants (for testing and advanced usage)
export {
  TIME_DECAY_PER_HOUR,
  MAX_TIME_DECAY_HOURS,
  SOON_BONUS_2HR,
  SOON_BONUS_4HR,
  UNDERWAY_BONUS,
  MIN_SESSION_HOURS,
  MIN_SCORE_THRESHOLD,
  MIN_SCORE_THRESHOLD_MORNING,
  MAX_WINDOW_HOURS,
  FORECAST_WINDOW_DURATION_MINUTES,
  PAST_WINDOW_TOLERANCE_MINUTES,
  MORNING_CUTOFF_HOUR,
  TODAY_BONUS_POINTS,
  MORNING_TIME_BONUS,
  EVENING_CUTOFF_HOUR,
} from './constants';

// Re-export direction utilities
export { getDirectionDegrees } from './direction-utils';

// Re-export time slot utilities
export {
  getLocalDateStr,
  getLocalDateFormatter,
  getLocalHourFormatter,
  getLocalTimeLabelFormatter,
  getTimeSlotRange,
  getDawnPatrolRange,
  capEndTimeToTimeSlot,
  getLocalHour,
} from './time-slot-utils';

// Re-export tide boundary calculator
export { extractTideSchedule, calculateTideDrivenBoundaries } from './tide-boundary-calculator';

// Re-export peak finder
export { findPeakWithinWindow } from './peak-finder';

// Re-export window refiner
export { applySubHourRefinement } from './window-refiner';

// Re-export window scorer
export {
  scoreForecastWindow,
  scoreWindowConditionDetails,
  scoreWindowConditionScore,
  scoreWindowWithComposite,
} from './window-scorer';

// Re-export scoring engine singleton
export { getScoringEngine } from './scoring-engine-singleton';

// Re-export main algorithm
export { selectBestWindow, selectBestWindows } from './window-selector-core';
