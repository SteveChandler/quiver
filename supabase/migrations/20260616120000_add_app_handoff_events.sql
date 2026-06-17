-- Widen user_events.event_type CHECK to accept the six app-first landing
-- handoff funnel events. Preserve the live CHECK expression dynamically so
-- prior web/native event additions remain accepted.

BEGIN;

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY[
    'app_handoff_view',
    'app_handoff_qr_rendered',
    'app_handoff_email_submit',
    'app_handoff_email_sent',
    'app_handoff_email_failed',
    'app_handoff_link_opened'
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

  SELECT array_agg(event_name)
    INTO missing_events
  FROM unnest(candidate_events) AS event_name
  WHERE current_check NOT LIKE '%' || event_name || '%';

  IF missing_events IS NULL OR array_length(missing_events, 1) IS NULL THEN
    RAISE NOTICE 'app_handoff events already present; no change.';
    RETURN;
  END IF;

  ALTER TABLE public.user_events
    DROP CONSTRAINT user_events_event_type_check;

  EXECUTE format(
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK (%s OR event_type IN (%s))',
    current_check,
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(candidate_events) AS e)
  );
END $$;

COMMIT;
