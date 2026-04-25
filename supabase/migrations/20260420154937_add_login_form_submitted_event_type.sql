-- Split login email-form submits from signup email-form submits in the event stream.
--
-- Upstream bug: `trackSignupFormSubmitted` (components/auth/unified-auth-modal.tsx:471)
-- fires for BOTH login and signup email-form submissions, guarded only by
-- `if (!user)`. The resulting `signup_form_submitted` rows have metadata.mode
-- varying between 'signup' and 'login' and confuse every dashboard that doesn't
-- filter by mode. In the 7-day window before this migration ~96% of
-- signup_form_submitted rows were mode='login' inflating the "signup" funnel
-- denominator and producing a false 92% dropoff alarm.
--
-- Fix: introduce `login_form_submitted` as a parallel event. Caller branches
-- on activeMode and fires the mode-specific event. Historical
-- signup_form_submitted rows with mode='login' stay in the DB (immutable
-- history); dashboards already filter by metadata.mode so the split reads
-- cleanly across the boundary.
--
-- Applied to prod via MCP apply_migration; local file for schema_migrations
-- parity. No type changes (CHECK constraints are runtime-only).
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
    -- Added 2026-04-20: decouple login email-form submits from signup funnel.
    -- Callers branch on activeMode; historical signup_form_submitted rows
    -- with metadata.mode='login' remain but new login submits emit this.
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
    'home_timeline_tap'::text
  ]));

NOTIFY pgrst, 'reload schema';

COMMIT;
