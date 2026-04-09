-- Backfilled from remote supabase_migrations.schema_migrations on 2026-04-08
-- to reconcile drift from a parallel branch that applied directly to prod.
-- This migration was already applied to prod on 2026-04-08 16:31:16 UTC.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_queue_rule_dedup
  ON alert_queue(rule_id, alert_date, window_start);

COMMIT;
