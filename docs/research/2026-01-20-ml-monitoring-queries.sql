-- ML Model Health Monitoring Queries
-- Project: Quiver Surfing Application
-- Date: 2026-01-20
--
-- NOTE: These queries predate sentinel values (observed_m = -1). If re-running,
-- replace `COUNT(observed_m)` with `COUNT(*) FILTER (WHERE observed_m > 0)` and
-- `observed_m IS NOT NULL` with `observed_m > 0` to exclude sentinels.
--
-- These queries help monitor ML model performance and detect regressions early.
-- Run daily or integrate into monitoring dashboards.

-- ============================================================================
-- DAILY HEALTH CHECK
-- ============================================================================
-- Run this every morning to check if model is performing well
-- Alert if improvement_rate < 50% or avg_bias outside ±0.2m

SELECT
  model_version,
  COUNT(*) as predictions_24h,
  COUNT(observed_m) as with_ground_truth_24h,
  ROUND(AVG(raw_forecast_m)::numeric, 3) as avg_raw_m,
  ROUND(AVG(observed_m)::numeric, 3) as avg_observed_m,
  ROUND(AVG(corrected_forecast_m)::numeric, 3) as avg_corrected_m,
  ROUND(AVG(bias_applied_m)::numeric, 3) as avg_bias_m,
  ROUND(AVG(raw_error_m)::numeric, 3) as avg_raw_error_m,
  ROUND(AVG(corrected_error_m)::numeric, 3) as avg_corrected_error_m,
  ROUND(AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END)::numeric * 100, 1) as improvement_rate_pct,
  ROUND(AVG(CASE WHEN bias_applied_m > 0 THEN 1 ELSE 0 END)::numeric * 100, 1) as pct_positive_bias,
  -- Alert flags
  CASE
    WHEN AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) < 0.4 THEN '🚨 LOW_IMPROVEMENT'
    WHEN AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) < 0.5 THEN '⚠️  BELOW_TARGET'
    ELSE '✅ HEALTHY'
  END as health_status
FROM ml_predictions_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY model_version
ORDER BY model_version;

-- ============================================================================
-- BIAS DISTRIBUTION CHECK
-- ============================================================================
-- Verify model is not stuck adding constant bias
-- Healthy: 30-70% positive, avg bias near 0

SELECT
  model_version,
  COUNT(*) as total_predictions,
  -- Bias direction
  COUNT(CASE WHEN bias_applied_m > 0 THEN 1 END) as positive_bias_count,
  COUNT(CASE WHEN bias_applied_m < 0 THEN 1 END) as negative_bias_count,
  COUNT(CASE WHEN bias_applied_m = 0 THEN 1 END) as zero_bias_count,
  ROUND(AVG(CASE WHEN bias_applied_m > 0 THEN 1 ELSE 0 END)::numeric * 100, 1) as pct_positive,
  -- Bias magnitude
  ROUND(AVG(bias_applied_m)::numeric, 3) as avg_bias,
  ROUND(STDDEV(bias_applied_m)::numeric, 3) as stddev_bias,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY bias_applied_m)::numeric, 3) as median_bias,
  -- Large bias corrections (may be problematic)
  COUNT(CASE WHEN ABS(bias_applied_m) > 1.0 THEN 1 END) as large_bias_count,
  ROUND(AVG(CASE WHEN ABS(bias_applied_m) > 1.0 THEN 1 ELSE 0 END)::numeric * 100, 1) as pct_large_bias,
  -- Alert flags
  CASE
    WHEN AVG(CASE WHEN bias_applied_m > 0 THEN 1 ELSE 0 END) > 0.9 THEN '🚨 ONE_DIRECTIONAL_BIAS'
    WHEN AVG(CASE WHEN bias_applied_m > 0 THEN 1 ELSE 0 END) < 0.1 THEN '🚨 ONE_DIRECTIONAL_BIAS'
    WHEN ABS(AVG(bias_applied_m)) > 0.3 THEN '⚠️  BIASED_PREDICTIONS'
    ELSE '✅ BALANCED'
  END as bias_health
FROM ml_predictions_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY model_version;

-- ============================================================================
-- PERFORMANCE BY WAVE HEIGHT
-- ============================================================================
-- Check if model performs differently for small vs large waves
-- Alert if large waves show degradation

WITH bucketed_predictions AS (
  SELECT
    model_version,
    CASE
      WHEN raw_forecast_m < 0.5 THEN '< 0.5m'
      WHEN raw_forecast_m < 1.0 THEN '0.5-1.0m'
      WHEN raw_forecast_m < 1.5 THEN '1.0-1.5m'
      WHEN raw_forecast_m < 2.0 THEN '1.5-2.0m'
      WHEN raw_forecast_m < 3.0 THEN '2.0-3.0m'
      ELSE '> 3.0m'
    END as height_bucket,
    CASE
      WHEN raw_forecast_m < 0.5 THEN 1
      WHEN raw_forecast_m < 1.0 THEN 2
      WHEN raw_forecast_m < 1.5 THEN 3
      WHEN raw_forecast_m < 2.0 THEN 4
      WHEN raw_forecast_m < 3.0 THEN 5
      ELSE 6
    END as bucket_order,
    raw_error_m,
    corrected_error_m,
    bias_applied_m
  FROM ml_predictions_log
  WHERE observed_m IS NOT NULL
    AND created_at > NOW() - INTERVAL '7 days'
)
SELECT
  model_version,
  height_bucket,
  COUNT(*) as n_predictions,
  ROUND(AVG(bias_applied_m)::numeric, 3) as avg_bias_m,
  ROUND(AVG(raw_error_m)::numeric, 3) as avg_raw_error_m,
  ROUND(AVG(corrected_error_m)::numeric, 3) as avg_corrected_error_m,
  ROUND((AVG(corrected_error_m) - AVG(raw_error_m))::numeric, 3) as error_change_m,
  ROUND(AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END)::numeric * 100, 1) as improvement_rate_pct,
  CASE
    WHEN AVG(corrected_error_m) > AVG(raw_error_m) THEN '⚠️  DEGRADING'
    WHEN AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) > 0.5 THEN '✅ IMPROVING'
    ELSE '➖ NEUTRAL'
  END as status
FROM bucketed_predictions
GROUP BY model_version, height_bucket, bucket_order
ORDER BY model_version, bucket_order;

-- ============================================================================
-- WORST PERFORMING BEACHES
-- ============================================================================
-- Identify beaches where model consistently makes things worse
-- May need beach-specific models or exclusions

SELECT
  ml.beach_id,
  b.display_name as beach_name,
  b.region,
  COUNT(*) as n_predictions,
  ROUND(AVG(ml.raw_forecast_m)::numeric, 3) as avg_raw_m,
  ROUND(AVG(ml.observed_m)::numeric, 3) as avg_observed_m,
  ROUND(AVG(ml.bias_applied_m)::numeric, 3) as avg_bias_m,
  ROUND(AVG(ml.raw_error_m)::numeric, 3) as avg_raw_error_m,
  ROUND(AVG(ml.corrected_error_m)::numeric, 3) as avg_corrected_error_m,
  ROUND((AVG(ml.corrected_error_m) - AVG(ml.raw_error_m))::numeric, 3) as avg_error_increase_m,
  ROUND(AVG(CASE WHEN ml.corrected_error_m < ml.raw_error_m THEN 1 ELSE 0 END)::numeric * 100, 1) as improvement_rate_pct
FROM ml_predictions_log ml
LEFT JOIN beaches b ON ml.beach_id = b.id
WHERE ml.observed_m IS NOT NULL
  AND ml.created_at > NOW() - INTERVAL '7 days'
GROUP BY ml.beach_id, b.display_name, b.region
HAVING COUNT(*) >= 10  -- Minimum sample size
ORDER BY (AVG(ml.corrected_error_m) - AVG(ml.raw_error_m)) DESC
LIMIT 20;

-- ============================================================================
-- TRAINING DATA VALIDATION
-- ============================================================================
-- Run BEFORE training a new model to validate data quality
-- Alerts if data is biased, insufficient, or low quality

WITH training_stats AS (
  SELECT
    COUNT(*) as n_samples,
    MIN(predicted_at) as earliest_prediction,
    MAX(predicted_at) as latest_prediction,
    EXTRACT(EPOCH FROM (MAX(predicted_at) - MIN(predicted_at))) / 86400 as date_range_days,
    COUNT(DISTINCT beach_id) as unique_beaches,
    -- Residual analysis (observed - raw forecast)
    AVG(observed_m - raw_forecast_m) as avg_residual,
    STDDEV(observed_m - raw_forecast_m) as stddev_residual,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (observed_m - raw_forecast_m)) as median_residual,
    -- Wave height distribution
    AVG(observed_m) as avg_observed,
    MIN(observed_m) as min_observed,
    MAX(observed_m) as max_observed,
    -- Current improvement rate (self-check)
    AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) as current_improvement_rate
  FROM ml_predictions_log
  WHERE observed_m IS NOT NULL
    AND created_at > NOW() - INTERVAL '90 days'  -- Use 90+ days for training
)
SELECT
  n_samples,
  date_range_days,
  unique_beaches,
  ROUND(avg_residual::numeric, 3) as avg_residual,
  ROUND(stddev_residual::numeric, 3) as stddev_residual,
  ROUND(median_residual::numeric, 3) as median_residual,
  ROUND(avg_observed::numeric, 3) as avg_observed,
  ROUND(min_observed::numeric, 3) as min_observed,
  ROUND(max_observed::numeric, 3) as max_observed,
  ROUND(current_improvement_rate::numeric * 100, 1) as current_improvement_pct,
  -- Validation checks
  CASE
    WHEN n_samples < 10000 THEN '🚨 INSUFFICIENT_DATA (need 10,000+ samples)'
    WHEN date_range_days < 90 THEN '🚨 SHORT_TIMEFRAME (need 90+ days)'
    WHEN ABS(avg_residual) > 0.3 THEN '🚨 BIASED_DATA (avg residual > 0.3m)'
    WHEN stddev_residual < 0.1 THEN '⚠️  LOW_VARIANCE (may not learn much)'
    WHEN unique_beaches < 50 THEN '⚠️  FEW_BEACHES (may not generalize)'
    ELSE '✅ READY_TO_TRAIN'
  END as training_readiness,
  -- Recommendations
  CASE
    WHEN n_samples < 10000 THEN 'Wait ' || CEIL((10000 - n_samples) / 100.0) || ' more days (assuming 100 observations/day)'
    WHEN date_range_days < 90 THEN 'Wait ' || CEIL(90 - date_range_days) || ' more days'
    WHEN ABS(avg_residual) > 0.3 THEN 'Data is biased - investigate NOAA forecast quality'
    ELSE 'Proceed with training'
  END as recommendation
FROM training_stats;

-- ============================================================================
-- GROUND TRUTH COVERAGE
-- ============================================================================
-- Monitor observation backfill job health
-- Alert if coverage drops below 50%

SELECT
  DATE(created_at) as date,
  COUNT(*) as predictions_created,
  COUNT(observed_m) as with_ground_truth,
  COUNT(*) - COUNT(observed_m) as pending_match,
  ROUND(COUNT(observed_m)::numeric / COUNT(*) * 100, 1) as match_rate_pct,
  CASE
    WHEN COUNT(observed_m)::numeric / COUNT(*) < 0.2 THEN '🚨 LOW_COVERAGE'
    WHEN COUNT(observed_m)::numeric / COUNT(*) < 0.5 THEN '⚠️  BELOW_TARGET'
    ELSE '✅ HEALTHY'
  END as coverage_status
FROM ml_predictions_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- CATASTROPHIC PREDICTIONS
-- ============================================================================
-- Find predictions where model made error much worse
-- Used for debugging and identifying failure modes

SELECT
  ml.beach_id,
  b.display_name as beach_name,
  ml.predicted_at,
  ROUND(ml.raw_forecast_m::numeric, 2) as raw_m,
  ROUND(ml.observed_m::numeric, 2) as observed_m,
  ROUND(ml.corrected_forecast_m::numeric, 2) as corrected_m,
  ROUND(ml.bias_applied_m::numeric, 2) as bias_m,
  ROUND(ml.raw_error_m::numeric, 2) as raw_error_m,
  ROUND(ml.corrected_error_m::numeric, 2) as corrected_error_m,
  ROUND((ml.corrected_error_m - ml.raw_error_m)::numeric, 2) as error_increase_m,
  ROUND(ml.wave_period_s::numeric, 1) as period_s,
  ROUND(ml.wind_speed_ms::numeric, 1) as wind_ms
FROM ml_predictions_log ml
LEFT JOIN beaches b ON ml.beach_id = b.id
WHERE ml.observed_m IS NOT NULL
  AND ml.created_at > NOW() - INTERVAL '7 days'
  AND ml.corrected_error_m > ml.raw_error_m  -- Model made it worse
  AND (ml.corrected_error_m - ml.raw_error_m) > 2.0  -- By more than 2 meters
ORDER BY (ml.corrected_error_m - ml.raw_error_m) DESC
LIMIT 20;

-- ============================================================================
-- FEATURE IMPORTANCE ANALYSIS (requires re-training)
-- ============================================================================
-- Check if model is learning meaningful patterns
-- Healthy: Multiple features with balanced importance

-- Note: Feature importances are stored in model file, not database
-- Run this query after training to verify features are diverse:
-- python3 -c "
-- import pandas as pd
-- df = pd.read_csv('models/feature_importances.csv')
-- print(df.sort_values('importance', ascending=False))
-- "

-- Expected healthy feature importance:
-- wave_height_model: 20-40%
-- wave_period: 10-20%
-- wave_direction: 5-15%
-- wind_speed: 10-20%
-- geographic features: 10-20%
-- temporal features: 5-15%

-- RED FLAGS:
-- - Any single feature > 60% (overfitting)
-- - Physics features (period, direction) at 0% (not learning)
-- - Only wind_speed + hour have importance (like current v1 model)

-- ============================================================================
-- WEEKLY SUMMARY REPORT
-- ============================================================================
-- Comprehensive weekly summary for team review

SELECT
  'Week Ending ' || TO_CHAR(NOW(), 'YYYY-MM-DD') as report_period,
  model_version,
  COUNT(*) as total_predictions,
  COUNT(observed_m) as with_ground_truth,
  ROUND(COUNT(observed_m)::numeric / COUNT(*) * 100, 1) as ground_truth_pct,
  -- Performance metrics
  ROUND(AVG(raw_error_m)::numeric, 3) as avg_raw_error_m,
  ROUND(AVG(corrected_error_m)::numeric, 3) as avg_corrected_error_m,
  ROUND((AVG(raw_error_m) - AVG(corrected_error_m))::numeric, 3) as error_reduction_m,
  ROUND((1 - AVG(corrected_error_m) / NULLIF(AVG(raw_error_m), 0))::numeric * 100, 1) as error_reduction_pct,
  ROUND(AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END)::numeric * 100, 1) as improvement_rate_pct,
  -- Bias metrics
  ROUND(AVG(bias_applied_m)::numeric, 3) as avg_bias_m,
  ROUND(STDDEV(bias_applied_m)::numeric, 3) as stddev_bias_m,
  ROUND(AVG(CASE WHEN bias_applied_m > 0 THEN 1 ELSE 0 END)::numeric * 100, 1) as pct_positive_bias,
  -- Coverage
  COUNT(DISTINCT beach_id) as beaches_covered,
  -- Overall health
  CASE
    WHEN AVG(corrected_error_m) < AVG(raw_error_m)
      AND AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) > 0.5
      AND ABS(AVG(bias_applied_m)) < 0.3
    THEN '✅ HEALTHY'
    WHEN AVG(corrected_error_m) > AVG(raw_error_m) THEN '🚨 DEGRADING_FORECASTS'
    WHEN AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) < 0.4 THEN '🚨 LOW_IMPROVEMENT'
    ELSE '⚠️  NEEDS_ATTENTION'
  END as overall_health
FROM ml_predictions_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY model_version
ORDER BY model_version;

-- ============================================================================
-- ALERT CONFIGURATION
-- ============================================================================
-- Set up pg_cron job to run health checks and send alerts

-- Create alert function (run once):
CREATE OR REPLACE FUNCTION alert_ml_model_health()
RETURNS TABLE (
  alert_level TEXT,
  alert_type TEXT,
  message TEXT,
  metric_value NUMERIC
) AS $$
BEGIN
  -- Check 1: Low improvement rate
  RETURN QUERY
  SELECT
    CASE WHEN improvement_rate < 30 THEN 'CRITICAL' ELSE 'WARNING' END::TEXT,
    'LOW_IMPROVEMENT_RATE'::TEXT,
    'ML model improvement rate is ' || ROUND(improvement_rate, 1) || '% (target: > 50%)'::TEXT,
    ROUND(improvement_rate, 1)
  FROM (
    SELECT AVG(CASE WHEN corrected_error_m < raw_error_m THEN 100.0 ELSE 0.0 END) as improvement_rate
    FROM ml_predictions_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND observed_m IS NOT NULL
  ) sub
  WHERE improvement_rate < 50;

  -- Check 2: Degrading forecasts
  RETURN QUERY
  SELECT
    'CRITICAL'::TEXT,
    'DEGRADING_FORECASTS'::TEXT,
    'ML corrected error (' || ROUND(corrected_error, 3) || 'm) > raw error (' || ROUND(raw_error, 3) || 'm)'::TEXT,
    ROUND(corrected_error - raw_error, 3)
  FROM (
    SELECT
      AVG(raw_error_m) as raw_error,
      AVG(corrected_error_m) as corrected_error
    FROM ml_predictions_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND observed_m IS NOT NULL
  ) sub
  WHERE corrected_error > raw_error;

  -- Check 3: Biased predictions
  RETURN QUERY
  SELECT
    'WARNING'::TEXT,
    'BIASED_PREDICTIONS'::TEXT,
    'ML average bias is ' || ROUND(avg_bias, 2) || 'm (target: -0.2 to +0.2m)'::TEXT,
    ROUND(avg_bias, 2)
  FROM (
    SELECT AVG(bias_applied_m) as avg_bias
    FROM ml_predictions_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
  ) sub
  WHERE ABS(avg_bias) > 0.3;

  -- Check 4: One-directional bias
  RETURN QUERY
  SELECT
    'CRITICAL'::TEXT,
    'ONE_DIRECTIONAL_BIAS'::TEXT,
    'ML predictions are ' || ROUND(pct_positive, 1) || '% positive (target: 30-70%)'::TEXT,
    ROUND(pct_positive, 1)
  FROM (
    SELECT AVG(CASE WHEN bias_applied_m > 0 THEN 100.0 ELSE 0.0 END) as pct_positive
    FROM ml_predictions_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
  ) sub
  WHERE pct_positive > 90 OR pct_positive < 10;

  -- Check 5: Low ground truth coverage
  RETURN QUERY
  SELECT
    CASE WHEN match_rate < 20 THEN 'CRITICAL' ELSE 'WARNING' END::TEXT,
    'LOW_GROUND_TRUTH_COVERAGE'::TEXT,
    'Ground truth match rate is ' || ROUND(match_rate, 1) || '% (target: > 50%)'::TEXT,
    ROUND(match_rate, 1)
  FROM (
    SELECT
      COUNT(observed_m)::numeric / NULLIF(COUNT(*), 0) * 100 as match_rate
    FROM ml_predictions_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
  ) sub
  WHERE match_rate < 50;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily health check (run once):
-- SELECT cron.schedule(
--   'ml-model-health-check',
--   '0 9 * * *',  -- 9am daily
--   $$
--   SELECT * FROM alert_ml_model_health();
--   $$
-- );

-- View recent alerts:
-- SELECT * FROM alert_ml_model_health();

-- ============================================================================
-- END OF MONITORING QUERIES
-- ============================================================================
-- These queries should be integrated into:
-- 1. Daily automated email reports
-- 2. Grafana/monitoring dashboards
-- 3. Slack alert webhooks
-- 4. Pre-deployment validation checks
-- ============================================================================
