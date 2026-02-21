/**
 * Personalization Milestone Definitions
 *
 * Typed dictionary of milestone events that mark key stages in the
 * personalization journey. Each milestone has a unique key, a trigger
 * description (for detection logic), and copy templates for notifications.
 *
 * Copy templates use `{placeholder}` syntax for runtime interpolation
 * via `getMilestoneCopy()` in `lib/utils/personalization-messaging.ts`.
 */

/**
 * All valid milestone keys
 */
export type MilestoneKey =
  | "first_session_logged"
  | "first_intel_posted"
  | "wave_range_learned"
  | "wind_pref_learned"
  | "time_slot_detected"
  | "home_turf_established"
  | "intel_confirmed_5x"
  | "local_authority"
  | "fully_personalized";

/**
 * Shape of a single milestone definition
 */
export interface MilestoneDefinition {
  /** Human-readable trigger description (for documentation, not runtime) */
  trigger: string;
  /** Notification title */
  title: string;
  /** Notification description — may contain `{placeholder}` tokens */
  description: string;
}

/**
 * Complete milestone definitions dictionary
 */
export const PERSONALIZATION_MILESTONES: Record<MilestoneKey, MilestoneDefinition> = {
  first_session_logged: {
    trigger: "1 rated session",
    title: "Personalization Activated",
    description:
      "Recommendations will start learning your style.",
  },
  first_intel_posted: {
    trigger: "1 intel post",
    title: "First Intel Posted",
    description:
      "You're helping your local lineup make better calls.",
  },
  wave_range_learned: {
    trigger: "wave_min_ft non-null",
    title: "Wave Sweet Spot Learned",
    description:
      "We've learned your wave sweet spot: {min}-{max}ft.",
  },
  wind_pref_learned: {
    trigger: "max_wind_mph non-null",
    title: "Wind Tolerance Dialed In",
    description:
      "Filtering for winds under {max}mph.",
  },
  time_slot_detected: {
    trigger: "Implicit time slot weight > 0.4",
    title: "Session Timing Detected",
    description:
      "Looks like you're a {timeSlot} surfer.",
  },
  home_turf_established: {
    trigger: "3+ top_engaged_beach_ids",
    title: "Go-To Breaks Identified",
    description:
      "Familiarity bonus is active.",
  },
  intel_confirmed_5x: {
    trigger: "5+ total confirmations",
    title: "Intel Making an Impact",
    description:
      "Your intel helped 5 surfers plan their session. Keep it up.",
  },
  local_authority: {
    trigger: "10+ intel posts at same beach",
    title: "Local Authority",
    description:
      "Local authority at {beach}. Your intel is trusted by the community.",
  },
  fully_personalized: {
    trigger: "All 3 layers, confidence > 0.7",
    title: "Fully Tuned",
    description:
      "Your forecasts reflect everything we've learned.",
  },
} as const;

