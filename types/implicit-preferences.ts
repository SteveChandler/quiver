/**
 * TypeScript Types for Implicit Preference Learning
 *
 * This module defines types for tracking user behavior and learning
 * implicit preferences from those interactions.
 *
 */

import type {
  BfrWebEventMetadataMap,
  EventType,
} from '@/lib/analytics/event-taxonomy';

// =============================================================================
// Event Types
// =============================================================================

/**
 * Valid implicit event types that can be tracked
 */
export type ImplicitEventType = EventType;

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
  share_link_opened: 0,
  share_link_copied: 0,
  share_image_saved: 0,
  share_sheet_blocked_pending: 0,
  cam_share: 0,
  share_intel_button_clicked: 0,
  share_intel_signin_prompt: 0,
  surf_plan_share: 0,
  invite_link_opened: 0,
  invite_open_app_clicked: 0,
  invite_app_store_clicked: 0,
  invite_continue_web_clicked: 0,
  invite_consumed: 0,
  // Signup/auth conversion events
  signup_cta_click: 0,
  signup_cta_view: 0,
  signin_cta_click: 0,
  signed_in: 0,
  auth_failed: 0,
  // Auth funnel events (fire before user is authenticated)
  auth_modal_opened: 0,
  auth_modal_closed_without_action: 0,
  auth_method_selected: 0,
  auth_provider_selected: 0,
  signup_started: 0,
  signup_success: 0,
  login_success: 0,
  login_failed: 0,
  signup_failed: 0,
  signup_form_submitted: 0,
  login_form_submitted: 0,
  native_app_first_open: 0,
  native_install_attribution_joined: 0,
  // Home screen events
  home_viewed: 0,
  home_at_beach_click: 0,
  home_plan_weekend_click: 0,
  home_plan_weekend_no_recommendation: 0,
  home_beach_forecast_viewed: 0,
  home_first_session_cta_tap: 0,
  home_hero_forecast_viewed: 0,
  home_locked_best_spot_teaser_tap: 0,
  home_map_tap: 0,
  home_menu_tap: 0,
  home_nearby_spot_tap: 0,
  home_notifications_tap: 0,
  home_search_tap: 0,
  home_set_alarm_tap: 0,
  home_surf_call_tap: 0,
  home_timeline_tap: 0,
  // Session logging events
  session_log_start: 0,
  session_log_form_view: 0,
  session_log_draft_opened: 0,
  session_log_time_selected: 0,
  session_log_draft_progress: 0,
  session_log_submit: 0,
  session_created: 0,
  session_share_opened_post_save: 0,
  session_share_closed_post_save: 0,
  // Onboarding/tour events
  product_tour_started: 0,
  product_tour_completed: 0,
  product_tour_skipped: 0,
  product_tour_step_viewed: 0,
  onboarding_started: 0,
  onboarding_intro_get_started: 0,
  onboarding_step_viewed: 0,
  onboarding_step_completed: 0,
  onboarding_step_auto_skipped: 0,
  onboarding_video_started: 0,
  onboarding_video_completed: 0,
  onboarding_video_skipped: 0,
  onboarding_completed: 0,
  location_permission_granted: 0,
  location_permission_denied: 0,
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
  learning_signal: 0,
  learning_progress_revealed: 0,
  learned_me_moment_viewed: 0,
  // Discovery events
  recommendation_impression: 0,
  personalized_score_shown: 0,
  favorite_shown_in_carousel: 0,
  mini_log_teaser_click: 0,
  plan_unlock_click: 0,
  discover_page_view: 0,
  discover_suggested_users_impression: 0,
  discover_profile_open: 0,
  discover_follow_attempt: 0,
  // Social events
  social_follow: 0,
  social_like: 0,
  social_invite_send: 0,
  social_invite_respond: 0,
  social_intel_confirm: 0,
  // Tab and map engagement events
  tab_view: 0,
  map_interaction: 0,
  map_marker_tapped: 0,
  map_viewed: 0,
  // Map engagement
  map_ready: 0,
  map_load_failed: 0,
  // Forecast reliability
  forecast_ready: 0,
  // Session Intelligence measurement events
  surf_window_impression: 0,
  surf_window_click: 0,
  why_this_call_opened: 0,
  app_deeplink_clicked: 0,
  deeplink_received: 0,
  spot_resolve: 0,
  session_prefill_shown: 0,
  session_silent_submit: 0,
  forecast_accuracy_table_viewed: 0,
  save_alert_clicked: 0,
  seo_intent_page_window_clicked: 0,
  free_growth_education_impression: 0,
  free_growth_education_cta_tapped: 0,
  watch_spot_tapped: 0,
  alert_rule_created: 0,
  // Session log funnel
  session_log_beach_selected: 0,
  session_log_conditions_set: 0,
  session_log_rating_set: 0,
  session_log_photo_added: 0,
  session_photo_upload_started: 0,
  session_photo_upload_succeeded: 0,
  session_photo_upload_failed: 0,
  session_log_abandon: 0,
  session_log_validation_failed: 0,
  session_spot_search_no_results: 0,
  session_custom_spot_cta_tapped: 0,
  session_custom_spot_returned: 0,
  // Phase 21 native board management events
  board_form_saved: 0,
  session_board_fit_feedback_selected: 0,
  // Phase 22 native forecast/custom-spot funnel events
  custom_spot_save_confirmation_viewed: 0,
  custom_spot_forecast_source_viewed: 0,
  forecast_visual_layer_selected: 0,
  synced_forecast_time_selected: 0,
  // Search
  beach_search_result_click: 0,
  // Growth markers
  acquisition_source_self_reported: 0,
  apple_orphan_precheck_indeterminate: 0,
  apple_orphan_prevented: 0,
  apple_orphan_recovery_flagged: 0,
  first_beach_view_post_signup: 0,
  first_session_logged: 0,
  // Empty states & impressions
  empty_state_shown: 0,
  cta_impression: 0,
  // Reliability
  client_error: 0,
  // Engagement depth (anon + auth)
  scroll_depth: 0,
  time_on_page: 0,
  // Phase 2 match-feature events (authenticated only)
  match_card_rendered: 0,
  match_strip_tap: 0,
  for_you_tap: 0,
  unlock_toast_shown: 0,
  session_decomposition_selected: 0,
  match_alert_toggle: 0,
  // Roadmap events (added 2026-04-25)
  feedback_roadmap_opened: 0,
  feedback_roadmap_request_created: 0,
  feedback_roadmap_viewed: 0,
  feedback_roadmap_vote_submitted: 0,
  roadmap_vote_cast: 0,
  roadmap_item_submitted: 0,
  roadmap_item_status_changed: 0,
  custom_spots_feedback_viewed: 0,
  custom_spots_feedback_voted: 0,
  missing_spot_prompt_viewed: 0,
  missing_spot_prompt_tapped: 0,
  custom_spot_create_started: 0,
  custom_spot_saved: 0,
  custom_spot_failed: 0,
  // Anon alert capture events (added 2026-04-26) — funnel tracking only, no preference weight
  anon_alert_capture_view: 0,
  anon_alert_capture_submit: 0,
  anon_alert_capture_error: 0,
  anon_alert_magic_link_clicked: 0,
  anon_alert_signup_success: 0,
  // Paywall + trial funnel (added 2026-05-02) — funnel tracking only, no preference weight
  paywall_opened: 0,
  paywall_dismissed: 0,
  paywall_purchase_started: 0,
  paywall_purchase_success: 0,
  paywall_purchase_failed: 0,
  paywall_ready: 0,
  paywall_plan_selected: 0,
  paywall_cadence_selected: 0,
  paywall_restore_started: 0,
  paywall_restore_success: 0,
  paywall_restore_failed: 0,
  paywall_trial_cta_tapped: 0,
  paywall_lifetime_cta_tapped: 0,
  paywall_soft_prompt_shown: 0,
  founder_100_popup_viewed: 0,
  founder_100_popup_cta_tapped: 0,
  founder_100_popup_dismissed: 0,
  onboarding_paywall_skipped: 0,
  onboarding_trial_started: 0,
  trial_active: 0,
  trial_entitlement_received: 0,
  push_permission_denied: 0,
  push_token_fetch_failed: 0,
  push_device_registration_failed: 0,
  push_device_registered: 0,
  apple_beta_prompt_eligible: 0,
  apple_beta_prompt_viewed: 0,
  apple_beta_prompt_qr_rendered: 0,
  apple_beta_prompt_open_testflight_clicked: 0,
  apple_beta_prompt_copy_link_clicked: 0,
  apple_beta_prompt_dismissed: 0,
  // App-first landing handoff funnel - tracking only, no preference weight
  app_handoff_view: 0,
  app_handoff_qr_rendered: 0,
  app_handoff_email_submit: 0,
  app_handoff_email_sent: 0,
  app_handoff_email_failed: 0,
  app_handoff_link_opened: 0,
  app_handoff_native_open: 0,
  watched_call_context_resolved: 0,
  android_lead_captured: 0,
  beach_follow_started: 0,
  beach_follow_saved_local: 0,
  beach_follow_sync_started: 0,
  beach_follow_sync_completed: 0,
  follow_topic_changed: 0,
  visitor_intent_selected: 0,
  surf_intent_qualified: 0,
  my_coast_viewed: 0,
  my_coast_beach_opened: 0,
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
  alternatives_count?: number;
  /** The action taken (e.g., 'plan_session', 'view_beach') */
  action?: string;
  /** Quality of the match (e.g., 'perfect', 'good', 'fair') */
  match_quality?: string;
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
  /** Full pathname for landing page attribution */
  pathname?: string;
  /** Canonical product/acquisition surface (landing-page, map, beach-detail, etc.) */
  surface?: string;
  /** Normalized source group used for funnel reporting */
  source_group?: string;
  /** Web/native platform for analytics segmentation */
  platform?: 'web';
  /** First-touch device platform inferred from the browser user agent */
  first_touch_platform?: 'ios' | 'android' | 'desktop';
  /** First landing page captured by attribution cookies */
  first_touch_landing_page?: string;
  /** First referrer captured by attribution cookies */
  first_touch_referrer?: string;
  /** Cam funnel family for /cams and /surf-cams routes */
  cam_family?: 'cams-directory' | 'surf-cams-seo';
  /** Previous internal pathname, separate from PostHog's built-in referrer fields */
  previous_pathname?: string;
  /** Browser session identifier for grouping page views (tab-scoped, distinct from DB session_id column) */
  browser_session_id?: string;
  /** Opaque UUID from a low-friction session share link. */
  share_id?: string;
  /** Safe UTM attribution fields preserved from share URLs. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/** Metadata for share_link_opened events */
export interface ShareLinkOpenedMetadata {
  share_id: string;
  session_id: string;
  pathname?: string;
  previous_pathname?: string;
  browser_session_id?: string;
  source?: 'initial' | 'event' | 'web_page_tracker';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export type InviteDestinationType =
  | 'app_store'
  | 'app_scheme'
  | 'web_signup'
  | 'android_waitlist';

export type InvitePlatform = 'ios' | 'android' | 'desktop' | 'web';

export interface InviteEventMetadata {
  token_hash: string;
  inviter_id: string;
  surface: 'invite_landing' | 'web' | 'native';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  browser_session_id?: string;
  platform?: InvitePlatform;
  destination_type?: InviteDestinationType;
  follow_created?: boolean;
  follow_existing?: boolean;
  referral_created?: boolean;
  referral_existing?: boolean;
  self_invite?: boolean;
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
  field?: 'home_beach' | 'experience' | 'preferences' | 'board' | 'avatar' | 'name' | 'other';
  /** List of fields that changed */
  fields_changed?: string[];
  /** Whether the email address was changed */
  email_changed?: boolean;
}

/**
 * Metadata for onboarding_step events
 *
 * NOTE: this metadata shape is shared between three kinds of events that all
 * reuse the 'onboarding_step' event type:
 *   1. Step transitions (step: 'home_beach' | 'level_and_time' | 'payoff' | 'completed')
 *   2. Dialog lifecycle events (step: 'dialog_opened' | 'auto_closed' | 'maybe_later_clicked' | 'save_failed')
 *   3. Server-confirmed events from onboarding-actions.ts (step: 'completed' | 'skipped' with source: 'server')
 *
 * They all reuse 'onboarding_step' because the user_events CHECK constraint
 * doesn't include dedicated event types for each variant. Distinguish them
 * via metadata.step. See project_onboarding_payoff_step_bug.md and
 * project_server_analytics_noop.md for context.
 */
export interface OnboardingStepMetadata {
  /** Named step identifier (not numeric) */
  step: string;
  /** Human-readable step name */
  step_name?: string;
  /** Whether the step was completed or skipped */
  completed?: boolean;
  /** Direction of step transition */
  direction?: 'forward' | 'back' | 'skip';
  /** Time spent on the step in milliseconds */
  time_on_step_ms?: number;

  // -- Dialog lifecycle fields (added for Fix 6 / dialog instrumentation) --

  /** The step the user was on when they tapped "Maybe later" (e.g., 'home_beach') */
  source_step?: string;
  /** The origin of the event — 'server' for onboarding-actions-inserted rows */
  source?: 'client' | 'server';
  /** Numeric current step index, for auto_closed events */
  current_step?: number;
  /** Human-readable current step name, for auto_closed events */
  current_step_name?: string;
  /** Failure reason, for save_failed events */
  reason?: string;

  // -- Server-confirmed completion fields (added for Fix 3 / server-side telemetry) --

  /** Whether the user set a home beach during this completion */
  has_home_beach?: boolean;
  /** The experience level the user selected, if any */
  experience_level?: string | null;
  /** The time-of-day preference the user selected, if any */
  preferred_time?: string | null;
  /** Number of surf styles the user selected */
  surf_styles_count?: number;
  /** Whether push notifications were enabled */
  push_enabled?: boolean;
  /** Whether email notifications were enabled */
  email_enabled?: boolean;

  // -- Geolocation instrumentation (Workstream W5 / 2026-04-29) --

  /**
   * Geolocation permission outcome on HomeBeachStep mount. Lets us quantify
   * how many users hit the auto-prompted nearby list vs. fall back to
   * search-first. Emitted with step='home_beach_geolocation'.
   */
  geolocation_state?: 'pending' | 'granted' | 'denied' | 'unavailable';
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
  /** How the form was abandoned (for abandon events only) */
  abandon_via?: 'cancel_button' | 'unmount';
  /** Count of rating categories the user filled in (0-5) — for abandon events */
  stars_filled?: number;
  /** Length of the title field at time of event — for abandon events */
  title_length?: number;
  /** Length of the content field at time of event — for abandon events */
  content_length?: number;
  /** The deepest field the user engaged with before leaving — for abandon events */
  max_field_touched?: 'none' | 'rating' | 'title' | 'content' | 'date';
}

// -----------------------------------------------------------------------------
// Tab and Map Engagement Metadata Interfaces
// -----------------------------------------------------------------------------

/** Metadata for tab_view events */
export interface TabViewMetadata {
  /** Tab that was switched to */
  tab: string;
  /** Tab that was switched from */
  previous_tab?: string;
  /** Time spent on the previous tab in milliseconds */
  time_on_previous_ms?: number;
  /** Source of the tab switch (e.g., 'bottom_nav') */
  source?: string;
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
  /** Map center latitude (rounded to 4 decimals) */
  latitude?: number;
  /** Map center longitude (rounded to 4 decimals) */
  longitude?: number;
  /** Viewport west bound */
  bounds_west?: number;
  /** Viewport south bound */
  bounds_south?: number;
  /** Viewport east bound */
  bounds_east?: number;
  /** Viewport north bound */
  bounds_north?: number;
  /** Count of beach markers currently visible in the viewport */
  beaches_in_viewport?: number;
  /** Count of cluster markers currently visible in the viewport */
  visible_cluster_count?: number;
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

// -----------------------------------------------------------------------------
// Auth Tracking Metadata Interfaces
// -----------------------------------------------------------------------------

/** Metadata for auth_provider_selected events */
export interface AuthProviderSelectedMetadata {
  provider: 'apple' | 'google' | 'email';
  /** login vs signup flow — matches the existing auth-events.ts helper shape */
  mode?: 'login' | 'signup';
  /** Origin of the auth attempt (e.g., 'google_one_tap', 'auth_modal', CTA source id) */
  source?: string;
  /** Canonical route pathname at the time of auth intent */
  pathname?: string;
  /** Canonical product/acquisition surface */
  surface?: string;
  /** Normalized source group used for funnel reporting */
  source_group?: string;
  /** Metadata-only signup channel for this instrumentation pass */
  signup_channel?: 'web_app';
  /** Source that assigned the signup channel */
  signup_channel_source?: 'web_auth';
  /** Web/native platform for analytics segmentation */
  platform?: 'web';
  /** First-touch device platform inferred from the browser user agent */
  first_touch_platform?: 'ios' | 'android' | 'desktop';
  /** First landing page captured by attribution cookies */
  first_touch_landing_page?: string;
  /** First referrer captured by attribution cookies */
  first_touch_referrer?: string;
  /** Cam funnel family for /cams and /surf-cams routes */
  cam_family?: 'cams-directory' | 'surf-cams-seo';
}

/** Metadata for Apple sign-in → iOS beta prompt events */
export interface AppleBetaPromptMetadata {
  provider: 'apple';
  source: 'apple-signin-beta-prompt';
  device_mode: 'ios_direct' | 'desktop_qr';
  platform_guess: 'ios' | 'ipad' | 'mac' | 'desktop' | 'unknown';
  destination_url?: string;
  pathname?: string;
  prompt_reason?: 'apple-signin';
  redirect_path?: string;
  has_qr?: boolean;
  testflight_url?: string;
  qr_logo?: 'quiver-app-icon-128';
  dismiss_reason?: 'not_now' | 'dialog_close';
}

// -----------------------------------------------------------------------------
// Phase 2 Tracking Metadata Interfaces
// -----------------------------------------------------------------------------

/** Metadata for beach_search events */
export interface BeachSearchMetadata {
  /** Number of results returned */
  result_count: number;
  /** Length of the query string (we deliberately don't store the query itself — PII concerns) */
  query_length: number;
  /** True when no results matched */
  zero_results: boolean;
  /** Source of the search (e.g., 'header', 'discovery', 'map') */
  source?: string;
}

/** Metadata for beach_search_result_click events */
export interface BeachSearchResultClickMetadata {
  beach_id: string;
  /** Zero-indexed position of the clicked result in the list */
  position: number;
  result_count: number;
  query_length: number;
  source?: string;
}

/** Metadata for session_log_* events */
export interface SessionLogMetadata {
  /** Stable identifier shared by all events in one web/native form flow */
  flow_id?: string;
  /** Client timestamp used for ordering events within a flow */
  client_stage_at?: string;
  /** Version of the session funnel metadata contract */
  schema_version?: number;
  /** Stable event identifier for deduplication and exact joins */
  event_id?: string;
  /** Draft or saved session ID for native session-log telemetry */
  session_id?: string;
  /** Beach ID selected for the session (if already chosen) */
  beach_id?: string;
  /** For session_log_abandon: how the form exited */
  abandon_via?: 'cancel_button' | 'unmount' | 'route_change';
  /** For session_log_abandon: milliseconds since session_log_start */
  duration_ms?: number;
  /** For session_log_abandon: the deepest step the user reached */
  max_step_reached?: 'beach_select' | 'rating' | 'photo' | 'details' | 'review';
  /** For session_log_rating_set: the rating value 1-5 */
  rating?: number;
  /** Validation codes retained as an array for exact failure attribution */
  validation_errors?: string[];
  /** Number of validation codes emitted in the event */
  validation_error_count?: number;
  /** First form section containing a validation error */
  validation_first_field?: string | null;
  /** For session_log_photo_added: count of photos attached at time of event */
  photo_count?: number;
  /** For session_log_photo_added: count added in this picker action */
  added_count?: number;
  /** Local URI schemes only, never raw device paths */
  uri_schemes?: Array<'file' | 'content' | 'http' | 'https' | 'data' | 'unknown'>;
  /** For native photo events: which client pipeline emitted this */
  source?: 'image_library' | 'session_outbox' | 'session_fit_picker';
  /** For session_decomposition_selected: selected decomposition tag */
  tag?: 'waves' | 'crew' | 'vibe' | 'skill_fit';
  /** For session_decomposition_selected: categorical skill fit value */
  skill_fit?: 'under' | 'dialed' | 'over_my_head';
  /** For session_board_fit_feedback_selected: categorical board fit value */
  board_fit?: 'too_small' | 'right' | 'too_much_board' | 'wrong_type' | 'na';
  /** For session_photo_upload_*: outbox attempt number */
  attempt?: number;
  /** For session_photo_upload_*: age of the outbox item when emitted */
  queued_age_ms?: number;
  /** For session_photo_upload_succeeded: number uploaded to storage/session_media */
  uploaded_count?: number;
  /** For session_photo_upload_succeeded: total uploaded bytes */
  bytes_total?: number;
  /** For session_photo_upload_succeeded: sessions.image_url was attached */
  hero_attached?: boolean;
  /** For session_photo_upload_failed: failing upload stage */
  stage?: 'file_read' | 'storage_upload' | 'media_insert' | 'session_image_update' | 'media_lookup' | 'validation' | 'max_attempts';
  /** For session_photo_upload_failed: compact error code */
  error_code?: string;
  /** For session_photo_upload_failed: whether the outbox will retry */
  retryable?: boolean;
}

/** Metadata for map_ready events */
export interface MapReadyMetadata {
  /** Time from component mount to map 'load' event firing, in ms */
  load_time_ms: number;
  /** Count of tile load failures during initial load */
  tiles_failed_count?: number;
}

/** Metadata for map_load_failed events */
export interface MapLoadFailedMetadata {
  /** Short error category — do not include user-provided strings */
  error_type: 'token_invalid' | 'network' | 'webgl_unsupported' | 'tile_error' | 'timeout' | 'unknown';
  /** Time from mount to failure, in ms */
  time_to_failure_ms?: number;
}

/** Metadata for forecast_ready events */
export interface ForecastReadyMetadata {
  beach_id: string;
  /** Time from fetch start to first render, in ms */
  load_time_ms: number;
  /** Source of the forecast data (e.g., 'enhanced', 'marine', 'cached') */
  source?: string;
  /** True if data came from cache (no network hit) */
  cached?: boolean;
}

/** Metadata for Session Intelligence surf-window measurement events. */
export interface SurfWindowMeasurementMetadata {
  surface: string;
  beach_id?: string;
  beach_slug?: string | null;
  beach_name?: string;
  window_id?: string;
  rank?: number;
  score?: number;
  verdict?: string;
  local_time_label?: string;
  canonical_web_url?: string | null;
  target_href?: string;
  link_type?: "universal_link" | "app_path" | "app_store";
  fallback_to_app_store?: boolean;
}

/** Metadata for forecast_accuracy_table_viewed events. */
export interface ForecastAccuracyTableViewedMetadata {
  surface: "forecast_accuracy";
  row_count: number;
  claimable_row_count: number;
  top_beach_id?: string;
  top_beach_slug?: string | null;
}

/** Metadata for save_alert_clicked events. */
export interface SaveAlertClickedMetadata {
  surface: "seo_alert_capture_cta";
  page_context: string;
  beach_id: string;
  beach_name: string;
  source: string;
  preset_types: string[];
}

/** Metadata for seo_intent_page_window_clicked events. */
export interface SeoIntentPageWindowClickedMetadata {
  surface: "intent_handoff";
  city_name: string;
  city_slug: string;
  state_slug: string;
  target_href: string;
  link_label: string;
  link_index: number;
}

/** Metadata for free-growth education events. */
export interface FreeGrowthEducationMetadata {
  surface: string;
  audience: "anonymous" | "authenticated" | "free";
}

/** Metadata for the watched-spot action funnel. */
export interface WatchSpotTappedMetadata {
  surface: string;
  outcome: "created" | "tune" | "upsell";
  preset_type?: string | null;
  creation_flow?: "preset" | "customize" | "custom";
  error_status?: number;
}

/** Metadata for condition alert creation events. */
export interface AlertRuleCreatedMetadata {
  surface: string;
  preset_type?: string | null;
  creation_flow?: "preset" | "customize" | "custom";
}

/** Metadata for empty_state_shown events */
export interface EmptyStateShownMetadata {
  /** Identifier for which empty state surface rendered (e.g., 'beach_reviews', 'map_no_beaches_in_viewport', 'intel_feed', 'session_list') */
  surface: string;
  beach_id?: string;
}

/** Metadata for cta_impression events */
export interface CtaImpressionMetadata {
  /** Stable identifier for the CTA (e.g., 'inline_signup_beach_detail', 'review_cta_reviews_tab') */
  cta_id: string;
  /** Page/surface the CTA lives on */
  surface: string;
  /** Percent of the CTA visible at time of impression (0-100) */
  viewport_pct?: number;
  card_id?: string;
  content_class?: string;
  prompt?: boolean;
  market_key?: string;
}

/** Metadata for client_error events */
export interface ClientErrorMetadata {
  /** Error class + first line of message, truncated to 200 chars to keep metadata small */
  message: string;
  /** First frame of the stack trace, if available */
  stack_top_frame?: string;
  /** Pathname at time of error (no query/hash to avoid PII) */
  route: string;
  /** Source: which capture path fired the event */
  source: 'window_onerror' | 'unhandled_rejection';
}

/** Metadata for scroll_depth events */
export interface ScrollDepthMetadata {
  /** Page/surface the scroll happened on (e.g., 'beach_detail', 'home') */
  surface: string;
  /** Deepest bucket reached for this page view */
  depth_pct: 25 | 50 | 75 | 100;
}

/** Metadata for time_on_page events */
export interface TimeOnPageMetadata {
  surface: string;
  duration_ms: number;
  /** Whether the user was authenticated at time of event */
  authenticated: boolean;
  /** How the page was exited */
  exit_via: 'visibility_hidden' | 'beforeunload' | 'route_change';
}

/** Metadata for first_beach_view_post_signup events */
export interface FirstBeachViewPostSignupMetadata {
  beach_id: string;
  /** Minutes between signup and first beach view (for activation cohort slicing) */
  minutes_since_signup: number;
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
  | ShareLinkOpenedMetadata
  | InviteEventMetadata
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
  | MapInteractionMetadata
  | AuthProviderSelectedMetadata
  | BeachSearchMetadata
  | BeachSearchResultClickMetadata
  | SessionLogMetadata
  | MapReadyMetadata
  | MapLoadFailedMetadata
  | ForecastReadyMetadata
  | SurfWindowMeasurementMetadata
  | ForecastAccuracyTableViewedMetadata
  | SaveAlertClickedMetadata
  | SeoIntentPageWindowClickedMetadata
  | FreeGrowthEducationMetadata
  | WatchSpotTappedMetadata
  | AlertRuleCreatedMetadata
  | EmptyStateShownMetadata
  | CtaImpressionMetadata
  | ClientErrorMetadata
  | ScrollDepthMetadata
  | TimeOnPageMetadata
  | FirstBeachViewPostSignupMetadata
  | AppleBetaPromptMetadata
  | BfrWebEventMetadataMap[keyof BfrWebEventMetadataMap];

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
 * Discriminates from DiscoverySkipMetadata by absence of chosen_beach_id
 */
export function isDiscoveryClickMetadata(
  metadata: EventMetadata | null
): metadata is DiscoveryClickMetadata {
  if (!metadata) return false;
  return (
    'position' in metadata &&
    'score_shown' in metadata &&
    !('chosen_beach_id' in metadata)
  );
}

/**
 * Type guard to check if metadata is DiscoverySkipMetadata
 * Discriminates from DiscoveryClickMetadata by presence of chosen_beach_id
 */
export function isDiscoverySkipMetadata(
  metadata: EventMetadata | null
): metadata is DiscoverySkipMetadata {
  if (!metadata) return false;
  return (
    'position' in metadata &&
    'score_shown' in metadata &&
    'chosen_beach_id' in metadata
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
