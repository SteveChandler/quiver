/**
 * Window Selector Module
 *
 * Selects the best surf window from forecast data using composite scoring.
 * Sunset-aware: caps windows at sunset and skips windows too close to dark.
 *
 * @module lib/services/discovery/window-selector
 */

// Re-export types
export type { WindowSelectorOptions,   } from './types';

// Re-export constants (for testing and advanced usage)
export {





  MIN_SESSION_HOURS,


  MAX_WINDOW_HOURS,
  FORECAST_WINDOW_DURATION_MINUTES,
  PAST_WINDOW_TOLERANCE_MINUTES,




} from './constants';

// Re-export direction utilities
export { getDirectionDegrees } from './direction-utils';

// Re-export time slot utilities
export {
  getLocalDateStr,



  getTimeSlotRange,
  getDawnPatrolRange,
  capEndTimeToTimeSlot,
  getLocalHour,
} from './time-slot-utils';

// Re-export tide boundary calculator

// Re-export peak finder

// Re-export window refiner

// Re-export window scorer
export {
  scoreForecastWindow,
  scoreWindowConditionDetails,
  scoreWindowConditionScore,
  scoreWindowWithComposite,
} from './window-scorer';

// Re-export scoring engine singleton

// Re-export main algorithm
export { selectBestWindow, selectBestWindows } from './window-selector-core';
