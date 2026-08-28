-- Move the database-only observable beach refresh from Fly to pg_cron.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'refresh-observable-beaches-hourly';

    PERFORM cron.schedule(
      'refresh-observable-beaches-hourly',
      '25 * * * *',
      $cron$SELECT public.refresh_observable_beaches();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; observable beach refresh was not scheduled';
  END IF;
END $$;

COMMIT;
