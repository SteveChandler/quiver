-- Migration: Expand event types for tab/map engagement and social tracking
-- Description: Expands user_events event_type check constraint to include
--              tab/map engagement events and social tracking events that
--              existed in TypeScript types but were never added to the DB constraint.
-- Date: 2026-03-01
--
-- New event types added:
--   Tab and map engagement events:
--   - tab_view: Tracked when user switches between tabs (overview, reviews, etc.)
--   - map_interaction: Tracked when user interacts with the beach discovery map
--
--   Social tracking events (existed in TS, now added to DB constraint):
--   - social_follow: User follows/unfollows another user
--   - social_like: User likes/unlikes a session
--   - social_share: User shares content (session, wave, cam, etc.)
--   - social_invite_send: User sends a session invite
--   - social_invite_respond: User accepts/declines a session invite
--   - social_intel_confirm: User confirms/unconfirms surf intel

BEGIN;

-- Drop existing constraint and add expanded one with all event types
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;

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
    -- Tab and map engagement events
    'tab_view',
    'map_interaction',
    -- Social tracking events
    'social_follow',
    'social_like',
    'social_share',
    'social_invite_send',
    'social_invite_respond',
    'social_intel_confirm'
  )
);

-- Add comment documenting all event type categories
COMMENT ON CONSTRAINT user_events_event_type_check ON public.user_events IS
  'Validates event types across all tracking categories: implicit preference learning, engagement, review, tab/map, and social';

COMMIT;

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================
-- To rollback this migration, run the following SQL:
--
-- ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;
--
-- ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (
--   event_type IN (
--     'beach_view',
--     'discovery_click',
--     'discovery_skip',
--     'forecast_check',
--     'location_update',
--     'page_view',
--     'forecast_interaction',
--     'session_action',
--     'profile_update',
--     'onboarding_step',
--     'cta_click',
--     'review_form_open',
--     'review_form_abandon',
--     'review_validation_error',
--     'review_submit'
--   )
-- );
--
-- NOTE: Before rolling back, ensure no rows exist with the new event types:
-- SELECT COUNT(*) FROM public.user_events WHERE event_type IN (
--   'tab_view', 'map_interaction',
--   'social_follow', 'social_like', 'social_share',
--   'social_invite_send', 'social_invite_respond', 'social_intel_confirm'
-- );
--
-- If rows exist, you must either:
-- 1. Delete them: DELETE FROM public.user_events WHERE event_type IN (
--      'tab_view', 'map_interaction', 'social_follow', 'social_like',
--      'social_share', 'social_invite_send', 'social_invite_respond', 'social_intel_confirm'
--    );
-- 2. Or archive them to a separate table before rollback
-- =============================================================================
