-- Widen user_events.event_type CHECK for the canonical north-star session-created event.
--
-- Preserve the live CHECK expression dynamically so this stays additive after
-- parallel event additions and no-ops when the event is already present.

BEGIN;

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY['session_created'];
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
  WHERE current_check !~ ('(^|[^[:alnum:]_])' || event_name || '([^[:alnum:]_]|$)');

  IF missing_events IS NULL OR array_length(missing_events, 1) IS NULL THEN
    RAISE NOTICE 'Session-created event already present; no change.';
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
