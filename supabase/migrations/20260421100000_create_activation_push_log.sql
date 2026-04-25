-- Migration: Create activation_push_log for activation-nudge push idempotency
--
-- Generic per-user, per-nudge-type idempotency log for activation pushes.
-- First consumer: /api/cron/first-session-nudge-push (Day-7 habit-formation
-- nudge for users with <3 sessions). Composite PK (user_id, nudge_type)
-- guarantees re-runs never double-push for the same nudge.
--
-- nudge_type is an unconstrained text column (NOT an enum) so future
-- activation nudges (first_share_day14, first_follow_day21, etc.) slot in
-- without a schema change. Keep values kebab_snake_case.
--
-- Paired with Day-12 trial-ending push log (migration 20260421000000)
-- which lives in a separate table — trial lifecycle is a distinct domain
-- and the row shape differs (trial_ends_at column).
--
-- Rollback:
--   DROP TABLE IF EXISTS public.activation_push_log CASCADE;

BEGIN;

CREATE TABLE IF NOT EXISTS public.activation_push_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, nudge_type)
);

COMMENT ON TABLE public.activation_push_log IS
  'Per-user, per-nudge-type activation push idempotency log. One row = one push ever for that (user, nudge_type) pair.';

COMMENT ON COLUMN public.activation_push_log.nudge_type IS
  'Kebab-snake identifier for the nudge campaign (e.g. first_session_day7, first_share_day14).';

ALTER TABLE public.activation_push_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own log rows (diagnostic / settings screens).
CREATE POLICY "Users can read own activation push log"
  ON public.activation_push_log FOR SELECT
  USING (auth.uid() = user_id);

-- Writes are service-role only (cron).
CREATE POLICY "Service role manages activation push log"
  ON public.activation_push_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- sent_at index supports "how many sent today" observability queries.
CREATE INDEX idx_activation_push_log_sent_at
  ON public.activation_push_log(sent_at DESC);

-- nudge_type index supports per-campaign rollups without scanning sent_at.
CREATE INDEX idx_activation_push_log_nudge_type
  ON public.activation_push_log(nudge_type);

COMMIT;
