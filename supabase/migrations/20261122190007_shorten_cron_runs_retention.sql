BEGIN;

-- Keep 30 days of cron_runs instead of 60. The daily brief and health checks
-- read at most 30 days. Same schedule and the same 50,000-row cap per run.
SELECT cron.schedule(
  'prune-cron-runs',
  '45 11 * * *',
  $cron$
  DELETE FROM public.cron_runs WHERE id IN (
    SELECT id FROM public.cron_runs
    WHERE started_at < now() - interval '30 days'
    ORDER BY started_at LIMIT 50000
  );
  $cron$
);

COMMIT;
