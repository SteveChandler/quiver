-- Add Phase 22 native forecast-visual and custom-spot analytics events to user_events.event_type.
--
-- Native writes these directly through Supabase. Preserve the live CHECK
-- expression dynamically so prior web/native additions remain accepted.
--
-- Without this migration, inserts for these four event types fail the CHECK
-- constraint silently (the analytics.ts fire-and-forget path swallows them),
-- resulting in zero rows in production despite active call sites.

BEGIN;

DO $$
DECLARE
  current_check text;
  phase22_event_types text[] := ARRAY[
    'custom_spot_save_confirmation_viewed',
    'custom_spot_forecast_source_viewed',
    'forecast_visual_layer_selected',
    'synced_forecast_time_selected'
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
    phase22_event_types
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
