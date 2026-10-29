-- Lighten the evening load that preceded the 2026-10-28 prod DB crash
-- (memory exhaustion on a 1 GB instance).
--
-- 1. cleanup-ml-predictions ran at 03:00 UTC (20:00 PT, the read peak) and
--    scans all of ml_predictions_log; it was running at the crash. Move it to
--    05:40 UTC, after the 05:00 prune and 05:05 sync, before the 06:00 burst.
-- 2. refresh-observable-beaches (daily 06:00 UTC) calls the same function as
--    refresh-observable-beaches-hourly (:25 every hour), so it adds nothing.
-- 3. Four indexes duplicate a unique index on the same leading columns, so
--    every write maintains two copies for no read benefit.
-- 4. ml_predictions_log (0 HOT updates), cron_runs and user_events waited for
--    20% dead rows before vacuuming. Vacuum at ~2%, as for the forecast tables
--    in 20261029140000.
--
-- Rollback:
--   SELECT cron.alter_job(jobid, schedule := '0 3 * * *') FROM cron.job WHERE jobname = 'cleanup-ml-predictions';
--   SELECT cron.schedule('refresh-observable-beaches', '0 6 * * *', 'SELECT refresh_observable_beaches()');
--   CREATE INDEX idx_ef_beach_forecast_at ON public.enhanced_forecasts (beach_id, forecast_at);
--   CREATE INDEX idx_rip_current_risks_beach_date ON public.rip_current_risks (beach_id, valid_date);
--   CREATE INDEX idx_sun_times_beach_date ON public.sun_times (beach_id, date);
--   CREATE INDEX county_beach_advisories_run_idx ON public.county_beach_advisories (run_id);
--   ALTER TABLE public.ml_predictions_log RESET (autovacuum_vacuum_scale_factor);
--   ALTER TABLE public.cron_runs RESET (autovacuum_vacuum_scale_factor);
--   ALTER TABLE public.user_events RESET (autovacuum_vacuum_scale_factor);

BEGIN;

-- DROP INDEX briefly takes an exclusive lock on busy tables; fail fast instead of queueing reads.
SET LOCAL lock_timeout = '2s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.alter_job(jobid, schedule := '40 5 * * *')
    FROM cron.job
    WHERE jobname = 'cleanup-ml-predictions';

    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'refresh-observable-beaches';
  ELSE
    RAISE NOTICE 'pg_cron not available; cron schedules left unchanged';
  END IF;
END $$;

-- Each is covered by a unique index with the same leading columns:
-- enhanced_forecasts_beach_forecast_at_unique, rip_current_risks_beach_id_valid_date_key,
-- sun_times_unique (beach_id, date, source), and
-- county_beach_advisories_run_id_source_site_identifier_advis_key (run_id, ...).
DROP INDEX IF EXISTS public.idx_ef_beach_forecast_at;
DROP INDEX IF EXISTS public.idx_rip_current_risks_beach_date;
DROP INDEX IF EXISTS public.idx_sun_times_beach_date;
DROP INDEX IF EXISTS public.county_beach_advisories_run_idx;

ALTER TABLE public.ml_predictions_log SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE public.cron_runs SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE public.user_events SET (autovacuum_vacuum_scale_factor = 0.02);

COMMIT;
