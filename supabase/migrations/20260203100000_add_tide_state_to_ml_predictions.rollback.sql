-- Rollback: Remove tide state columns from ml_predictions_log
-- WARNING: This will permanently delete any tide data that has been logged

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_ml_predictions_beach_tide;
DROP INDEX IF EXISTS idx_ml_predictions_tide_height;
DROP INDEX IF EXISTS idx_ml_predictions_tide_state;

-- Drop columns
ALTER TABLE ml_predictions_log
  DROP COLUMN IF EXISTS tide_height_m;

ALTER TABLE ml_predictions_log
  DROP COLUMN IF EXISTS tide_state;

COMMIT;
