-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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
