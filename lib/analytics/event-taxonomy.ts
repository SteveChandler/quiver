import { FollowTopic } from '@/types/beach-follow';

// =============================================================================
// Event Configuration
// =============================================================================

export const BFR_WEB_EVENT_TYPES = [
  'beach_follow_started',
  'beach_follow_saved_local',
  'beach_follow_sync_started',
  'beach_follow_sync_completed',
  'follow_topic_changed',
  'visitor_intent_selected',
  'surf_intent_qualified',
  'my_coast_viewed',
  'my_coast_beach_opened',
] as const;

export const BFR_ANONYMOUS_EVENT_TYPES = [
  'beach_follow_started',
  'beach_follow_saved_local',
  'follow_topic_changed',
  'visitor_intent_selected',
  'surf_intent_qualified',
  'my_coast_viewed',
  'my_coast_beach_opened',
] as const;

export const BFR_INTENT_STATES = ['explicit', 'inferred', 'unknown'] as const;
export const BFR_INTENT_REASONS = [
  'explicit_surfing',
  'explicit_non_surf',
  'high_intent_action',
  'multiple_surf_signals',
  'insufficient_surf_signals',
  'utility_only',
  'no_evidence',
] as const;
export const BFR_TOPICS: readonly FollowTopic[] = Object.values(FollowTopic);
export const BFR_PAGE_TYPES = [
  'beach_detail',
  'beach_water_temp',
  'city_water_temp',
  'my_coast',
  'other',
] as const;
export const BFR_FALLBACK_CLASSIFICATIONS = [
  'exact',
  'expired',
  'invalid',
  'removed_window',
  'beach_only',
] as const;
export const BFR_HANDOFF_CONTEXTS = ['exact_call'] as const;
export const BFR_EXACT_CALL_HANDOFF_EVENTS = {
  started: 'app_handoff_link_opened',
  resolved: 'app_handoff_native_open',
} as const;

export type BfrIntentState = (typeof BFR_INTENT_STATES)[number];
export type BfrIntentReason = (typeof BFR_INTENT_REASONS)[number];
export type BfrTopic = (typeof BFR_TOPICS)[number];
export type BfrPageType = (typeof BFR_PAGE_TYPES)[number];
export type BfrFallbackClassification =
  (typeof BFR_FALLBACK_CLASSIFICATIONS)[number];
export type BfrHandoffContext = (typeof BFR_HANDOFF_CONTEXTS)[number];

export const VALID_EVENTS = [
  // Implicit preference learning events
  'beach_view',
  'discovery_click',
  'discovery_skip',
  'forecast_check',
  'location_update',
  // Engagement tracking events
  'page_view',
  'forecast_interaction',
  'session_action',
  'profile_update',
  'onboarding_step',
  'cta_click',
  // Review tracking events
  'review_form_open',
  'review_form_abandon',
  'review_validation_error',
  'review_submit',
  // Share tracking events
  'share_started',
  'share_completed',
  'share_link_opened',
  'share_link_copied',
  'share_image_saved',
  'share_sheet_blocked_pending',
  'cam_share',
  'share_intel_button_clicked',
  'share_intel_signin_prompt',
  'surf_plan_share',
  // Invite acquisition funnel events
  'invite_link_opened',
  'invite_open_app_clicked',
  'invite_app_store_clicked',
  'invite_continue_web_clicked',
  'invite_consumed',
  // Signup/auth conversion events
  'signup_cta_click',
  'signup_cta_view',
  'signin_cta_click',
  'signed_in',
  'auth_failed',
  // Auth funnel events (fire before user is authenticated)
  'auth_modal_opened',
  'auth_modal_closed_without_action',
  'auth_method_selected',
  'auth_provider_selected',
  'signup_started',
  'signup_success',
  'login_success',
  'login_failed',
  'signup_failed',
  'signup_form_submitted',
  'login_form_submitted',
  'native_app_first_open',
  'native_install_attribution_joined',
  // Home screen events
  'home_viewed',
  'home_at_beach_click',
  'home_plan_weekend_click',
  'home_plan_weekend_no_recommendation',
  'home_beach_forecast_viewed',
  'home_first_session_cta_tap',
  'home_hero_forecast_viewed',
  'home_locked_best_spot_teaser_tap',
  'home_map_tap',
  'home_menu_tap',
  'home_nearby_spot_tap',
  'home_notifications_tap',
  'home_search_tap',
  'home_set_alarm_tap',
  'home_surf_call_tap',
  'home_timeline_tap',
  // Session logging events
  'session_log_start',
  'session_log_draft_opened',
  'session_log_time_selected',
  'session_log_draft_progress',
  'session_log_submit',
  'session_created',
  'session_share_opened_post_save',
  'session_share_closed_post_save',
  // Onboarding/tour events
  'product_tour_started',
  'product_tour_completed',
  'product_tour_skipped',
  'product_tour_step_viewed',
  'onboarding_started',
  'onboarding_intro_get_started',
  'onboarding_step_viewed',
  'onboarding_step_completed',
  'onboarding_step_auto_skipped',
  'onboarding_video_started',
  'onboarding_video_completed',
  'onboarding_video_skipped',
  'onboarding_completed',
  'location_permission_granted',
  'location_permission_denied',
  // Beach detail events
  'beach_search',
  'forecast_tab_click',
  'horizon_strip_day_selected',
  'match_score_teaser_click',
  'match_score_teaser_view',
  'set_home_beach',
  'map_marker_click',
  // Intel events
  'local_intel_tab_viewed',
  'intel_post_created',
  'intel_post_confirmed',
  'plan_session_from_intel',
  // Profile events
  'surf_profile_viewed',
  'surf_profile_progress_shown',
  'learning_signal',
  'learning_progress_revealed',
  'learned_me_moment_viewed',
  // Discovery events
  'recommendation_impression',
  'personalized_score_shown',
  'favorite_shown_in_carousel',
  'mini_log_teaser_click',
  'plan_unlock_click',
  'discover_page_view',
  'discover_suggested_users_impression',
  'discover_profile_open',
  'discover_follow_attempt',
  // Social events
  'social_follow',
  'social_like',
  'social_invite_send',
  'social_invite_respond',
  'social_intel_confirm',
  // Tab and map engagement events
  'tab_view',
  'map_interaction',
  'map_marker_tapped',
  'map_viewed',
  // Map engagement
  'map_ready',
  'map_load_failed',
  // Forecast reliability
  'forecast_ready',
  // Session Intelligence measurement events
  'surf_window_impression',
  'surf_window_click',
  'why_this_call_opened',
  'app_deeplink_clicked',
  // Native deeplink/session handoff events
  'deeplink_received',
  'spot_resolve',
  'session_prefill_shown',
  'session_silent_submit',
  'forecast_accuracy_table_viewed',
  'save_alert_clicked',
  'seo_intent_page_window_clicked',
  // Free growth education + watched spot funnel
  'free_growth_education_impression',
  'free_growth_education_cta_tapped',
  'watch_spot_tapped',
  'alert_rule_created',
  // Session log funnel
  'session_log_beach_selected',
  'session_log_conditions_set',
  'session_log_form_view',
  'session_log_rating_set',
  'session_log_photo_added',
  'session_photo_upload_started',
  'session_photo_upload_succeeded',
  'session_photo_upload_failed',
  'session_log_abandon',
  'session_log_validation_failed',
  'session_spot_search_no_results',
  'session_custom_spot_cta_tapped',
  'session_custom_spot_returned',
  // Phase 21 native board management events
  'board_form_saved',
  'session_board_fit_feedback_selected',
  // Phase 22 native forecast-visual and custom-spot funnel events.
  // These are written directly to user_events by native clients. The DB
  // CHECK constraint must include these names (see migration
  // 20260609120000_add_phase22_native_analytics_events.sql).
  'custom_spot_save_confirmation_viewed',
  'custom_spot_forecast_source_viewed',
  'forecast_visual_layer_selected',
  'synced_forecast_time_selected',
  // Search
  'beach_search_result_click',
  // Growth markers
  'acquisition_source_self_reported',
  'apple_orphan_precheck_indeterminate',
  'apple_orphan_prevented',
  'apple_orphan_recovery_flagged',
  'first_beach_view_post_signup',
  'first_session_logged',
  // Empty states & impressions
  'empty_state_shown',
  'cta_impression',
  // Reliability
  'client_error',
  // Engagement depth (anon + auth)
  'scroll_depth',
  'time_on_page',
  // Phase 2 match-feature events (authenticated only)
  'match_card_rendered',
  'match_strip_tap',
  'for_you_tap',
  'unlock_toast_shown',
  'session_decomposition_selected',
  'match_alert_toggle',
  // Roadmap events
  'feedback_roadmap_opened',
  'feedback_roadmap_request_created',
  'feedback_roadmap_viewed',
  'feedback_roadmap_vote_submitted',
  'roadmap_vote_cast',
  'roadmap_item_submitted',
  'roadmap_item_status_changed',
  'custom_spots_feedback_viewed',
  'custom_spots_feedback_voted',
  'missing_spot_prompt_viewed',
  'missing_spot_prompt_tapped',
  'custom_spot_create_started',
  'custom_spot_saved',
  'custom_spot_failed',
  // Anon alert capture funnel (3 pre-auth + 2 post-auth). Pre-auth events
  // are also added to ANONYMOUS_ALLOWED_EVENTS and PRE_AUTH_ONLY_EVENTS;
  // the post-auth events fire only from /auth/callback once the session
  // exists, so they belong to the authed flow only.
  'anon_alert_capture_view',
  'anon_alert_capture_submit',
  'anon_alert_capture_error',
  'anon_alert_magic_link_clicked',
  'anon_alert_signup_success',
  // Paywall + trial funnel (native, added 2026-05-02 — fires from
  // trial-prompt onboarding step and standalone paywall screen)
  'paywall_opened',
  'paywall_dismissed',
  'paywall_purchase_started',
  'paywall_purchase_success',
  'paywall_purchase_failed',
  'paywall_ready',
  'paywall_plan_selected',
  'paywall_cadence_selected',
  'paywall_restore_started',
  'paywall_restore_success',
  'paywall_restore_failed',
  'paywall_trial_cta_tapped',
  'paywall_lifetime_cta_tapped',
  'paywall_soft_prompt_shown',
  'founder_100_popup_viewed',
  'founder_100_popup_cta_tapped',
  'founder_100_popup_dismissed',
  'onboarding_paywall_skipped',
  'onboarding_trial_started',
  'trial_active',
  'trial_entitlement_received',
  // Push registration observability (native)
  'push_permission_denied',
  'push_token_fetch_failed',
  'push_device_registration_failed',
  'push_device_registered',
  // Apple sign-in beta prompt funnel
  'apple_beta_prompt_eligible',
  'apple_beta_prompt_viewed',
  'apple_beta_prompt_qr_rendered',
  'apple_beta_prompt_open_testflight_clicked',
  'apple_beta_prompt_copy_link_clicked',
  'apple_beta_prompt_dismissed',
  // App-first landing handoff funnel (web -> native)
  'app_handoff_view',
  'app_handoff_qr_rendered',
  'app_handoff_email_submit',
  'app_handoff_email_sent',
  'app_handoff_email_failed',
  'app_handoff_link_opened',
  'app_handoff_native_open',
  // Android beta lead capture (public waitlist form with anonymous session id)
  'android_lead_captured',
  // Durable beach-follow and return-loop measurement. Exact-call handoff
  // reuses app_handoff_link_opened/app_handoff_native_open with bounded context.
  ...BFR_WEB_EVENT_TYPES,
] as const;

export type EventType = (typeof VALID_EVENTS)[number];

export const EXTERNAL_ANALYTICS_ONLY_EVENTS = [
  'android_install_cta_click',
  'android_waitlist_cta_click',
  'android_waitlist_cta_view',
  'auth_redirect_completed',
  'auth_wall_dismissed',
  'auth_wall_shown',
  'forecast_alerts_enabled',
  'install_pwa',
  'invite_friend_clicked',
  'ios_app_cta_click',
  'ios_app_cta_view',
  'iphone_app_banner_click',
  'iphone_app_banner_dismiss',
  'login_started',
  'magic_link_clicked',
  'magic_link_sent',
  'post_beach_intel',
  'public_page_view',
  'quick_log_expanded',
  'referral_code_failed',
  'referral_code_generated',
  'set_alarm_clicked',
  'share_session_clicked',
  'share_sheet_opened',
  'user_signed_in',
] as const;

/**
 * Current literals posted to /api/events that are not accepted by VALID_EVENTS.
 * This preserves behavior for the registry refactor; follow-up slices should
 * either migrate these callers to existing event names or explicitly add them.
 */
export const KNOWN_REJECTED_USER_EVENT_EMITTERS = [
] as const;

/**
 * Event types present in the user_events CHECK constraint but deliberately
 * absent from VALID_EVENTS.
 *
 * Native `trackEvent()` inserts straight into user_events via the Supabase
 * client, so these never transit /api/events and must not widen that route's
 * allowlist. They are still required in the DB CHECK — before migration
 * 20260812130000 every insert of one raised 23514 and was silently dropped,
 * because `trackEvent` is void-dispatched and nothing surfaced the loss.
 *
 * Adding a native-only event means adding it here AND to a CHECK migration.
 * The sync test fails if a CHECK entry appears in none of the three lists.
 */
export const NATIVE_DIRECT_INSERT_EVENTS = [
  'onboarding_paywall_viewed',
  'onboarding_free_selected',
  'onboarding_purchase_started',
  'onboarding_purchase_success',
  'onboarding_purchase_failed',
  'onboarding_purchase_cancelled',
  'onboarding_restore_result',
  'community_filter_selected',
  'siri_shortcut_opened',
  'garmin_connect_viewed',
  'garmin_designated_activity_set',
  'watched_call_created',
  'watched_call_already_exists',
  'watched_call_update_eligible',
  'watched_call_update_suppressed',
  'watched_call_update_delivered',
  'watched_call_update_opened',
  'watched_call_manual_reopened',
  'watched_call_context_resolved',
  'home_mode_restored',
  'home_mode_expired',
  'home_recommendation_changed',
] as const;

export const ANONYMOUS_ALLOWED_EVENTS: readonly EventType[] = [
  'page_view', 'beach_view', 'tab_view', 'onboarding_step',
  // Conversion tracking (critical for understanding anon→authed funnel)
  'signup_cta_click', 'signup_cta_view', 'signin_cta_click', 'cta_click',
  // Auth funnel events (fire before user is authenticated — must be anonymous-allowed)
  'auth_modal_opened', 'auth_modal_closed_without_action',
  'auth_method_selected', 'auth_provider_selected',
  'auth_failed', 'native_app_first_open',
  'apple_orphan_precheck_indeterminate', 'apple_orphan_prevented',
  // Auth-transition events — legitimately fire for both anon and authed users
  // (e.g. signup success fires after auth completes). Not on PRE_AUTH_ONLY_EVENTS.
  'signup_started', 'signup_success', 'login_success',
  // Form-submitted events — pre-auth only; the form can only be submitted by
  // an anonymous user. Authed fires are ghost-triggers and dropped server-side
  // via PRE_AUTH_ONLY_EVENTS.
  'signup_form_submitted', 'login_form_submitted', 'login_failed', 'signup_failed',
  // Native signed-out onboarding intro CTA.
  'onboarding_intro_get_started',
  // Engagement signals from anonymous visitors
  'forecast_interaction', 'forecast_tab_click', 'horizon_strip_day_selected',
  'beach_search', 'beach_search_result_click', 'map_interaction', 'map_marker_click',
  'share_started', 'share_completed', 'share_link_opened', 'share_link_copied',
  'cam_share',
  'invite_link_opened', 'invite_open_app_clicked', 'invite_app_store_clicked',
  'invite_continue_web_clicked',
  'match_score_teaser_view', 'match_score_teaser_click',
  // Map reliability (anon visitors hit the map immediately)
  'map_ready', 'map_load_failed',
  // Forecast reliability
  'forecast_ready',
  // Session Intelligence public measurement
  'surf_window_impression',
  'surf_window_click',
  'why_this_call_opened',
  'app_deeplink_clicked',
  'forecast_accuracy_table_viewed',
  'save_alert_clicked',
  'seo_intent_page_window_clicked',
  'free_growth_education_impression',
  'free_growth_education_cta_tapped',
  // Empty states + CTA impressions
  'empty_state_shown', 'cta_impression',
  // Client error capture
  'client_error',
  // Engagement depth
  'scroll_depth', 'time_on_page',
  // Anon alert capture (pre-auth only — fired from anonymous SEO landings).
  // The two post-auth siblings (anon_alert_magic_link_clicked,
  // anon_alert_signup_success) deliberately omitted; they fire only once
  // the user is authenticated in /auth/callback.
  'anon_alert_capture_view',
  'anon_alert_capture_submit',
  'anon_alert_capture_error',
  // App-first landing handoff funnel - fire for signed-out landing visitors.
  'app_handoff_view', 'app_handoff_qr_rendered', 'app_handoff_email_submit',
  'app_handoff_email_sent', 'app_handoff_email_failed', 'app_handoff_link_opened',
  'app_handoff_native_open',
  // Android beta lead capture can be submitted before authentication.
  'android_lead_captured',
  ...BFR_ANONYMOUS_EVENT_TYPES,
] as const;

/**
 * Pre-auth funnel events should not be recorded for authenticated users.
 * These events are only meaningful when tracking anon → authed conversion.
 * Exported so tests can verify the invariant alongside VALID_EVENTS.
 */
export const PRE_AUTH_ONLY_EVENTS: readonly EventType[] = [
  'signup_cta_view',
  'signup_cta_click',
  'signin_cta_click',
  'signup_form_submitted',
  'login_form_submitted',
  'login_failed',
  'signup_failed',
  'auth_modal_opened',
  'auth_modal_closed_without_action',
  'auth_failed',
  'native_app_first_open',
  'apple_orphan_precheck_indeterminate',
  'apple_orphan_prevented',
  // Native signed-out onboarding intro CTA.
  'onboarding_intro_get_started',
  // Anon alert capture (pre-auth only). Ghost-authed fires of these
  // events are silently dropped server-side. The post-auth siblings
  // (magic_link_clicked, signup_success) intentionally NOT here — they
  // require an authenticated user.
  'anon_alert_capture_view',
  'anon_alert_capture_submit',
  'anon_alert_capture_error',
] as const;
