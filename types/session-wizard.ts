/**
 * Session Wizard Type Definitions
 *
 * Type definitions for Session Wizard URL parameters and form state.
 */

/**
 * URL parameters for prefilling the Session Wizard
 * Used when navigating from "Plan Session" CTAs
 *
 * @example
 * ```typescript
 * const params = new URLSearchParams({
 *   mode: 'plan',
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
  /** Session mode: 'plan' or 'log' */
  mode: 'plan' | 'log';

  /** Enable streamlined 2-step quick log flow */
  quick?: 'true' | 'false';

  /** Beach UUID from database */
  beach: string;

  /** Beach display name (for UI only, not trusted for DB operations) */
  beachName: string;

  /** Session start time (ISO 8601 format) */
  startTime: string;

  /** Session end time (ISO 8601 format) */
  endTime: string;

  /** Target wizard step (1-4, 1-indexed) */
  step: string;
}

/**
 * Parsed and validated wizard prefill parameters
 * All fields are validated and safe to use
 */
export interface ValidatedSessionWizardParams {
  /** Validated session mode */
  mode: 'plan' | 'log';

  /** Whether quick log mode is enabled */
  quick: boolean;

  /** Validated beach UUID */
  beachId: string;

  /** Sanitized beach name (safe for display) */
  beachName: string;

  /** Parsed and validated start time */
  startTime: Date;

  /** Parsed and validated end time */
  endTime: Date;

  /** Validated wizard step number (1-4) */
  targetStep: number;
}
