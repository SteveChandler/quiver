-- Add Session Intelligence measurement events to user_events.event_type CHECK.
--
-- Preserve the live CHECK expression dynamically so existing web, native, and
-- prior additive events remain accepted.

BEGIN;

DO $$
DECLARE
  current_check text;
  session_intelligence_event_types text[] := ARRAY[
    'app_deeplink_clicked',
    'forecast_accuracy_table_viewed',
    'save_alert_clicked',
    'seo_intent_page_window_clicked',
    'surf_window_click',
    'surf_window_impression',
    'why_this_call_opened'
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
    session_intelligence_event_types
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
