-- cron_runs has kept every run since 2026-04-27 (~367k rows, 373 MB), ~80% of
-- them empty minutely notifications-deliver ticks. Keep 60 days: enough for the
-- monthly crons (ccc-sync, water-quality stations) to keep a previous run, and
-- for the 7-30 day ops reads (swell-watch daily check, cron audits).
--
-- ponytail: one bounded DELETE a day (50k rows, oldest first) drains the
-- ~4-month backlog over a few days without a large one-off delete on the 1 GB
-- instance. It seq-scans the table once a day at 11:45 UTC, outside the read
-- peak; add a started_at index only if that shows up.
--
-- Rollback:
--   SELECT cron.unschedule('prune-cron-runs');

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'prune-cron-runs';

    PERFORM cron.schedule(
      'prune-cron-runs',
      '45 11 * * *',
      $cron$DELETE FROM public.cron_runs WHERE id IN (SELECT id FROM public.cron_runs WHERE started_at < now() - interval '60 days' ORDER BY started_at LIMIT 50000)$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; cron_runs retention was not scheduled';
  END IF;
END $$;

COMMIT;
