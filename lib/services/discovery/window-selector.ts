/**
 * Window Selector Service
 *
 * @deprecated Since 2026-01-25. This file has been refactored into the
 * window-selector/ module. The re-export will be removed in a future release.
 *
 * Migration: Update imports to use the new module structure:
 * ```typescript
 * // Before (deprecated)
 * import { selectBestWindow } from '@/lib/services/discovery/window-selector';
 *
 * // After (recommended)
 * import { selectBestWindow } from '@/lib/services/discovery/window-selector/window-selector-core';
 * // Or for types:
 * import type { CandidateWindow } from '@/lib/services/discovery/window-selector/types';
 * ```
 *
 * This file is maintained for backwards compatibility and re-exports all
 * public APIs from the new module structure.
 *
 * @see ./window-selector/ARCHITECTURE.md for module documentation
 * @module lib/services/discovery/window-selector
 */

// Re-export everything from the new module structure
export type { WindowSelectorOptions, CandidateWindow, ScoredForecast } from './window-selector/types';

export {
  // Constants (for testing and advanced usage)
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
} from './window-selector/constants';

export { parseWaveDirection, getDirectionDegrees } from './window-selector/direction-utils';

export {
  getLocalDateStr,
  getTimeSlotRange,
  getDawnPatrolRange,
  capEndTimeToTimeSlot,
  getLocalHour,
  isWithinTimeSlot,
} from './window-selector/time-slot-utils';

export { extractTideSchedule, calculateTideDrivenBoundaries } from './window-selector/tide-boundary-calculator';

export { findPeakWithinWindow } from './window-selector/peak-finder';

export { applySubHourRefinement } from './window-selector/window-refiner';

export { scoreForecastWindow, scoreWindowWithEngine } from './window-selector/window-scorer';

export { getScoringEngine, resetScoringEngine } from './window-selector/scoring-engine-singleton';

export { selectBestWindow } from './window-selector/window-selector-core';
