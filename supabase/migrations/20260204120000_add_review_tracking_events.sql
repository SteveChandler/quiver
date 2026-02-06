-- Migration: Add review tracking event types
-- Description: Expands user_events event_type check constraint to include review tracking events
-- Date: 2026-02-04
--
-- New event types added:
--   - review_form_open: Tracked when a user opens the review form (from overview CTA, reviews tab, or post-session prompt)
--   - review_form_abandon: Tracked when a user closes/cancels the review form without submitting
--   - review_validation_error: Tracked when form validation fails (missing ratings or content)
--   - review_submit: Tracked when a review is successfully submitted
--
-- Expected metadata schema (ReviewFormMetadata):
--   {
--     "source": "overview_cta" | "reviews_tab" | "post_session",
--     "beach_id": string,
--     "beach_name"?: string,
--     "duration_ms"?: number,
--     "error_type"?: "missing_ratings" | "missing_content",
--     "is_edit"?: boolean
--   }

-- Drop existing constraint and add expanded one with review tracking events
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (
  event_type IN (
    -- Existing implicit preference learning events
    'beach_view',
    'discovery_click',
    'discovery_skip',
    'forecast_check',
    'location_update',
    -- Existing engagement tracking events
    'page_view',
    'forecast_interaction',
    'session_action',
    'profile_update',
    'onboarding_step',
    'cta_click',
    -- New review tracking events
    'review_form_open',
    'review_form_abandon',
    'review_validation_error',
    'review_submit'
  )
);

-- Add comment documenting the new event types
COMMENT ON CONSTRAINT user_events_event_type_check ON public.user_events IS
  'Validates event types including review tracking events (review_form_open, review_form_abandon, review_validation_error, review_submit)';

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
--     'cta_click'
--   )
-- );
--
-- NOTE: Before rolling back, ensure no rows exist with the review event types:
-- SELECT COUNT(*) FROM public.user_events WHERE event_type IN (
--   'review_form_open', 'review_form_abandon', 'review_validation_error', 'review_submit'
-- );
--
-- If rows exist, you must either:
-- 1. Delete them: DELETE FROM public.user_events WHERE event_type LIKE 'review_%';
-- 2. Or archive them to a separate table before rollback
-- =============================================================================
