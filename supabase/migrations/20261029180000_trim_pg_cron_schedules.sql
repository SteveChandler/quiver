-- Trim pg_cron work that repeats or feeds nothing (2026-10-29 cron audit, after
-- the 2026-10-28 memory-exhaustion crash).
--
-- 1. refresh-observable-beaches-hourly (~486k buffer reads a run) reads
--    ioos_observations and ndbc_direct_observations, which only change on even
--    hours (ndbc-direct-sync :30, ioos-sync :35, every 2 h). Run at :45 on even
--    hours: half the runs, and anchors land ~10 min after each ingest.
-- 2. refresh-beach-ml-baseline refreshes beach_ml_performance_baseline, whose only
--    readers (get_beach_ml_performance, get_worst_performing_beaches) have no
--    callers in quiver, quiver-native or seaside.
-- 3. Move the two retention deletes out of the 01:00-10:00 UTC read peak.
--
-- Rollback:
--   SELECT cron.alter_job(jobid, schedule := '25 * * * *') FROM cron.job WHERE jobname = 'refresh-observable-beaches-hourly';
--   SELECT cron.schedule('refresh-beach-ml-baseline', '0 7 * * *', 'SELECT public.refresh_beach_ml_baseline();');
--   SELECT cron.alter_job(jobid, schedule := '0 5 * * *') FROM cron.job WHERE jobname = 'prune_forecasts_retention';
--   SELECT cron.alter_job(jobid, schedule := '0 9 * * *') FROM cron.job WHERE jobname = 'prune-marine-forecasts';

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.alter_job(jobid, schedule := '45 */2 * * *')
    FROM cron.job WHERE jobname = 'refresh-observable-beaches-hourly';

    PERFORM cron.unschedule(jobname)
    FROM cron.job WHERE jobname = 'refresh-beach-ml-baseline';

    PERFORM cron.alter_job(jobid, schedule := '0 11 * * *')
    FROM cron.job WHERE jobname = 'prune_forecasts_retention';

    PERFORM cron.alter_job(jobid, schedule := '30 11 * * *')
    FROM cron.job WHERE jobname = 'prune-marine-forecasts';
  ELSE
    RAISE NOTICE 'pg_cron not available; cron schedules left unchanged';
  END IF;
END $$;

COMMIT;
