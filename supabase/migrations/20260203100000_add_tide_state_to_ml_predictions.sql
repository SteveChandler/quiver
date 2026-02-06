-- Add tide state columns to ml_predictions_log for tide-aware ML predictions
-- Part of Phase 2: ML pipeline improvements
--
-- Tide state categories:
-- - 'low': < 0.5m above MLLW (Mean Lower Low Water)
-- - 'mid': 0.5-1.5m above MLLW
-- - 'high': > 1.5m above MLLW
--
-- These columns will help the model learn tidal influences on wave height predictions

BEGIN;

-- Add tide state enum-constrained column
ALTER TABLE ml_predictions_log
  ADD COLUMN tide_state TEXT
  CHECK (tide_state IN ('low', 'mid', 'high'));

-- Add actual tide height in meters
ALTER TABLE ml_predictions_log
  ADD COLUMN tide_height_m NUMERIC(4,2);

-- Add comments for documentation
COMMENT ON COLUMN ml_predictions_log.tide_state IS
  'Categorical tide state at prediction time: low (<0.5m), mid (0.5-1.5m), high (>1.5m) above MLLW';

COMMENT ON COLUMN ml_predictions_log.tide_height_m IS
  'Actual tide height in meters above MLLW at prediction time';

-- Create partial index on tide_state for filtering predictions by tide conditions
-- Only index non-null values since existing rows will be NULL
CREATE INDEX idx_ml_predictions_tide_state
  ON ml_predictions_log(tide_state)
  WHERE tide_state IS NOT NULL;

-- Create index for range queries on tide height
CREATE INDEX idx_ml_predictions_tide_height
  ON ml_predictions_log(tide_height_m)
  WHERE tide_height_m IS NOT NULL;

-- Composite index for beach + tide analysis
CREATE INDEX idx_ml_predictions_beach_tide
  ON ml_predictions_log(beach_id, tide_state, predicted_at DESC)
  WHERE tide_state IS NOT NULL;

COMMIT;
