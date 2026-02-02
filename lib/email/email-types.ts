/**
 * Shared type definitions for email functionality.
 * Used by both email templates and email cron handlers.
 */

/**
 * Intel post data for email templates.
 */
export interface IntelPost {
  id: string;
  tag: string;
  description: string;
}

/**
 * Re-engagement email candidate returned by the RPC function.
 */
export interface ReengagementCandidate {
  user_id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string;
  beach_name: string;
  beach_slug: string;
  conditions_score: number;
  surf_description: string | null;
  wind_description: string | null;
  best_window_start: string | null;
  best_window_end: string | null;
  recommendation: string | null;
}
