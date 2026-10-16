/**
 * Window Selector Constants
 *
 * All magic numbers and configuration values for the window selector.
 *
 * @module lib/services/discovery/window-selector/constants
 */

// ============================================================================
// Time-priority window selection constants
// ============================================================================

/** Points deducted per hour in future */
export const TIME_DECAY_PER_HOUR = 1.0;

/** Cap decay at 24 hours (24 points max) */
export const MAX_TIME_DECAY_HOURS = 24;

// ============================================================================
// Start-soon bonuses for "surf now" prioritization
// ============================================================================

/** Bonus for windows starting within 2 hours */
export const SOON_BONUS_2HR = 8;

/** Bonus for windows starting within 4 hours */
export const SOON_BONUS_4HR = 4;

/** Bonus for windows already in progress */
export const UNDERWAY_BONUS = 4;

// ============================================================================
// Sunset-aware window constants
// ============================================================================

/** Minimum viable session length in hours */
export const MIN_SESSION_HOURS = 1.0;

/** Score below which conditions are "poor" (0-100 scale, displays as 5/10) */
export const MIN_SCORE_THRESHOLD = 50;

/** Lower threshold for today when it's morning (0-100 scale, displays as 4/10) */
export const MIN_SCORE_THRESHOLD_MORNING = 40;

/** Maximum window even with perfect conditions */
export const MAX_WINDOW_HOURS = 4;

// ============================================================================
// Forecast timing constants
// ============================================================================

/**
 * Duration of each forecast window in minutes.
 * Forecasts represent 30-minute prediction windows.
 */
export const FORECAST_WINDOW_DURATION_MINUTES = 30;

/**
 * Grace period for showing recently-ended windows (in minutes).
 * Allows users to see recommendations that just passed, improving UX
 * when they check conditions shortly after a good window ended.
 */
export const PAST_WINDOW_TOLERANCE_MINUTES = 15;

// ============================================================================
// Morning priority constants
// ============================================================================

/** Before noon, prefer today's forecasts */
export const MORNING_CUTOFF_HOUR = 12;

/** Bonus for today's forecasts during morning hours */
export const TODAY_BONUS_POINTS = 15;

/** Extra bonus for morning/afternoon times (before 5pm) */
export const MORNING_TIME_BONUS = 15;

/** 5pm - times after this don't get morning time bonus */
export const EVENING_CUTOFF_HOUR = 17;

// ============================================================================
// Recommendations V2 fallback thresholds
// ============================================================================

/** Minimum condition score for a surfable Recommendation V2 window. */
export const RECOMMENDATIONS_V2_MIN_CONDITION_SCORE = 65;

/** Minimum personal match score for a surfable Recommendation V2 window. */
export const RECOMMENDATIONS_V2_MIN_PERSONAL_MATCH_SCORE = 6.0;

/** Future fallback horizon when today is below the surfable thresholds. */
export const RECOMMENDATIONS_V2_FALLBACK_HORIZON_HOURS = 72;
