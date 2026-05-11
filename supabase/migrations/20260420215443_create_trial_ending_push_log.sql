-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Migration: Create trial_ending_push_log for Day-12 trial-ending push idempotency
-- Paired with /api/cron/trial-ending-push-deliver. One push per user whose
-- 14-day RevenueCat trial is ending in ~2 days.
-- Rollback: DROP TABLE IF EXISTS public.trial_ending_push_log CASCADE;

CREATE TABLE IF NOT EXISTS public.trial_ending_push_log (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.trial_ending_push_log IS
  'Day-12 trial-ending push idempotency log. One row per user = one push ever for this trial cycle.';

ALTER TABLE public.trial_ending_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trial-ending push log"
  ON public.trial_ending_push_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages trial-ending push log"
  ON public.trial_ending_push_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_trial_ending_push_log_sent_at
  ON public.trial_ending_push_log(sent_at DESC);
