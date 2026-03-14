-- P0 Fixes: bot_flagged column + auth funnel event types
--
-- This migration records fixes that were applied directly to production on 2026-03-13
-- to resolve two P0 issues:
--
-- P0-1: Auth funnel events (auth_modal_opened, signup_started, etc.) were silently
--        rejected by the CHECK constraint on user_events.event_type. The constraint
--        from migration 20260309162000 did not include these 8 event types.
--
-- P0-3: get_conversion_funnel() RPC referenced a bot_flagged column that didn't exist.
--        The bot_flagged column was defined in 20260310120000_flag_bot_events.sql but
--        that migration was never applied due to a version collision with
--        20260310120000_add_break_type_to_get_nearby_beaches.sql.
--
-- Root cause: Two pairs of migrations shared timestamps, causing one of each pair
-- to be silently skipped during supabase db push.
--
-- ROLLBACK INSTRUCTIONS:
--   ALTER TABLE public.user_events DROP COLUMN IF EXISTS bot_flagged;
--   Then restore the previous CHECK constraint from 20260309162000.

BEGIN;

-- 1. Add bot_flagged column (idempotent)
ALTER TABLE public.user_events ADD COLUMN IF NOT EXISTS bot_flagged boolean DEFAULT false;

-- 2. Flag known bot events retroactively
-- Bot fingerprint: Windows/Chrome/desktop/1280px viewport, anonymous sessions
UPDATE public.user_events
SET bot_flagged = true
WHERE user_id IS NULL
  AND bot_flagged = false
  AND metadata->>'_viewport_width' = '1280'
  AND metadata->'_device'->>'os' = 'Windows'
  AND metadata->'_device'->>'browser' = 'Chrome'
  AND metadata->'_device'->>'device_type' = 'desktop';

-- 3. Update CHECK constraint to include auth funnel event types
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (
  event_type IN (
    -- Implicit preference learning events
    'beach_view', 'discovery_click', 'discovery_skip', 'forecast_check', 'location_update',
    -- Engagement tracking events
    'page_view', 'forecast_interaction', 'session_action', 'profile_update', 'onboarding_step', 'cta_click',
    -- Review tracking events
    'review_form_open', 'review_form_abandon', 'review_validation_error', 'review_submit',
    -- Share tracking events
    'share_started', 'share_completed', 'share_link_copied', 'share_image_saved',
    'cam_share', 'share_intel_button_clicked', 'share_intel_signin_prompt', 'surf_plan_share',
    -- Signup/auth conversion events
    'signup_cta_click', 'signup_cta_view', 'signin_cta_click',
    -- Auth funnel events (added in this migration)
    'auth_modal_opened', 'auth_modal_closed_without_action', 'auth_method_selected',
    'auth_provider_selected', 'signup_started', 'signup_success', 'login_success', 'signup_form_submitted',
    -- Home screen events
    'home_at_beach_click', 'home_plan_weekend_click', 'home_plan_weekend_no_recommendation',
    -- Session logging events
    'session_log_start', 'session_log_submit', 'session_share_opened_post_save', 'session_share_closed_post_save',
    -- Onboarding/tour events
    'product_tour_started', 'product_tour_completed', 'product_tour_skipped', 'product_tour_step_viewed',
    -- Beach detail events
    'beach_search', 'forecast_tab_click', 'horizon_strip_day_selected',
    'match_score_teaser_click', 'match_score_teaser_view', 'set_home_beach', 'map_marker_click',
    -- Intel events
    'local_intel_tab_viewed', 'intel_post_created', 'intel_post_confirmed', 'plan_session_from_intel',
    -- Profile events
    'surf_profile_viewed', 'surf_profile_progress_shown',
    -- Discovery events
    'personalized_score_shown', 'favorite_shown_in_carousel', 'mini_log_teaser_click', 'plan_unlock_click',
    -- Social events
    'social_follow', 'social_like', 'social_share', 'social_invite_send', 'social_invite_respond', 'social_intel_confirm',
    -- Tab and map engagement events
    'tab_view', 'map_interaction'
  )
);

COMMENT ON CONSTRAINT user_events_event_type_check ON public.user_events IS
  'Validates event types. Includes auth funnel events added 2026-03-13 (P0-1 fix).';

COMMIT;

-- Index must be outside transaction for CONCURRENTLY support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_bot_flagged
  ON public.user_events (bot_flagged)
  WHERE bot_flagged = true;
