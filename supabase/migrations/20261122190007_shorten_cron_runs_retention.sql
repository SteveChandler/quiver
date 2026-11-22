BEGIN;

-- pg_cron runs outside Vercel. Check the database setting on each invocation.
SELECT cron.schedule(
  'prune-cron-runs',
  '45 11 * * *',
  $cron$
  DO $prune$
  BEGIN
    IF current_setting('quiver.internal_log_reduction', true) = '1' THEN
      DELETE FROM public.cron_runs WHERE id IN (
        SELECT id FROM public.cron_runs
        WHERE started_at < now() - interval '30 days'
        ORDER BY started_at LIMIT 50000
      );
    ELSE
      DELETE FROM public.cron_runs WHERE id IN (
        SELECT id FROM public.cron_runs
        WHERE started_at < now() - interval '60 days'
        ORDER BY started_at LIMIT 50000
      );
    END IF;
  END;
  $prune$;
  $cron$
);

COMMIT;
