-- Fix backfill_ml_observations_batch to use unified_wave_observations
-- Problem: The original function queried marine_forecasts which doesn't include
-- IOOS data. This caused ~94% of predictions to fail matching with observations.
--
-- Changes:
-- 1. EXISTS check now queries unified_wave_observations
-- 2. obs_height SELECT now queries unified_wave_observations
-- 3. Column names: beach_id → nearest_beach_id, ts → observed_at
-- 4. Removed is_observed filter (unified view only contains observations)

BEGIN;

-- ==============================================================================
-- Function: backfill_ml_observations_batch (UPDATED)
-- Purpose: Match ML predictions with actual observations for ground truth
-- ==============================================================================
CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 500)
RETURNS TABLE(processed INT, matched INT, elapsed_ms NUMERIC) AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  pred RECORD;
  obs_height NUMERIC;
  match_count INT := 0;
  process_count INT := 0;
BEGIN
  -- Process pending predictions that:
  -- 1. Have no observed_m value (ground truth not yet matched)
  -- 2. Are older than 2 hours (allow time for observation data to arrive)
  -- 3. Are within 7 days (observations older than this are likely unavailable)
  -- 4. Are from beaches that have observation sources (via observable_beaches view)
  -- 5. Have a matching observation available (EXISTS check for efficiency)
  FOR pred IN
    SELECT p.id, p.beach_id, p.predicted_at, p.raw_forecast_m, p.corrected_forecast_m
    FROM ml_predictions_log p
    JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    WHERE p.observed_m IS NULL
      AND p.predicted_at < NOW() - INTERVAL '2 hours'
      AND p.predicted_at > NOW() - INTERVAL '7 days'
      AND EXISTS (
        -- FIXED: Query unified_wave_observations instead of marine_forecasts
        -- This includes IOOS data which is now our primary observation source
        SELECT 1 FROM unified_wave_observations uwo
        WHERE uwo.nearest_beach_id = p.beach_id
          AND uwo.wave_height_m IS NOT NULL
          AND uwo.observed_at BETWEEN p.predicted_at - INTERVAL '1 hour' AND p.predicted_at + INTERVAL '1 hour'
      )
    ORDER BY p.predicted_at DESC  -- Process newest first (most likely to have obs)
    LIMIT batch_size
  LOOP
    process_count := process_count + 1;

    -- Find matching observation within ±1 hour window
    -- Takes the earliest observation in the window for consistency
    -- FIXED: Query unified_wave_observations instead of marine_forecasts
    SELECT wave_height_m INTO obs_height
    FROM unified_wave_observations
    WHERE nearest_beach_id = pred.beach_id
      AND wave_height_m IS NOT NULL
      AND observed_at BETWEEN pred.predicted_at - INTERVAL '1 hour'
                      AND pred.predicted_at + INTERVAL '1 hour'
    ORDER BY observed_at ASC
    LIMIT 1;

    IF obs_height IS NOT NULL THEN
      UPDATE ml_predictions_log
      SET observed_m = obs_height,
          raw_error_m = ABS(raw_forecast_m - obs_height),
          corrected_error_m = ABS(corrected_forecast_m - obs_height)
      WHERE id = pred.id;
      match_count := match_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    process_count,
    match_count,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backfill_ml_observations_batch(INT) IS
  'Matches ML predictions with observed wave heights for ground truth validation.
   Uses unified_wave_observations (includes IOOS data) instead of marine_forecasts.
   Returns count of processed/matched predictions and elapsed time in ms.
   Fixed Jan 2026 to use correct observation source.';

COMMIT;
