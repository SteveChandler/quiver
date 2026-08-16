-- UNAPPLIED FORWARD MIGRATION (2026-08-13)

BEGIN;

ALTER TABLE public.cron_runs
  ADD COLUMN IF NOT EXISTS job text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS produced integer,
  ADD COLUMN IF NOT EXISTS expected_min integer,
  ADD COLUMN IF NOT EXISTS expected_max integer,
  ADD COLUMN IF NOT EXISTS legitimately_zero_reason text,
  ADD COLUMN IF NOT EXISTS ran_at timestamptz NOT NULL DEFAULT now();

UPDATE public.cron_runs
SET job = route
WHERE job IS NULL;

ALTER TABLE public.cron_runs
  ALTER COLUMN job SET NOT NULL;

ALTER TABLE public.cron_runs
  DROP CONSTRAINT IF EXISTS cron_runs_status_check;

ALTER TABLE public.cron_runs
  ADD CONSTRAINT cron_runs_status_check
  CHECK (status IN ('started', 'ok', 'failed', 'error', 'timeout'));

CREATE INDEX IF NOT EXISTS cron_runs_job_ran_at_idx
  ON public.cron_runs (job, ran_at DESC);

NOTIFY pgrst, 'reload schema';

COMMIT;
