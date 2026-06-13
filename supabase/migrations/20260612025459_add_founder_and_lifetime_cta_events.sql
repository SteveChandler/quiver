-- Widen user_events.event_type CHECK to accept the founder-100 popup funnel
-- plus the paywall lifetime CTA event.
--
-- Supersedes two earlier files that never reached production:
--   * 20260611170000_add_paywall_lifetime_cta_event.sql  (stranded behind a
--     version collision with 20260611170000_create_gfs_wave_shadow_forecasts.sql)
--   * 20260611173000_add_founder_100_popup_events.sql     (never applied remotely)
-- Both are now redundant and should be removed from the repo.
--
-- Applied to production (project vawdnbbgawichorsjiwe) as version 20260612025459
-- via MCP apply_migration on 2026-06-11. Idempotent: only appends event types
-- not already present, so it is safe to re-run anywhere.

BEGIN;

DO $$
DECLARE
  current_check text;
  candidate_events text[] := ARRAY[
    'founder_100_popup_viewed',
    'founder_100_popup_cta_tapped',
    'founder_100_popup_dismissed',
    'paywall_lifetime_cta_tapped'
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

  SELECT array_agg(e)
    INTO missing_events
  FROM unnest(candidate_events) AS e
  WHERE current_check NOT LIKE '%' || e || '%';

  IF missing_events IS NULL OR array_length(missing_events, 1) IS NULL THEN
    RAISE NOTICE 'All founder/lifetime events already present; no change.';
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
