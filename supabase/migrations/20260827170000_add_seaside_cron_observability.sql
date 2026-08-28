-- Durable execution history for Seaside jobs; Sentry Cron handles alerting.

BEGIN;

CREATE TABLE IF NOT EXISTS public.seaside_cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  row_count bigint CHECK (row_count IS NULL OR row_count >= 0),
  peak_memory_mb numeric CHECK (peak_memory_mb IS NULL OR peak_memory_mb >= 0),
  error_message text,
  CONSTRAINT seaside_cron_runs_completion_check CHECK (
    (status = 'running' AND finished_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND finished_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_seaside_cron_runs_job_started
  ON public.seaside_cron_runs (job_id, started_at DESC);

ALTER TABLE public.seaside_cron_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.seaside_cron_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seaside_cron_runs TO service_role;

COMMENT ON TABLE public.seaside_cron_runs IS
  'Durable Fly cron execution ledger, including outcome, row count, duration, and peak RSS.';
COMMIT;
