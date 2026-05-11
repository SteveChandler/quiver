-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- No duplicates exist (verified: 0 duplicate groups in 59845 rows)
-- Add unique index for ON CONFLICT upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_predictions_beach_predicted_at_unique
  ON ml_predictions_log(beach_id, predicted_at);
