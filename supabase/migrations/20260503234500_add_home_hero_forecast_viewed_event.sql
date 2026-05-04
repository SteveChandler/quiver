-- Add 'home_hero_forecast_viewed' to user_events.event_type CHECK allowlist.
--
-- The native home screen has been emitting 'home_beach_forecast_viewed' for
-- the hero card since shipping. The hero is the top discovery recommendation
-- for the user's current location (see quiver-native/src/screens/home.tsx
-- comment at line 142), NOT the user's home beach. As a result every fire
-- has carried 'is_home_beach: false' (Chris Luna 2026-05-02..03 audit
-- confirmed 8/8 false fires across 4 different beaches, none of which were
-- his home beach Scripps).
--
-- Renaming forward only: 'home_hero_forecast_viewed' replaces the misleading
-- name. 'home_beach_forecast_viewed' stays in the allowlist so historical
-- rows remain queryable; new emissions go under the new name. Metadata
-- contract is unchanged.
--
-- Strictly additive: every event_type from the prior CHECK migration
-- (20260503023032_add_paywall_and_trial_events.sql) is preserved verbatim.

BEGIN;

ALTER TABLE public.user_events
  DROP CONSTRAINT user_events_event_type_check;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'beach_view'::text,
    'discovery_click'::text,
    'discovery_skip'::text,
    'forecast_check'::text,
    'location_update'::text,
    'page_view'::text,
    'forecast_interaction'::text,
    'session_action'::text,
    'profile_update'::text,
    'onboarding_step'::text,
    'cta_click'::text,
    'review_form_open'::text,
    'review_form_abandon'::text,
    'review_validation_error'::text,
    'review_submit'::text,
    'share_started'::text,
    'share_completed'::text,
    'share_link_copied'::text,
    'share_image_saved'::text,
    'cam_share'::text,
    'share_intel_button_clicked'::text,
    'share_intel_signin_prompt'::text,
    'surf_plan_share'::text,
    'signup_cta_click'::text,
    'signup_cta_view'::text,
    'signin_cta_click'::text,
    'auth_modal_opened'::text,
    'auth_modal_closed_without_action'::text,
    'auth_method_selected'::text,
    'auth_provider_selected'::text,
    'signup_started'::text,
    'signup_success'::text,
    'login_success'::text,
    'signup_form_submitted'::text,
    'login_form_submitted'::text,
    'home_at_beach_click'::text,
    'home_plan_weekend_click'::text,
    'home_plan_weekend_no_recommendation'::text,
    'session_log_start'::text,
    'session_log_submit'::text,
    'session_share_opened_post_save'::text,
    'session_share_closed_post_save'::text,
    'product_tour_started'::text,
    'product_tour_completed'::text,
    'product_tour_skipped'::text,
    'product_tour_step_viewed'::text,
    'beach_search'::text,
    'forecast_tab_click'::text,
    'horizon_strip_day_selected'::text,
    'match_score_teaser_click'::text,
    'match_score_teaser_view'::text,
    'set_home_beach'::text,
    'map_marker_click'::text,
    'local_intel_tab_viewed'::text,
    'intel_post_created'::text,
    'intel_post_confirmed'::text,
    'plan_session_from_intel'::text,
    'surf_profile_viewed'::text,
    'surf_profile_progress_shown'::text,
    'personalized_score_shown'::text,
    'favorite_shown_in_carousel'::text,
    'mini_log_teaser_click'::text,
    'plan_unlock_click'::text,
    'social_follow'::text,
    'social_like'::text,
    'social_share'::text,
    'social_invite_send'::text,
    'social_invite_respond'::text,
    'social_intel_confirm'::text,
    'tab_view'::text,
    'map_interaction'::text,
    'onboarding_step_viewed'::text,
    'onboarding_step_completed'::text,
    'onboarding_step_auto_skipped'::text,
    -- Misnamed legacy event (pre-2026-05-03). The "hero" is actually the top
    -- discovery rec, not the user's home beach. Kept for historical query
    -- compatibility; new emissions use 'home_hero_forecast_viewed' below.
    'home_beach_forecast_viewed'::text,
    'onboarding_video_started'::text,
    'onboarding_video_completed'::text,
    'onboarding_video_skipped'::text,
    'onboarding_completed'::text,
    'location_permission_granted'::text,
    'location_permission_denied'::text,
    'first_session_logged'::text,
    'home_first_session_cta_tap'::text,
    'home_map_tap'::text,
    'home_menu_tap'::text,
    'home_nearby_spot_tap'::text,
    'home_notifications_tap'::text,
    'home_search_tap'::text,
    'home_surf_call_tap'::text,
    'home_timeline_tap'::text,
    'map_ready'::text,
    'map_load_failed'::text,
    'forecast_ready'::text,
    'session_log_beach_selected'::text,
    'session_log_rating_set'::text,
    'session_log_photo_added'::text,
    'session_log_abandon'::text,
    'beach_search_result_click'::text,
    'first_beach_view_post_signup'::text,
    'empty_state_shown'::text,
    'cta_impression'::text,
    'client_error'::text,
    'scroll_depth'::text,
    'time_on_page'::text,
    'match_card_rendered'::text,
    'match_strip_tap'::text,
    'for_you_tap'::text,
    'unlock_toast_shown'::text,
    'session_decomposition_selected'::text,
    'match_alert_toggle'::text,
    'roadmap_vote_cast'::text,
    'roadmap_item_submitted'::text,
    'roadmap_item_status_changed'::text,
    'anon_alert_capture_view'::text,
    'anon_alert_capture_submit'::text,
    'anon_alert_capture_error'::text,
    'anon_alert_magic_link_clicked'::text,
    'anon_alert_signup_success'::text,
    'session_log_validation_failed'::text,
    'paywall_opened'::text,
    'paywall_dismissed'::text,
    'paywall_purchase_started'::text,
    'paywall_purchase_success'::text,
    'paywall_purchase_failed'::text,
    'onboarding_paywall_skipped'::text,
    'onboarding_trial_started'::text,
    -- Added 2026-05-03: rename of misleading 'home_beach_forecast_viewed'.
    -- Fires once per home-screen mount when the hero (top discovery rec)
    -- has both recommendation + forecast data. Metadata still includes
    -- is_home_beach so we can isolate the rare case where the hero IS the
    -- user's home beach.
    'home_hero_forecast_viewed'::text
  ]));

NOTIFY pgrst, 'reload schema';

COMMIT;
