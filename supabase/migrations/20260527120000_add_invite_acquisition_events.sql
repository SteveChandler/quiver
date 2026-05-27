-- Add invite acquisition funnel events to user_events.event_type CHECK allowlist.

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

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (ARRAY[%L::text, %L::text, %L::text, %L::text, %L::text]))',
    current_check,
    'invite_link_opened',
    'invite_open_app_clicked',
    'invite_app_store_clicked',
    'invite_continue_web_clicked',
    'invite_consumed'
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
