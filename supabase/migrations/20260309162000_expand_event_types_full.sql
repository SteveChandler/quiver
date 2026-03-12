-- Migration: Expand event_type CHECK constraint to match all app-defined events
-- Description: The user_events_event_type_check constraint only allows 23 event
--              types, but the application code (app/api/events/route.ts) defines
--              ~63 valid event types. All newer types (share, signup, session log,
--              tour, intel, profile, discovery, etc.) silently fail with 500 errors.
-- Date: 2026-03-09
--
-- Event types added (40 new):
--   Share events: share_started, share_completed, share_link_copied,
--     share_image_saved, cam_share, share_intel_button_clicked,
--     share_intel_signin_prompt, surf_plan_share
--   Signup/auth conversion: signup_cta_click, signup_cta_view, signin_cta_click
--   Home screen: home_at_beach_click, home_plan_weekend_click,
--     home_plan_weekend_no_recommendation
--   Session logging: session_log_start, session_log_submit,
--     session_share_opened_post_save, session_share_closed_post_save
--   Onboarding/tour: product_tour_started, product_tour_completed,
--     product_tour_skipped, product_tour_step_viewed
--   Beach detail: beach_search, forecast_tab_click,
--     horizon_strip_day_selected, match_score_teaser_click,
--     match_score_teaser_view, set_home_beach, map_marker_click
--   Intel: local_intel_tab_viewed, intel_post_created,
--     intel_post_confirmed, plan_session_from_intel
--   Profile: surf_profile_viewed, surf_profile_progress_shown
--   Discovery: personalized_score_shown, favorite_shown_in_carousel,
--     mini_log_teaser_click, plan_unlock_click
--
-- Retained for backwards compatibility:
--   social_share (in previous DB constraint but not in current app VALID_EVENTS)

BEGIN;

-- Drop existing constraint
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;

-- Add expanded constraint with ALL event types from app code + legacy DB types
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
    'social_share',       -- retained for backwards compat (in DB but not in current app code)
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
  'Validates event types across all tracking categories: implicit preference learning, engagement, review, share, signup/auth, home screen, session logging, onboarding/tour, beach detail, intel, profile, discovery, social, and tab/map. Last updated 2026-03-09.';

COMMIT;

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================
-- To rollback this migration, restore the previous 23-type constraint:
--
-- ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;
--
-- ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (
--   event_type IN (
--     'beach_view', 'discovery_click', 'discovery_skip', 'forecast_check',
--     'location_update', 'page_view', 'forecast_interaction', 'session_action',
--     'profile_update', 'onboarding_step', 'cta_click',
--     'review_form_open', 'review_form_abandon', 'review_validation_error',
--     'review_submit', 'tab_view', 'map_interaction',
--     'social_follow', 'social_like', 'social_share',
--     'social_invite_send', 'social_invite_respond', 'social_intel_confirm'
--   )
-- );
--
-- NOTE: Before rolling back, check for rows with new event types:
-- SELECT event_type, COUNT(*) FROM public.user_events
-- WHERE event_type NOT IN (
--   'beach_view', 'discovery_click', 'discovery_skip', 'forecast_check',
--   'location_update', 'page_view', 'forecast_interaction', 'session_action',
--   'profile_update', 'onboarding_step', 'cta_click',
--   'review_form_open', 'review_form_abandon', 'review_validation_error',
--   'review_submit', 'tab_view', 'map_interaction',
--   'social_follow', 'social_like', 'social_share',
--   'social_invite_send', 'social_invite_respond', 'social_intel_confirm'
-- )
-- GROUP BY event_type;
--
-- If rows exist, archive or delete them before applying rollback.
-- =============================================================================
