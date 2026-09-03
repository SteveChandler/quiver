-- The stale-run sweep filters only unfinished runs; avoid scanning completed history.
-- Rollback: DROP INDEX IF EXISTS public.idx_cron_runs_started_at_started;
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at_started
  ON public.cron_runs (started_at)
  WHERE status = 'started';

COMMIT;
