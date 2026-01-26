-- Migration: Create digest_run_stats table for tracking cron run execution statistics
-- Part of Delivery Monitoring Infrastructure feature

-- Stores summary statistics for each digest cron run
CREATE TABLE IF NOT EXISTS public.digest_run_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_started_at TIMESTAMPTZ NOT NULL,
  run_completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),

  -- Email metrics
  eligible_users INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  emails_sent_quick INT NOT NULL DEFAULT 0,

  -- Push metrics
  push_sent INT NOT NULL DEFAULT 0,
  push_failed INT NOT NULL DEFAULT 0,
  push_no_tokens INT NOT NULL DEFAULT 0,

  -- Skip reasons (JSONB for flexibility)
  skipped JSONB NOT NULL DEFAULT '{}',

  -- Performance
  duration_ms INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Service role only
ALTER TABLE public.digest_run_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public.digest_run_stats FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for querying recent runs
CREATE INDEX idx_digest_run_stats_started_at
  ON public.digest_run_stats (run_started_at DESC);

COMMENT ON TABLE public.digest_run_stats IS 'Tracks execution statistics for forecast-digest-email cron runs';
