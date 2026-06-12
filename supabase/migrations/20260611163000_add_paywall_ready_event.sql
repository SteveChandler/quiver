-- Add paywall readiness instrumentation to user_events.event_type.
--
-- Native writes this directly through Supabase after RevenueCat offering
-- resolution, so it must be accepted by the DB CHECK as well as the API
-- allowlist. Preserve the live CHECK expression dynamically so prior
-- web/native additions remain accepted.

BEGIN;

DO $$
DECLARE
  current_check text;
  paywall_ready_event_types text[] := ARRAY[
    'paywall_ready'
  ];
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
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
    current_check,
    paywall_ready_event_types
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
