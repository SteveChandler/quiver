-- Adds an explicit ml_skipped flag to ml_predictions_log so consumers
-- (dashboards, UI) can tell when the ML correction had no effect on a row
-- (passthrough via small-wave taper, noise threshold, or zero prediction).
--
-- Prior state: corrected_forecast_m == raw_forecast_m was the implicit signal,
-- but that conflates "model said no bias" with "guardrails zeroed the bias".
-- Explicit flag removes the ambiguity.
--
-- Safety: NOT NULL DEFAULT false on PG 11+ is a metadata-only operation — no
-- table rewrite and no per-row backfill. Safe on the current ~36k-row 30d
-- window and the ~200k-row full table.
--
-- Rollback:
--   BEGIN;
--   ALTER TABLE ml_predictions_log DROP COLUMN IF EXISTS ml_skipped;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';

BEGIN;

ALTER TABLE ml_predictions_log
  ADD COLUMN IF NOT EXISTS ml_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ml_predictions_log.ml_skipped IS
  'True when the ML correction was effectively skipped for this row '
  '(small-wave passthrough, noise-threshold zeroing, or zero-bias prediction). '
  'Surfaced in UI so users know the ML had no effect on the displayed forecast.';

COMMIT;

-- Notify PostgREST to reload the schema cache so the new column is queryable
-- immediately. Must run outside the transaction.
NOTIFY pgrst, 'reload schema';
