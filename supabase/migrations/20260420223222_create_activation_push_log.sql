-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Generic per-user, per-nudge-type idempotency log for activation pushes.
-- First consumer: /api/cron/first-session-nudge-push (Day-7 <3-session nudge).
-- nudge_type is unconstrained text so future nudges (first_share_day14, etc.) slot in.
-- Rollback: DROP TABLE IF EXISTS public.activation_push_log CASCADE;

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

CREATE POLICY "Users can read own activation push log"
  ON public.activation_push_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages activation push log"
  ON public.activation_push_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_activation_push_log_sent_at
  ON public.activation_push_log(sent_at DESC);

CREATE INDEX idx_activation_push_log_nudge_type
  ON public.activation_push_log(nudge_type);
