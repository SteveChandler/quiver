-- Migration: Add forecast horizon tracking to ML predictions log
-- Part of ML Rolling Pipeline Phase 2 (docs/plans/2026-02-01-ml-rolling-pipeline-design.md)
--
-- Purpose:
-- - Track how far ahead predictions were made (0-168 hours)
-- - Enable analysis of prediction accuracy by lead time
-- - Allow ML model to learn horizon-specific correction patterns
--
-- Background:
-- Forecast accuracy typically degrades with lead time:
-- - 0-24h:   Day 1 forecast (most accurate)
-- - 24-48h:  Day 2 forecast
-- - 48-72h:  Day 3 forecast
-- - 72-168h: Extended forecast (least accurate)
--
-- The ML model can learn to apply different correction strategies based on
-- forecast horizon, improving accuracy across all lead times.

BEGIN;

-- =============================================================================
-- ADD COLUMN: forecast_horizon_hours
-- =============================================================================
-- Nullable column - existing rows will have NULL values until backfilled
-- or future predictions populate this field

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS forecast_horizon_hours INTEGER;

-- Add check constraint to ensure valid range (0 to 7 days)
ALTER TABLE public.ml_predictions_log
  ADD CONSTRAINT ml_predictions_log_forecast_horizon_range
    CHECK (forecast_horizon_hours >= 0 AND forecast_horizon_hours <= 168);

-- Add index for analyzing accuracy by lead time
-- This enables queries like: "What's the average error for 48-hour forecasts?"
CREATE INDEX IF NOT EXISTS idx_ml_predictions_log_forecast_horizon
  ON public.ml_predictions_log(forecast_horizon_hours)
  WHERE forecast_horizon_hours IS NOT NULL;

-- Add composite index for horizon-based accuracy analysis per beach
CREATE INDEX IF NOT EXISTS idx_ml_predictions_log_beach_horizon
  ON public.ml_predictions_log(beach_id, forecast_horizon_hours)
  WHERE forecast_horizon_hours IS NOT NULL AND observed_m IS NOT NULL;

-- Add column comment
COMMENT ON COLUMN public.ml_predictions_log.forecast_horizon_hours IS
  'Number of hours ahead the forecast was made (0-168). Enables accuracy analysis by lead time. 0 = nowcast, 24 = day-ahead, 168 = week-ahead. NULL for legacy predictions.';

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_ml_predictions_log_beach_horizon;
-- DROP INDEX IF EXISTS public.idx_ml_predictions_log_forecast_horizon;
-- ALTER TABLE public.ml_predictions_log DROP CONSTRAINT IF EXISTS ml_predictions_log_forecast_horizon_range;
-- ALTER TABLE public.ml_predictions_log DROP COLUMN IF EXISTS forecast_horizon_hours;
-- COMMIT;

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
--
-- 1. Insert prediction with forecast horizon:
--    INSERT INTO ml_predictions_log (
--      beach_id,
--      predicted_at,
--      raw_forecast_m,
--      corrected_forecast_m,
--      model_version,
--      forecast_horizon_hours  -- New field
--    ) VALUES (
--      '...',
--      now(),
--      1.5,
--      1.3,
--      'v3.20260203',
--      48  -- 48-hour forecast
--    );
--
-- 2. Analyze accuracy by forecast horizon:
--    SELECT
--      forecast_horizon_hours,
--      COUNT(*) AS predictions,
--      ROUND(AVG(raw_error_m)::numeric, 3) AS avg_raw_error,
--      ROUND(AVG(corrected_error_m)::numeric, 3) AS avg_corrected_error,
--      ROUND(100.0 * AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END)::numeric, 1) AS pct_improved
--    FROM ml_predictions_log
--    WHERE observed_m IS NOT NULL
--      AND forecast_horizon_hours IS NOT NULL
--    GROUP BY forecast_horizon_hours
--    ORDER BY forecast_horizon_hours;
--
-- 3. Compare performance across horizon buckets:
--    SELECT
--      CASE
--        WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h (Day 1)'
--        WHEN forecast_horizon_hours BETWEEN 25 AND 48 THEN '25-48h (Day 2)'
--        WHEN forecast_horizon_hours BETWEEN 49 AND 72 THEN '49-72h (Day 3)'
--        WHEN forecast_horizon_hours BETWEEN 73 AND 168 THEN '73-168h (Extended)'
--      END AS horizon_bucket,
--      COUNT(*) AS predictions,
--      ROUND(AVG(corrected_error_m)::numeric, 3) AS avg_error_m
--    FROM ml_predictions_log
--    WHERE observed_m IS NOT NULL
--      AND forecast_horizon_hours IS NOT NULL
--    GROUP BY horizon_bucket
--    ORDER BY MIN(forecast_horizon_hours);
