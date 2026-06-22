DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations') THEN
      PERFORM cron.unschedule('ml-backfill-observations');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-marine-forecasts') THEN
      PERFORM cron.unschedule('prune-marine-forecasts');
    END IF;
    PERFORM cron.schedule(
      'prune-marine-forecasts',
      '0 9 * * *',
      $cron$DELETE FROM marine_forecasts WHERE is_observed = false AND ts < now() - interval '14 days'$cron$
    );
  END IF;
END $$;;
