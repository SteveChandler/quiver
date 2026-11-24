BEGIN;

-- Restore the 60-day schedule. Previously pruned rows require a backup to recover.
SELECT cron.schedule(
  'prune-cron-runs',
  '45 11 * * *',
  $cron$
  DELETE FROM public.cron_runs WHERE id IN (
    SELECT id FROM public.cron_runs
    WHERE started_at < now() - interval '60 days'
    ORDER BY started_at LIMIT 50000
  );
  $cron$
);

COMMIT;
