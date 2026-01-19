-- ML Model Validation Queries
-- Run these in Supabase SQL Editor to check model performance

-- ============================================================
-- 1. Check current prediction status
-- ============================================================
SELECT
  model_version,
  COUNT(*) as total_predictions,
  COUNT(observed_m) as with_observations,
  MIN(predicted_at) as earliest,
  MAX(predicted_at) as latest
FROM ml_predictions_log
WHERE predicted_at > now() - interval '7 days'
GROUP BY model_version
ORDER BY latest DESC;

-- ============================================================
-- 2. Get weekly metrics (if observations are matched)
-- ============================================================
SELECT * FROM get_ml_weekly_metrics();

-- ============================================================
-- 3. Match recent predictions with buoy observations
-- This updates ml_predictions_log with ground truth from marine_forecasts
-- ============================================================
WITH recent_predictions AS (
  SELECT
    p.id,
    p.beach_id,
    p.predicted_at,
    p.raw_forecast_m,
    p.corrected_forecast_m
  FROM ml_predictions_log p
  WHERE p.observed_m IS NULL
    AND p.predicted_at < now() - interval '1 hour'  -- Give time for observations to arrive
    AND p.predicted_at > now() - interval '48 hours' -- Only recent predictions
),
matched_observations AS (
  SELECT
    rp.id as prediction_id,
    rp.raw_forecast_m,
    rp.corrected_forecast_m,
    mf.wave_height_m as observed_m,
    ABS(EXTRACT(EPOCH FROM (mf.ts - rp.predicted_at))) as time_diff_seconds
  FROM recent_predictions rp
  JOIN marine_forecasts mf
    ON mf.beach_id = rp.beach_id
    AND mf.is_observed = true
    AND mf.wave_height_m IS NOT NULL
    AND mf.ts BETWEEN rp.predicted_at - interval '2 hours'
                  AND rp.predicted_at + interval '2 hours'
),
best_matches AS (
  SELECT DISTINCT ON (prediction_id)
    prediction_id,
    observed_m,
    raw_forecast_m,
    corrected_forecast_m
  FROM matched_observations
  ORDER BY prediction_id, time_diff_seconds ASC
)
UPDATE ml_predictions_log p
SET
  observed_m = bm.observed_m,
  raw_error_m = ABS(bm.raw_forecast_m - bm.observed_m),
  corrected_error_m = ABS(bm.corrected_forecast_m - bm.observed_m)
FROM best_matches bm
WHERE p.id = bm.prediction_id;

-- ============================================================
-- 4. After running #3, check metrics again
-- ============================================================
SELECT
  model_version,
  COUNT(*) as predictions,
  COUNT(observed_m) as with_ground_truth,
  ROUND(AVG(raw_error_m)::numeric, 3) as avg_raw_error_m,
  ROUND(AVG(corrected_error_m)::numeric, 3) as avg_corrected_error_m,
  ROUND(AVG(raw_error_m - corrected_error_m)::numeric, 3) as avg_improvement_m,
  ROUND(100.0 * COUNT(*) FILTER (WHERE corrected_error_m < raw_error_m) /
        NULLIF(COUNT(observed_m), 0), 1) as pct_improved
FROM ml_predictions_log
WHERE predicted_at > now() - interval '7 days'
GROUP BY model_version
ORDER BY model_version DESC;

-- ============================================================
-- 5. Detailed per-beach performance (top 10 beaches by predictions)
-- ============================================================
SELECT
  b.name as beach_name,
  p.model_version,
  COUNT(*) as predictions,
  COUNT(p.observed_m) as matched,
  ROUND(AVG(p.raw_error_m)::numeric, 2) as raw_err_m,
  ROUND(AVG(p.corrected_error_m)::numeric, 2) as corr_err_m,
  ROUND(AVG(p.raw_error_m - p.corrected_error_m)::numeric, 2) as improvement_m
FROM ml_predictions_log p
JOIN beaches b ON b.id = p.beach_id
WHERE p.predicted_at > now() - interval '7 days'
  AND p.observed_m IS NOT NULL
GROUP BY b.name, p.model_version
HAVING COUNT(p.observed_m) >= 5
ORDER BY COUNT(*) DESC
LIMIT 10;
