-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Per-run observability for cron handlers. Without this we cannot tell
-- whether a cron failed silently vs ran with empty input — a gap that
-- hid the alerts-matcher bug for 30 days.
--
-- Spec: docs/archive/superpowers/specs/2026-04-27-alerts-matcher-fix-a4-design.md A4.1

BEGIN;

CREATE TABLE cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('started', 'ok', 'error', 'timeout')),
  summary jsonb,
  error_message text,
  duration_ms integer
);

CREATE INDEX cron_runs_route_started_idx ON cron_runs (route, started_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
-- service_role only — no policies. Cron handlers run as service_role.

COMMIT;
