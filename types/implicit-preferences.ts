/**
 * TypeScript Types for Implicit Preference Learning
 *
 * This module defines types for tracking user behavior and learning
 * implicit preferences from those interactions.
 *
 */

// =============================================================================
// Event Types
// =============================================================================

/**
 * Valid implicit event types that can be tracked
 */
export type ImplicitEventType =
  | 'beach_view'
  | 'discovery_click'
  | 'discovery_skip'
  | 'forecast_check'
  | 'location_update'
  // Engagement tracking events
  | 'page_view'
  | 'forecast_interaction'
  | 'session_action'
  | 'profile_update'
  | 'onboarding_step'
  | 'cta_click'
  // Review tracking events
  | 'review_form_open'
  | 'review_form_abandon'
  | 'review_validation_error'
  | 'review_submit'
  // Share tracking events
  | 'share_started'
  | 'share_completed'
  | 'share_link_copied'
  | 'share_image_saved'
  | 'cam_share'
  | 'share_intel_button_clicked'
  | 'share_intel_signin_prompt'
  | 'surf_plan_share'
  // Signup/auth conversion events
  | 'signup_cta_click'
  | 'signup_cta_view'
  | 'signin_cta_click'
  // Home screen events
  | 'home_at_beach_click'
  | 'home_plan_weekend_click'
  | 'home_plan_weekend_no_recommendation'
  // Session logging events
  | 'session_log_start'
  | 'session_log_submit'
  | 'session_share_opened_post_save'
  | 'session_share_closed_post_save'
  // Onboarding/tour events
  | 'product_tour_started'
  | 'product_tour_completed'
  | 'product_tour_skipped'
  | 'product_tour_step_viewed'
  // Beach detail events
  | 'beach_search'
  | 'forecast_tab_click'
  | 'horizon_strip_day_selected'
  | 'match_score_teaser_click'
  | 'match_score_teaser_view'
  | 'set_home_beach'
  | 'map_marker_click'
  // Intel events
  | 'local_intel_tab_viewed'
  | 'intel_post_created'
  | 'intel_post_confirmed'
  | 'plan_session_from_intel'
  // Profile events
  | 'surf_profile_viewed'
  | 'surf_profile_progress_shown'
  // Discovery events
  | 'personalized_score_shown'
  | 'favorite_shown_in_carousel'
  | 'mini_log_teaser_click'
  | 'plan_unlock_click'
  // Social events
  | 'social_follow'
  | 'social_like'
  | 'social_invite_send'
  | 'social_invite_respond'
  | 'social_intel_confirm'
  // Tab and map engagement events
  | 'tab_view'
  | 'map_interaction';

/**
 * Weight multipliers for each event type, determining how much
 * each interaction contributes to learned preferences
 */
export const EVENT_WEIGHTS: Record<ImplicitEventType, number> = {
  location_update: 10.0,
  discovery_click: 3.0,
  forecast_check: 2.5,
  beach_view: 0.5,
  discovery_skip: -1.0,
  // Engagement events (tracking only, no preference learning weight)
  page_view: 0,
  forecast_interaction: 0,
  session_action: 0,
  profile_update: 0,
  onboarding_step: 0,
  cta_click: 0,
  // Review tracking events
  review_form_open: 0,
  review_form_abandon: 0,
  review_validation_error: 0,
  review_submit: 0,
  // Share tracking events
  share_started: 0,
  share_completed: 0,
  share_link_copied: 0,
  share_image_saved: 0,
  cam_share: 0,
  share_intel_button_clicked: 0,
  share_intel_signin_prompt: 0,
  surf_plan_share: 0,
  // Signup/auth conversion events
  signup_cta_click: 0,
  signup_cta_view: 0,
  signin_cta_click: 0,
  // Home screen events
  home_at_beach_click: 0,
  home_plan_weekend_click: 0,
  home_plan_weekend_no_recommendation: 0,
  // Session logging events
  session_log_start: 0,
  session_log_submit: 0,
  session_share_opened_post_save: 0,
  session_share_closed_post_save: 0,
  // Onboarding/tour events
  product_tour_started: 0,
  product_tour_completed: 0,
  product_tour_skipped: 0,
  product_tour_step_viewed: 0,
  // Beach detail events
  beach_search: 0,
  forecast_tab_click: 0,
  horizon_strip_day_selected: 0,
  match_score_teaser_click: 0,
  match_score_teaser_view: 0,
  set_home_beach: 0,
  map_marker_click: 0,
  // Intel events
  local_intel_tab_viewed: 0,
  intel_post_created: 0,
  intel_post_confirmed: 0,
  plan_session_from_intel: 0,
  // Profile events
  surf_profile_viewed: 0,
  surf_profile_progress_shown: 0,
  // Discovery events
  personalized_score_shown: 0,
  favorite_shown_in_carousel: 0,
  mini_log_teaser_click: 0,
  plan_unlock_click: 0,
  // Social events
  social_follow: 0,
  social_like: 0,
  social_invite_send: 0,
  social_invite_respond: 0,
  social_intel_confirm: 0,
  // Tab and map engagement events
  tab_view: 0,
  map_interaction: 0,
} as const;

// -----------------------------------------------------------------------------
// Event Metadata Interfaces
// -----------------------------------------------------------------------------

/**
 * Metadata for beach_view events
 */
export interface BeachViewMetadata {
  /** How long the user viewed the beach detail page */
  duration_ms?: number;
  /** Where the user came from (discovery, search, direct, etc.) */
  referrer?: string;
  /** Whether the user viewed forecast data */
  forecast_viewed?: boolean;
}

/**
 * Metadata for discovery_click events
 */
export interface DiscoveryClickMetadata {
  /** Position in the discovery list (0-indexed) */
  position: number;
  /** The personalization score shown to the user */
  score_shown: number;
  /** How many alternatives were available */
  alternatives_count: number;
}

/**
 * Metadata for discovery_skip events (when user scrolls past a recommendation)
 */
export interface DiscoverySkipMetadata {
  /** Position in the discovery list (0-indexed) */
  position: number;
  /** The personalization score of the skipped beach */
  score_shown: number;
  /** ID of the beach the user chose instead (if any) */
  chosen_beach_id?: string;
}

/**
 * Metadata for forecast_check events
 */
export interface ForecastCheckMetadata {
  /** Time slot the user was checking (dawn-patrol, morning, etc.) */
  time_slot?: string;
  /** Summary of conditions at time of check */
  conditions_summary?: string;
}

/**
 * Metadata for location_update events
 */
export interface LocationUpdateMetadata {
  /** User's latitude */
  lat: number;
  /** User's longitude */
  lon: number;
  /** GPS accuracy in meters */
  accuracy_m?: number;
}

// -----------------------------------------------------------------------------
// Engagement Tracking Metadata Interfaces
// -----------------------------------------------------------------------------

/**
 * Metadata for page_view events
 */
export interface PageViewMetadata {
  /** Page identifier (home, discover, beach, profile, etc.) */
  page: string;
  /** Previous page URL or path */
  referrer?: string;
  /** Browser session identifier for grouping page views (tab-scoped, distinct from DB session_id column) */
  browser_session_id?: string;
}

/**
 * Metadata for forecast_interaction events
 */
export interface ForecastInteractionMetadata {
  /** Type of interaction */
  action: 'change_slot' | 'expand' | 'view_extended' | 'view_details';
  /** Time slot selected (if action is change_slot) */
  slot?: string;
  /** Beach ID being interacted with */
  beach_id?: string;
}

/**
 * Metadata for session_action events
 */
export interface SessionActionMetadata {
  /** Type of session action */
  action: 'start' | 'complete' | 'cancel';
  /** Session ID if completing or canceling */
  session_id?: string;
  /** Beach where session was logged */
  beach_id?: string;
}

/**
 * Metadata for profile_update events
 */
export interface ProfileUpdateMetadata {
  /** Field that was updated */
  field: 'home_beach' | 'experience' | 'preferences' | 'board' | 'avatar' | 'name' | 'other';
}

/**
 * Metadata for onboarding_step events
 */
export interface OnboardingStepMetadata {
  /** Step number (1-4) */
  step: number;
  /** Human-readable step name */
  step_name: string;
  /** Whether the step was completed or skipped */
  completed?: boolean;
}

/**
 * Metadata for cta_click events
 */
export interface CTAClickMetadata {
  /** CTA identifier */
  cta: 'log_session' | 'view_forecast' | 'share' | 'view_beach' | 'check_conditions' | 'other';
  /** Where the CTA was located */
  location: string;
}

// -----------------------------------------------------------------------------
// Review Tracking Metadata Interfaces
// -----------------------------------------------------------------------------

/**
 * Valid sources that can trigger the review form
 * @see lib/constants/review-tracking.ts for centralized constants
 */
export type ReviewTrackingSource = 'overview_cta' | 'reviews_tab' | 'post_session';

/**
 * Metadata for review form tracking events
 */
export interface ReviewFormMetadata {
  /** Source that opened the review form */
  source: ReviewTrackingSource;
  /** Beach ID being reviewed */
  beach_id: string;
  /** Beach name for display/debugging */
  beach_name?: string;
  /** Duration in milliseconds (for abandon events) */
  duration_ms?: number;
  /** Validation error type (for validation_error events) */
  error_type?: 'missing_ratings' | 'missing_content';
  /** Whether user was editing an existing review */
  is_edit?: boolean;
}

// -----------------------------------------------------------------------------
// Tab and Map Engagement Metadata Interfaces
// -----------------------------------------------------------------------------

/** Metadata for tab_view events */
export interface TabViewMetadata {
  /** Tab that was switched to */
  tab: string;
  /** Tab that was switched from */
  previous_tab: string;
  /** Time spent on the previous tab in milliseconds */
  time_on_previous_ms: number;
}

/** Metadata for map_interaction events */
export interface MapInteractionMetadata {
  /** Type of map interaction */
  action: 'pin_click' | 'zoom' | 'filter_change' | 'pan';
  /** Beach ID if interacting with a specific beach */
  beach_id?: string;
  /** Current zoom level */
  zoom_level?: number;
  /** Filter value if changing filters */
  filter?: string;
}

// -----------------------------------------------------------------------------
// Social Tracking Metadata Interfaces
// -----------------------------------------------------------------------------

/** Metadata for social_follow events */
export interface SocialFollowMetadata {
  /** ID of the user being followed/unfollowed */
  target_user_id: string;
  /** Whether this is a follow or unfollow action */
  action: 'follow' | 'unfollow';
}

/** Metadata for social_like events */
export interface SocialLikeMetadata {
  /** ID of the session being liked/unliked */
  session_id: string;
  /** Whether this is a like or unlike action */
  action: 'like' | 'unlike';
}

/** Metadata for social_share events */
export interface SocialShareMetadata {
  /** Type of content being shared */
  content_type: 'session' | 'wave' | 'surf_call' | 'cam' | 'page';
  /** Method of sharing */
  method?: 'native_share' | 'clipboard' | 'download';
}

/** Metadata for social_invite_send events */
export interface SocialInviteSendMetadata {
  /** Session ID the invite is for */
  session_id: string;
  /** Number of invitees */
  invitee_count: number;
}

/** Metadata for social_invite_respond events */
export interface SocialInviteRespondMetadata {
  /** Invitation ID */
  invitation_id: string;
  /** Response action */
  action: 'accepted' | 'declined';
}

/** Metadata for social_intel_confirm events */
export interface SocialIntelConfirmMetadata {
  /** Intel post ID */
  post_id: string;
  /** Whether confirming or removing confirmation */
  action: 'confirm' | 'unconfirm';
}

/**
 * Union type of all possible event metadata
 */
export type EventMetadata =
  | BeachViewMetadata
  | DiscoveryClickMetadata
  | DiscoverySkipMetadata
  | ForecastCheckMetadata
  | LocationUpdateMetadata
  | PageViewMetadata
  | ForecastInteractionMetadata
  | SessionActionMetadata
  | ProfileUpdateMetadata
  | OnboardingStepMetadata
  | CTAClickMetadata
  | ReviewFormMetadata
  | SocialFollowMetadata
  | SocialLikeMetadata
  | SocialShareMetadata
  | SocialInviteSendMetadata
  | SocialInviteRespondMetadata
  | SocialIntelConfirmMetadata
  | TabViewMetadata
  | MapInteractionMetadata;

/**
 * Full user event record as stored in the database
 */
export interface UserEvent {
  id: string;
  user_id: string | null;
  event_type: ImplicitEventType;
  beach_id: string | null;
  metadata: EventMetadata;
  created_at: string;
  expires_at: string;
  session_id?: string | null;
}

// =============================================================================
// Implicit Preferences Types
// =============================================================================

/**
 * Valid break types for implicit preference learning
 */
export type ValidBreakType = 'beach' | 'point' | 'reef';

/**
 * Valid time slots for implicit preference learning
 */
export type ValidTimeSlot = 'dawn-patrol' | 'morning' | 'afternoon' | 'evening';

/**
 * Learned weights for different break types
 * Strict type definition - only valid break types allowed
 */
export interface BreakTypeWeights {
  beach?: number;
  point?: number;
  reef?: number;
}

/**
 * Learned weights for different time slots
 * Strict type definition - only valid time slots allowed
 */
export interface TimeSlotWeights {
  'dawn-patrol'?: number;
  morning?: number;
  afternoon?: number;
  evening?: number;
}

/**
 * Full implicit preferences record as stored in the database
 */
export interface UserImplicitPreferences {
  user_id: string;
  inferred_wave_min_ft: number | null;
  inferred_wave_max_ft: number | null;
  break_type_weights: BreakTypeWeights;
  time_slot_weights: TimeSlotWeights;
  location_centroid_lat: number | null;
  location_centroid_lon: number | null;
  typical_travel_radius_miles: number | null;
  top_engaged_beach_ids: string[];
  confidence: number;
  event_count: number;
  last_computed_at: string;
  computed_from: string | null;
  computed_to: string | null;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Request body for tracking an implicit event
 */
export interface TrackEventRequest {
  eventType: ImplicitEventType;
  beachId?: string;
  metadata?: EventMetadata;
  viewportWidth?: number;
  sessionId?: string;
}

/**
 * Response from tracking an implicit event
 */
export interface TrackEventResponse {
  ok: boolean;
  /** Set when tracking is disabled (e.g., user opted out) */
  status?: 'tracking_disabled';
}

// =============================================================================
// Scoring & Personalization Types
// =============================================================================

/**
 * Reason why a beach matched the user's preferences
 */
export interface MatchReason {
  /** Category of the match reason */
  type: 'learned' | 'implicit' | 'onboarding' | 'affinity';
  /** Human-readable label */
  label: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extended scoring breakdown including implicit learning components
 */
export interface ExtendedScoringBreakdown {
  /** Base score from conditions/forecast */
  base: number;
  /** Score contribution from onboarding preferences */
  onboarding: number;
  /** Score contribution from explicitly learned preferences */
  learned: number;
  /** Score contribution from implicit behavior tracking */
  implicit: number;
  /** Final affinity score combining all factors */
  affinity: number;
}

/**
 * Source of personalization data used in scoring
 */
export type PersonalizationSource = 'explicit' | 'implicit' | 'blended' | 'none';

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if metadata is BeachViewMetadata
 */
export function isBeachViewMetadata(
  metadata: EventMetadata | null
): metadata is BeachViewMetadata {
  if (!metadata) return false;
  return (
    'duration_ms' in metadata ||
    'referrer' in metadata ||
    'forecast_viewed' in metadata
  );
}

/**
 * Type guard to check if metadata is DiscoveryClickMetadata
 */
export function isDiscoveryClickMetadata(
  metadata: EventMetadata | null
): metadata is DiscoveryClickMetadata {
  if (!metadata) return false;
  return (
    'position' in metadata &&
    'score_shown' in metadata &&
    'alternatives_count' in metadata
  );
}

/**
 * Type guard to check if metadata is DiscoverySkipMetadata
 */
export function isDiscoverySkipMetadata(
  metadata: EventMetadata | null
): metadata is DiscoverySkipMetadata {
  if (!metadata) return false;
  return (
    'position' in metadata &&
    'score_shown' in metadata &&
    !('alternatives_count' in metadata)
  );
}

/**
 * Type guard to check if metadata is ForecastCheckMetadata
 */
export function isForecastCheckMetadata(
  metadata: EventMetadata | null
): metadata is ForecastCheckMetadata {
  if (!metadata) return false;
  return 'time_slot' in metadata || 'conditions_summary' in metadata;
}

/**
 * Type guard to check if metadata is LocationUpdateMetadata
 */
export function isLocationUpdateMetadata(
  metadata: EventMetadata | null
): metadata is LocationUpdateMetadata {
  if (!metadata) return false;
  return 'lat' in metadata && 'lon' in metadata;
}

/**
 * Type guard to check if metadata is ReviewFormMetadata
 */
export function isReviewFormMetadata(
  metadata: EventMetadata | null
): metadata is ReviewFormMetadata {
  if (!metadata) return false;
  return (
    'source' in metadata &&
    'beach_id' in metadata &&
    typeof (metadata as ReviewFormMetadata).source === 'string' &&
    ['overview_cta', 'reviews_tab', 'post_session'].includes(
      (metadata as ReviewFormMetadata).source
    )
  );
}

/**
 * Validates that an event type is a valid ImplicitEventType
 */
export function isValidEventType(type: string): type is ImplicitEventType {
  return type in EVENT_WEIGHTS;
}
