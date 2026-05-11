-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

ALTER TABLE ml_predictions_log
  ADD COLUMN IF NOT EXISTS ml_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ml_predictions_log.ml_skipped IS
  'True when the ML correction was effectively skipped for this row '
  '(small-wave passthrough, noise-threshold zeroing, or zero-bias prediction). '
  'Surfaced in UI so users know the ML had no effect on the displayed forecast.';

NOTIFY pgrst, 'reload schema';
