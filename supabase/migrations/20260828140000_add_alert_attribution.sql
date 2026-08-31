BEGIN;

ALTER TABLE public.email_send_log
  ADD COLUMN message_instance_id uuid;

ALTER TABLE public.alert_delivery_attempts
  ADD COLUMN message_instance_id uuid;

CREATE UNIQUE INDEX email_send_log_message_instance_id_idx
  ON public.email_send_log (message_instance_id)
  WHERE message_instance_id IS NOT NULL;

CREATE INDEX alert_delivery_attempts_message_instance_id_idx
  ON public.alert_delivery_attempts (message_instance_id)
  WHERE message_instance_id IS NOT NULL;

CREATE UNIQUE INDEX user_events_alert_attribution_idempotency_idx
  ON public.user_events (
    user_id,
    event_type,
    (metadata ->> 'message_instance_id'),
    (COALESCE(metadata ->> 'action', ''))
  )
  WHERE event_type IN (
    'alert_message_activated',
    'alert_app_returned',
    'alert_return_to_decision',
    'alert_decision_action'
  )
    AND metadata ? 'message_instance_id';

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY[
    'alert_message_activated',
    'alert_app_returned',
    'alert_return_to_decision',
    'alert_decision_action'
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

  IF missing_events IS NOT NULL AND array_length(missing_events, 1) IS NOT NULL THEN
    ALTER TABLE public.user_events
      DROP CONSTRAINT user_events_event_type_check;

    EXECUTE format(
      'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (%L::text[]))',
      current_check,
      missing_events
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
