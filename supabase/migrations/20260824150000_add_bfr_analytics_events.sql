-- Add the Phase 20.1 beach-follow and native watched-call measurement events
-- while preserving every event already accepted by the live CHECK expression.

BEGIN;

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY[
    'beach_follow_started',
    'beach_follow_saved_local',
    'beach_follow_sync_started',
    'beach_follow_sync_completed',
    'follow_topic_changed',
    'visitor_intent_selected',
    'surf_intent_qualified',
    'my_coast_viewed',
    'my_coast_beach_opened',
    'watched_call_created',
    'watched_call_already_exists',
    'watched_call_update_eligible',
    'watched_call_update_suppressed',
    'watched_call_update_delivered',
    'watched_call_update_opened',
    'watched_call_manual_reopened',
    'watched_call_context_resolved',
    'home_mode_restored',
    'home_mode_expired',
    'home_recommendation_changed'
  ];
  missing_events text[];
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  SELECT array_agg(event_name ORDER BY ord)
    INTO missing_events
  FROM unnest(candidate_events) WITH ORDINALITY AS candidate(event_name, ord)
  WHERE current_check !~ (
    '(^|[^[:alnum:]_])' || event_name || '([^[:alnum:]_]|$)'
  );

  IF missing_events IS NULL OR array_length(missing_events, 1) IS NULL THEN
    RAISE NOTICE 'All BFR analytics events already present; no change.';
    RETURN;
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
    current_check,
    missing_events
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
