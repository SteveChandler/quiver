-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Delete duplicates keeping the row with ground truth or latest
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY beach_id, predicted_at
    ORDER BY
      CASE WHEN observed_m IS NOT NULL AND observed_m > 0 THEN 0 ELSE 1 END,
      created_at DESC
  ) AS rn
  FROM ml_predictions_log
)
DELETE FROM ml_predictions_log WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Add unique index for ON CONFLICT support
CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_predictions_beach_predicted_at_unique
  ON ml_predictions_log(beach_id, predicted_at);
