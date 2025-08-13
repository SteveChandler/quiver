-- Rollback for mv_best_times and its refresh schedule

BEGIN;

-- Drop cron job if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_best_times_hourly'
    ) THEN
      PERFORM cron.unschedule('refresh_mv_best_times_hourly');
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not installed; skipping unschedule';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.refresh_mv_best_times();
DROP MATERIALIZED VIEW IF EXISTS public.mv_best_times;

COMMIT;
