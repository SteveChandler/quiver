-- Idempotent dedup index for alert_queue.
--
-- HISTORY: This migration was committed (abda2124) with a timestamp
-- (20260401000001) that places it BEFORE the migration that creates
-- alert_queue (20260408163000_add_condition_alerts.sql, Apr 8 2026).
-- That timestamp ordering broke `supabase db reset` locally because the
-- index references a table that does not yet exist at apply time.
--
-- Wrapped in a guard so local replay skips cleanly when the table is not
-- yet present; prod replay (where alert_queue already existed when this
-- migration was first applied) is unaffected. A follow-up migration with
-- a timestamp AFTER alert_queue creation re-asserts the index so a fresh
-- local DB still ends up with it.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.alert_queue') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_queue_rule_dedup
      ON alert_queue(rule_id, alert_date, window_start);
  END IF;
END $$;

COMMIT;
