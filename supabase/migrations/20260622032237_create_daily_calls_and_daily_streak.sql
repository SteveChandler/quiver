BEGIN;
CREATE TABLE IF NOT EXISTS public.daily_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id UUID REFERENCES public.beaches(id),
  call_date DATE NOT NULL,
  prediction TEXT NOT NULL CHECK (prediction IN ('firing', 'fun', 'junk', 'flat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, call_date)
);
ALTER TABLE public.daily_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_calls_select_own ON public.daily_calls;
DROP POLICY IF EXISTS daily_calls_insert_own ON public.daily_calls;
CREATE POLICY daily_calls_select_own ON public.daily_calls
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY daily_calls_insert_own ON public.daily_calls
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
GRANT SELECT, INSERT ON public.daily_calls TO authenticated;
GRANT ALL ON public.daily_calls TO service_role;
CREATE OR REPLACE FUNCTION public.get_user_streaks(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_best INT := 0;
  v_week_current INT := 0;
  v_day_best INT := 0;
  v_day_current INT := 0;
  v_this_week DATE := date_trunc('week', NOW())::date;
  v_today DATE := CURRENT_DATE;
  v_caller UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'get_user_streaks: p_user_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'get_user_streaks: caller may only read own streaks'
      USING ERRCODE = '42501';
  END IF;

  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', arrival_time)::date AS wk
    FROM public.sessions
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
  ),
  islands AS (
    SELECT
      wk,
      (wk - ((ROW_NUMBER() OVER (ORDER BY wk))::int * INTERVAL '7 day'))::date AS grp
    FROM weeks
  ),
  runs AS (
    SELECT grp, COUNT(*)::int AS run_len, MAX(wk) AS last_wk
    FROM islands
    GROUP BY grp
  )
  SELECT
    COALESCE(MAX(run_len), 0),
    COALESCE(MAX(run_len) FILTER (WHERE last_wk >= v_this_week - INTERVAL '7 day'), 0)
  INTO v_week_best, v_week_current
  FROM runs;

  WITH days AS (
    SELECT DISTINCT call_date AS d
    FROM public.daily_calls
    WHERE user_id = p_user_id
  ),
  islands AS (
    SELECT
      d,
      (d - ((ROW_NUMBER() OVER (ORDER BY d))::int * INTERVAL '1 day'))::date AS grp
    FROM days
  ),
  runs AS (
    SELECT grp, COUNT(*)::int AS run_len, MAX(d) AS last_d
    FROM islands
    GROUP BY grp
  )
  SELECT
    COALESCE(MAX(run_len), 0),
    COALESCE(MAX(run_len) FILTER (WHERE last_d >= v_today - INTERVAL '1 day'), 0)
  INTO v_day_best, v_day_current
  FROM runs;

  RETURN json_build_object(
    'weekly_session_streak_current', v_week_current,
    'weekly_session_streak_best',    v_week_best,
    'daily_call_streak_current',     v_day_current,
    'daily_call_streak_best',        v_day_best
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_streaks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_streaks(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_user_streaks(uuid) IS
  'Weekly session streak (consecutive ISO weeks with >=1 session) and daily call streak '
  '(consecutive user-local call_date values) for a user. Current weekly streak stays alive '
  'through this week if last session was this week or last week; current daily streak stays '
  'alive if the last call was today or yesterday. Applies sessions.deleted_at IS NULL. '
  'SECURITY DEFINER with search_path protection and self-read guard.';
ALTER TABLE public.user_events
  DROP CONSTRAINT IF EXISTS user_events_event_type_check;
ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_event_type_check
  CHECK (event_type IN (
    'beach_view',
    'discovery_click',
    'discovery_skip',
    'forecast_check',
    'location_update',
    'page_view',
    'forecast_interaction',
    'session_action',
    'profile_update',
    'onboarding_step',
    'cta_click',
    'review_form_open',
    'review_form_abandon',
    'review_validation_error',
    'review_submit',
    'share_started',
    'share_completed',
    'share_link_opened',
    'share_link_copied',
    'share_image_saved',
    'cam_share',
    'share_intel_button_clicked',
    'share_intel_signin_prompt',
    'surf_plan_share',
    'signup_cta_click',
    'signup_cta_view',
    'signin_cta_click',
    'auth_modal_opened',
    'auth_modal_closed_without_action',
    'auth_method_selected',
    'auth_provider_selected',
    'signup_started',
    'signup_success',
    'login_success',
    'signup_form_submitted',
    'login_form_submitted',
    'home_at_beach_click',
    'home_plan_weekend_click',
    'home_plan_weekend_no_recommendation',
    'session_log_start',
    'session_log_submit',
    'session_share_opened_post_save',
    'session_share_closed_post_save',
    'product_tour_started',
    'product_tour_completed',
    'product_tour_skipped',
    'product_tour_step_viewed',
    'beach_search',
    'forecast_tab_click',
    'horizon_strip_day_selected',
    'match_score_teaser_click',
    'match_score_teaser_view',
    'set_home_beach',
    'map_marker_click',
    'local_intel_tab_viewed',
    'intel_post_created',
    'intel_post_confirmed',
    'plan_session_from_intel',
    'surf_profile_viewed',
    'surf_profile_progress_shown',
    'personalized_score_shown',
    'favorite_shown_in_carousel',
    'mini_log_teaser_click',
    'plan_unlock_click',
    'social_follow',
    'social_like',
    'social_share',
    'social_invite_send',
    'social_invite_respond',
    'social_intel_confirm',
    'tab_view',
    'map_interaction',
    'onboarding_step_viewed',
    'onboarding_step_completed',
    'onboarding_step_auto_skipped',
    'home_beach_forecast_viewed',
    'onboarding_video_started',
    'onboarding_video_completed',
    'onboarding_video_skipped',
    'onboarding_completed',
    'location_permission_granted',
    'location_permission_denied',
    'first_session_logged',
    'home_first_session_cta_tap',
    'home_map_tap',
    'home_menu_tap',
    'home_nearby_spot_tap',
    'home_notifications_tap',
    'home_search_tap',
    'home_surf_call_tap',
    'home_timeline_tap',
    'map_ready',
    'map_load_failed',
    'forecast_ready',
    'session_log_beach_selected',
    'session_log_rating_set',
    'session_log_photo_added',
    'session_photo_upload_started',
    'session_photo_upload_succeeded',
    'session_photo_upload_failed',
    'session_log_abandon',
    'beach_search_result_click',
    'first_beach_view_post_signup',
    'empty_state_shown',
    'cta_impression',
    'client_error',
    'scroll_depth',
    'time_on_page',
    'match_card_rendered',
    'match_strip_tap',
    'for_you_tap',
    'unlock_toast_shown',
    'session_decomposition_selected',
    'match_alert_toggle',
    'roadmap_vote_cast',
    'roadmap_item_submitted',
    'roadmap_item_status_changed',
    'anon_alert_capture_view',
    'anon_alert_capture_submit',
    'anon_alert_capture_error',
    'anon_alert_magic_link_clicked',
    'anon_alert_signup_success',
    'session_log_validation_failed',
    'paywall_opened',
    'paywall_dismissed',
    'paywall_purchase_started',
    'paywall_purchase_success',
    'paywall_purchase_failed',
    'onboarding_paywall_skipped',
    'onboarding_trial_started',
    'home_hero_forecast_viewed',
    'push_permission_denied',
    'push_token_fetch_failed',
    'push_device_registration_failed',
    'push_device_registered',
    'home_locked_best_spot_teaser_tap',
    'home_set_alarm_tap',
    'share_sheet_blocked_pending',
    'apple_beta_prompt_eligible',
    'apple_beta_prompt_viewed',
    'apple_beta_prompt_qr_rendered',
    'apple_beta_prompt_open_testflight_clicked',
    'apple_beta_prompt_copy_link_clicked',
    'apple_beta_prompt_dismissed',
    'invite_link_opened',
    'invite_open_app_clicked',
    'invite_app_store_clicked',
    'invite_continue_web_clicked',
    'invite_consumed',
    'custom_spot_create_started',
    'custom_spot_failed',
    'custom_spot_saved',
    'custom_spots_feedback_viewed',
    'custom_spots_feedback_voted',
    'feedback_roadmap_opened',
    'feedback_roadmap_request_created',
    'feedback_roadmap_viewed',
    'feedback_roadmap_vote_submitted',
    'map_marker_tapped',
    'map_viewed',
    'missing_spot_prompt_tapped',
    'missing_spot_prompt_viewed',
    'onboarding_started',
    'paywall_cadence_selected',
    'paywall_plan_selected',
    'paywall_restore_failed',
    'paywall_restore_started',
    'paywall_restore_success',
    'paywall_trial_cta_tapped',
    'trial_active',
    'trial_entitlement_received',
    'app_deeplink_clicked',
    'forecast_accuracy_table_viewed',
    'save_alert_clicked',
    'seo_intent_page_window_clicked',
    'surf_window_click',
    'surf_window_impression',
    'why_this_call_opened',
    'session_spot_search_no_results',
    'session_custom_spot_cta_tapped',
    'session_custom_spot_returned',
    'board_form_saved',
    'session_board_fit_feedback_selected',
    'custom_spot_save_confirmation_viewed',
    'custom_spot_forecast_source_viewed',
    'forecast_visual_layer_selected',
    'synced_forecast_time_selected',
    'paywall_ready',
    'founder_100_popup_viewed',
    'founder_100_popup_cta_tapped',
    'founder_100_popup_dismissed',
    'paywall_lifetime_cta_tapped',
    'onboarding_intro_get_started',
    'signed_in',
    'auth_failed',
    'home_viewed',
    'native_app_first_open',
    'learning_signal',
    'learning_progress_revealed',
    'learned_me_moment_viewed',
    'session_log_draft_opened',
    'session_log_time_selected',
    'session_log_draft_progress',
    'paywall_soft_prompt_shown',
    'app_handoff_view',
    'app_handoff_qr_rendered',
    'app_handoff_email_submit',
    'app_handoff_email_sent',
    'app_handoff_email_failed',
    'app_handoff_link_opened',
    'session_log_conditions_set',
    'native_open_from_email',
    'native_open_from_push',
    'make_call_card_viewed',
    'make_call_submitted'
  ));
NOTIFY pgrst, 'reload schema';
COMMIT;
