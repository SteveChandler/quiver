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
interface MilestoneDefinition {
  /** Human-readable trigger description (for documentation, not runtime) */
  trigger: string;
  /** Notification title */
  title: string;
  /** Notification description — may contain `{placeholder}` tokens */
  description: string;
}

