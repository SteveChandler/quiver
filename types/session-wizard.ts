/**
 * Session Wizard Type Definitions
 *
 * Type definitions for Session Wizard URL parameters and form state.
 */

/**
 * URL parameters for prefilling the Session Wizard
 * Used when navigating from "Log Session" CTAs
 *
 * @example
 * ```typescript
 * const params = new URLSearchParams({
 *   mode: 'log',
 *   beach: 'abc-123-def-456',
 *   beachName: 'Pacific Beach',
 *   startTime: '2025-11-22T06:00:00.000Z',
 *   endTime: '2025-11-22T10:00:00.000Z',
 *   step: '3',
 * });
 * router.push(`/sessions/new?${params.toString()}`);
 * ```
 */
export interface SessionWizardPrefillParams {
  /** Session mode: log-only */
  mode: 'log';

  /** Enable streamlined 2-step quick log flow */
  quick?: 'true' | 'false';

  /** Beach UUID from database */
  beach: string;

  /** Beach display name (for UI only, not trusted for DB operations) */
  beachName: string;

  /** Session start time (ISO 8601 format) */
  startTime?: string;

  /** Session end time (ISO 8601 format) */
  endTime?: string;

  /** Target wizard step (1-4, 1-indexed) */
  step: string;

  /** Forecast feedback context UUID captured before the session log CTA */
  forecastFeedbackId?: string;

  /** One-tap forecast verification value captured before session logging */
  forecastFeedbackValue?: 'too_low' | 'about_right' | 'too_high';

  /** Recommendation attribution id from surf discovery/home surfaces */
  recommendation_id?: string;

  /** Recommendation surface name used for attribution */
  recommendation_surface?: string;

  /** Recommendation rank on the source surface */
  recommendation_rank?: string;

  /** Recommendation score shown on the source surface */
  recommendation_score?: string;

  /** Recommendation source time slot */
  recommendation_time_slot?: string;

  /** Recommendation window start ISO timestamp */
  recommendation_window_start?: string;

  /** Recommendation window end ISO timestamp */
  recommendation_window_end?: string;
}

/**
 * Parsed and validated wizard prefill parameters
 * All fields are validated and safe to use
 */
export interface ValidatedSessionWizardParams {
  /** Validated session mode */
  mode: 'log';

  /** Whether quick log mode is enabled */
  quick: boolean;

  /** Validated beach UUID */
  beachId: string;

  /** Sanitized beach name (safe for display) */
  beachName: string;

  /** Parsed and validated start time, when provided by the source CTA */
  startTime?: Date;

  /** Parsed and validated end time, when provided by the source CTA */
  endTime?: Date;

  /** Validated wizard step number (1-4) */
  targetStep: number;

  /** Forecast feedback context UUID captured before the session log CTA */
  forecastFeedbackId?: string;

  /** One-tap forecast verification value captured before session logging */
  forecastFeedbackValue?: 'too_low' | 'about_right' | 'too_high';

  recommendationId?: string;
  recommendationSurface?: string;
  recommendationRank?: number;
  recommendationScore?: number;
  recommendationTimeSlot?: string;
  recommendationWindowStart?: Date;
  recommendationWindowEnd?: Date;
}
