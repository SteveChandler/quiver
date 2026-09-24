-- Accept the native Home hero swipe event (sent by iOS 1.0.2+ and Android 1.0.3; rejected since launch) while preserving every event
-- currently allowed by the live CHECK constraint.

BEGIN;

DO $$
DECLARE
  current_check text;
BEGIN
  SELECT regexp_replace(pg_get_constraintdef(oid), '^CHECK \((.*)\)$', '\1')
    INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.user_events'::regclass
    AND conname = 'user_events_event_type_check';

  IF current_check IS NULL THEN
    RAISE EXCEPTION 'user_events_event_type_check constraint not found';
  END IF;

  IF current_check ~ '(^|[^[:alnum:]_])home_hero_swiped([^[:alnum:]_]|$)' THEN
    RETURN;
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = %L)',
    current_check,
    'home_hero_swiped'
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
