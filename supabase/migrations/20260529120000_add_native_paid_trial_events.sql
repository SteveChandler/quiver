-- Add missing native analytics events to user_events.event_type CHECK allowlist.
--
-- Preserve the live CHECK expression dynamically so existing web, native, and
-- invite acquisition events remain accepted even if the deployed constraint has
-- drifted ahead of the latest full allowlist migration.

BEGIN;

DO $$
DECLARE
  current_check text;
  native_event_types text[] := ARRAY[
    'beach_view',
    'client_error',
    'custom_spot_create_started',
    'custom_spot_failed',
    'custom_spot_saved',
    'custom_spots_feedback_viewed',
    'custom_spots_feedback_voted',
    'feedback_roadmap_opened',
    'feedback_roadmap_request_created',
    'feedback_roadmap_viewed',
    'feedback_roadmap_vote_submitted',
    'first_session_logged',
    'for_you_tap',
    'forecast_interaction',
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
    'location_permission_denied',
    'location_permission_granted',
    'map_interaction',
    'map_marker_tapped',
    'map_viewed',
    'match_alert_toggle',
    'match_card_rendered',
    'match_strip_tap',
    'missing_spot_prompt_tapped',
    'missing_spot_prompt_viewed',
    'onboarding_completed',
    'onboarding_paywall_skipped',
    'onboarding_started',
    'onboarding_step_auto_skipped',
    'onboarding_step_completed',
    'onboarding_step_viewed',
    'onboarding_trial_started',
    'onboarding_video_completed',
    'onboarding_video_skipped',
    'onboarding_video_started',
    'paywall_cadence_selected',
    'paywall_dismissed',
    'paywall_opened',
    'paywall_plan_selected',
    'paywall_purchase_failed',
    'paywall_purchase_started',
    'paywall_purchase_success',
    'paywall_restore_failed',
    'paywall_restore_started',
    'paywall_restore_success',
    'paywall_trial_cta_tapped',
    'push_device_registered',
    'push_device_registration_failed',
    'push_permission_denied',
    'push_token_fetch_failed',
    'session_decomposition_selected',
    'session_log_abandon',
    'session_log_photo_added',
    'session_log_rating_set',
    'session_log_start',
    'session_log_submit',
    'session_log_validation_failed',
    'session_photo_upload_failed',
    'session_photo_upload_started',
    'session_photo_upload_succeeded',
    'session_share_opened_post_save',
    'share_completed',
    'share_link_opened',
    'share_sheet_blocked_pending',
    'tab_view',
    'trial_active',
    'trial_entitlement_received',
    'unlock_toast_shown'
  ];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
    current_check,
    native_event_types
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
