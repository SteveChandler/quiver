-- Migration: Add auth funnel event types to CHECK constraint
-- Description: The app/api/events/route.ts defines 8 auth funnel event types
--              that pass app-level VALID_EVENTS validation but are missing from
--              the DB CHECK constraint, causing 500 errors on every auth event.
-- Date: 2026-03-13
--
-- Event types added (8 new):
--   Auth funnel: auth_modal_opened, auth_modal_closed_without_action,
--     auth_method_selected, auth_provider_selected,
--     signup_started, signup_success, login_success, signup_form_submitted

BEGIN;

-- Drop existing constraint
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;

-- Add expanded constraint with auth funnel event types
ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (
  event_type IN (
    -- Implicit preference learning events
    'beach_view',
    'discovery_click',
    'discovery_skip',
    'forecast_check',
    'location_update',
    -- Engagement tracking events
    'page_view',
    'forecast_interaction',
    'session_action',
    'profile_update',
    'onboarding_step',
    'cta_click',
    -- Review tracking events
    'review_form_open',
    'review_form_abandon',
    'review_validation_error',
    'review_submit',
    -- Share tracking events
    'share_started',
    'share_completed',
    'share_link_copied',
    'share_image_saved',
    'cam_share',
    'share_intel_button_clicked',
    'share_intel_signin_prompt',
    'surf_plan_share',
    -- Signup/auth conversion events
    'signup_cta_click',
    'signup_cta_view',
    'signin_cta_click',
    -- Auth funnel events (NEW)
    'auth_modal_opened',
    'auth_modal_closed_without_action',
    'auth_method_selected',
    'auth_provider_selected',
    'signup_started',
    'signup_success',
    'login_success',
    'signup_form_submitted',
    -- Home screen events
    'home_at_beach_click',
    'home_plan_weekend_click',
    'home_plan_weekend_no_recommendation',
    -- Session logging events
    'session_log_start',
    'session_log_submit',
    'session_share_opened_post_save',
    'session_share_closed_post_save',
    -- Onboarding/tour events
    'product_tour_started',
    'product_tour_completed',
    'product_tour_skipped',
    'product_tour_step_viewed',
    -- Beach detail events
    'beach_search',
    'forecast_tab_click',
    'horizon_strip_day_selected',
    'match_score_teaser_click',
    'match_score_teaser_view',
    'set_home_beach',
    'map_marker_click',
    -- Intel events
    'local_intel_tab_viewed',
    'intel_post_created',
    'intel_post_confirmed',
    'plan_session_from_intel',
    -- Profile events
    'surf_profile_viewed',
    'surf_profile_progress_shown',
    -- Discovery events
    'personalized_score_shown',
    'favorite_shown_in_carousel',
    'mini_log_teaser_click',
    'plan_unlock_click',
    -- Social events
    'social_follow',
    'social_like',
    'social_share',
    'social_invite_send',
    'social_invite_respond',
    'social_intel_confirm',
    -- Tab and map engagement events
    'tab_view',
    'map_interaction'
  )
);

-- Update constraint documentation
COMMENT ON CONSTRAINT user_events_event_type_check ON public.user_events IS
  'Validates event types across all tracking categories including auth funnel events. Last updated 2026-03-13.';

COMMIT;

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================
-- To rollback, restore the previous constraint from 20260309162000:
--
-- ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;
-- Then re-apply the constraint from 20260309162000_expand_event_types_full.sql
-- =============================================================================
