-- Add native session custom-spot search-miss funnel events to user_events.event_type.
--
-- Phase 19 native emits these rows directly through Supabase so production
-- analytics can distinguish a missing spot search, the add-spot CTA tap, and
-- the return path that rehydrates the session draft after a custom spot is saved.

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
    'ALTER TABLE public.user_events ADD CONSTRAINT user_events_event_type_check CHECK ((%s) OR event_type = ANY (ARRAY[%L::text, %L::text, %L::text]))',
    current_check,
    'session_spot_search_no_results',
    'session_custom_spot_cta_tapped',
    'session_custom_spot_returned'
  );
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
