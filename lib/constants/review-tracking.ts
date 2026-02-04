/**
 * Review Tracking Constants
 *
 * Centralized constants for review-related tracking and UI flows.
 * Ensures consistency across the application.
 */

/**
 * Valid sources that can trigger the review form
 */
export const REVIEW_TRACKING_SOURCES = {
  OVERVIEW_CTA: 'overview_cta',
  REVIEWS_TAB: 'reviews_tab',
  POST_SESSION: 'post_session',
} as const;

export type ReviewTrackingSource = typeof REVIEW_TRACKING_SOURCES[keyof typeof REVIEW_TRACKING_SOURCES];

/**
 * Timeout durations for review-related flows
 */
export const REVIEW_TIMEOUTS = {
  /** Auto-dismiss review prompt after this duration (60 seconds) */
  PROMPT_AUTO_DISMISS: 60000,

  /** Auto-dismiss forecast feedback after this duration (30 seconds) */
  FEEDBACK_AUTO_DISMISS: 30000,

  /** Celebration screen duration before redirect (5 seconds) */
  CELEBRATION_DURATION: 5000,
} as const;
