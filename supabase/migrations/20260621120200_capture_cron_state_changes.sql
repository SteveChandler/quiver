-- Persist two pg_cron state changes already applied to prod (2026-06-21) so a
-- rebuild from migrations matches prod:
--   1. Unschedule ml-backfill-observations. backfill_ml_observations_batch was a
--      redundant duplicate of seaside's backfill_observations cron (wider +-12h
--      window, hourly) and ran every 10 min (~14% of total DB time). Migration
--      20260209050730 still SCHEDULES it, so without this a rebuild resurrects it.
--   2. Schedule prune-marine-forecasts. Nightly retention deleting stale forecast
--      snapshots (is_observed=false older than 14 days) that bloated the table and
--      dragged cache-hit to ~64%. Observations (is_observed=true) are preserved.
-- Idempotent: safe to re-run; reflects current prod state.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    -- 1. Remove the redundant ML backfill cron
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations') THEN
      PERFORM cron.unschedule('ml-backfill-observations');
    END IF;

    -- 2. (Re)schedule the marine_forecasts retention cron
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-marine-forecasts') THEN
      PERFORM cron.unschedule('prune-marine-forecasts');
    END IF;
    PERFORM cron.schedule(
      'prune-marine-forecasts',
      '0 9 * * *',
      $cron$DELETE FROM marine_forecasts WHERE is_observed = false AND ts < now() - interval '14 days'$cron$
    );
  END IF;
END $$;

COMMIT;
