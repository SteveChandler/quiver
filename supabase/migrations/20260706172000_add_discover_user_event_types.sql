BEGIN;

-- Keep the DB event-type constraint in sync with the discover analytics events
-- accepted by app/api/events/route.ts.
DO $$
DECLARE
  current_check text;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO current_check
  FROM pg_constraint
  WHERE conname = 'user_events_event_type_check'
    AND conrelid = 'public.user_events'::regclass;

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (%s OR event_type = ANY (ARRAY[%L, %L, %L, %L]::text[]))',
    regexp_replace(current_check, '^CHECK \((.*)\)$', '\1'),
    'discover_page_view',
    'discover_suggested_users_impression',
    'discover_profile_open',
    'discover_follow_attempt'
  );
END $$;

COMMIT;
