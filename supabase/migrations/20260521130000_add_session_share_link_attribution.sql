-- Add low-friction per-link session share attribution.

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_share_links (
  share_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  share_url text NOT NULL,
  surface text NOT NULL DEFAULT 'session_detail',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_share_links_platform_check CHECK (
    platform IN (
      'instagram',
      'x',
      'twitter',
      'facebook',
      'tiktok',
      'copy',
      'native',
      'other',
      'generic',
      'download'
    )
  ),
  CONSTRAINT session_share_links_surface_check CHECK (
    surface IN ('session_detail', 'profile')
  )
);

ALTER TABLE public.session_share_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_session_share_links_session_id
  ON public.session_share_links(session_id);

CREATE INDEX IF NOT EXISTS idx_session_share_links_user_id_created_at
  ON public.session_share_links(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_share_links_created_at
  ON public.session_share_links(created_at DESC);

REVOKE ALL ON TABLE public.session_share_links FROM PUBLIC;
REVOKE ALL ON TABLE public.session_share_links FROM anon;
GRANT SELECT, INSERT ON TABLE public.session_share_links TO authenticated;
GRANT ALL ON TABLE public.session_share_links TO service_role;

DROP POLICY IF EXISTS "Users can create own session share links"
  ON public.session_share_links;

CREATE POLICY "Users can create own session share links"
  ON public.session_share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.sessions
      WHERE sessions.id = session_share_links.session_id
        AND (
          sessions.is_public = true
          OR sessions.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can view own session share links"
  ON public.session_share_links;

CREATE POLICY "Users can view own session share links"
  ON public.session_share_links
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.session_share_links IS
  'Per-link session share attribution. Does not capture recipient identity or mutate session share_count.';

COMMENT ON COLUMN public.session_share_links.share_id IS
  'Opaque ID appended to low-friction shared session URLs as share_id.';

ALTER TABLE public.user_events
  DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_event_type_check CHECK (
    event_type = ANY (ARRAY[
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
      'share_link_opened'::text,
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
      'session_photo_upload_started'::text,
      'session_photo_upload_succeeded'::text,
      'session_photo_upload_failed'::text,
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
      'home_hero_forecast_viewed'::text,
      'push_permission_denied'::text,
      'push_token_fetch_failed'::text,
      'push_device_registration_failed'::text,
      'push_device_registered'::text,
      'home_locked_best_spot_teaser_tap'::text,
      'home_set_alarm_tap'::text,
      'share_sheet_blocked_pending'::text,
      'apple_beta_prompt_eligible'::text,
      'apple_beta_prompt_viewed'::text,
      'apple_beta_prompt_qr_rendered'::text,
      'apple_beta_prompt_open_testflight_clicked'::text,
      'apple_beta_prompt_copy_link_clicked'::text,
      'apple_beta_prompt_dismissed'::text
    ])
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
