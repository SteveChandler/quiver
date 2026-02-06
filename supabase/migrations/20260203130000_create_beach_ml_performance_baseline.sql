-- Migration: Create Beach ML Performance Baseline Materialized View
-- Purpose: Per-beach ML prediction performance metrics for monitoring and comparison
-- Part of ML Rolling Pipeline monitoring infrastructure
--
-- Components:
-- 1. beach_ml_performance_baseline - Materialized view with 14-day rolling window
-- 2. refresh_beach_ml_baseline() - Manual refresh function
-- 3. Indexes for efficient queries
-- 4. pg_cron schedule for daily refresh at 7am UTC
-- 5. RLS policy for service_role access
--
-- Provides: Beach-level MAE, bias, improvement rates, match rates

BEGIN;

-- =============================================================================
-- MATERIALIZED VIEW: beach_ml_performance_baseline
-- =============================================================================
-- Tracks per-beach ML performance over rolling 14-day window
-- Used for:
-- - Comparing model performance across beaches
-- - Identifying beaches with poor predictions
-- - Monitoring match rates (predictions with ground truth)
-- - Detecting regional performance patterns

CREATE MATERIALIZED VIEW IF NOT EXISTS public.beach_ml_performance_baseline AS
SELECT
  b.id AS beach_id,
  b.name AS beach_name,

  -- Volume metrics
  COUNT(*) AS predictions_total,
  COUNT(p.observed_m) FILTER (
    WHERE p.observed_m IS NOT NULL AND p.observed_m > 0
  ) AS predictions_matched,
  ROUND(
    100.0 * COUNT(p.observed_m) FILTER (
      WHERE p.observed_m IS NOT NULL AND p.observed_m > 0
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS match_rate_pct,

  -- MAE metrics (only for matched predictions)
  ROUND(AVG(p.raw_error_m)::numeric, 3) AS raw_mae,
  ROUND(AVG(p.corrected_error_m)::numeric, 3) AS corrected_mae,

  -- Improvement metrics
  ROUND(
    100.0 * (
      AVG(p.raw_error_m) - AVG(p.corrected_error_m)
    ) / NULLIF(AVG(p.raw_error_m), 0),
    1
  ) AS mae_improvement_pct,

  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE p.corrected_error_m < p.raw_error_m
    ) / NULLIF(COUNT(p.observed_m) FILTER (
      WHERE p.observed_m IS NOT NULL AND p.observed_m > 0
    ), 0),
    1
  ) AS improvement_rate_pct,

  -- Bias metrics (positive = over-predicting, negative = under-predicting)
  ROUND(
    AVG(p.raw_forecast_m - p.observed_m)::numeric,
    3
  ) AS avg_raw_bias,
  ROUND(
    AVG(p.corrected_forecast_m - p.observed_m)::numeric,
    3
  ) AS avg_corrected_bias,

  -- Temporal bounds
  MAX(p.predicted_at) AS last_prediction_at,
  (NOW() - INTERVAL '14 days')::timestamptz AS period_start,
  NOW()::timestamptz AS period_end

FROM public.beaches b
INNER JOIN public.ml_predictions_log p ON p.beach_id = b.id
WHERE p.predicted_at > NOW() - INTERVAL '14 days'
  AND p.observed_m IS NOT NULL  -- Only include matched predictions in aggregates
  AND p.observed_m > 0          -- Exclude zero/null observations
GROUP BY b.id, b.name
HAVING COUNT(p.observed_m) FILTER (
  WHERE p.observed_m IS NOT NULL AND p.observed_m > 0
) >= 5  -- Require minimum 5 matched predictions for statistical validity
ORDER BY b.name;

COMMENT ON MATERIALIZED VIEW public.beach_ml_performance_baseline IS
  'Per-beach ML performance metrics over rolling 14-day window. Used for monitoring model performance, identifying problem beaches, and comparing regional patterns. Refreshed daily at 7am UTC.';

-- =============================================================================
-- INDEXES
-- =============================================================================
-- Index for beach lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_beach_ml_baseline_beach_id
  ON public.beach_ml_performance_baseline(beach_id);

-- Index for finding beaches by improvement rate (for identifying poor performers)
CREATE INDEX IF NOT EXISTS idx_beach_ml_baseline_improvement
  ON public.beach_ml_performance_baseline(improvement_rate_pct DESC NULLS LAST)
  WHERE predictions_matched >= 10;  -- Only include beaches with sufficient data

-- Index for finding beaches by match rate (for identifying data gaps)
CREATE INDEX IF NOT EXISTS idx_beach_ml_baseline_match_rate
  ON public.beach_ml_performance_baseline(match_rate_pct DESC NULLS LAST);

-- Index for finding recent activity
CREATE INDEX IF NOT EXISTS idx_beach_ml_baseline_last_prediction
  ON public.beach_ml_performance_baseline(last_prediction_at DESC NULLS LAST);

-- =============================================================================
-- FUNCTION: refresh_beach_ml_baseline()
-- =============================================================================
-- Refreshes the materialized view with latest data
-- Called by pg_cron daily at 7am UTC

CREATE OR REPLACE FUNCTION public.refresh_beach_ml_baseline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.beach_ml_performance_baseline;

  -- Log refresh for monitoring
  RAISE NOTICE 'beach_ml_performance_baseline refreshed at %', NOW();
END;
$$;

COMMENT ON FUNCTION public.refresh_beach_ml_baseline IS
  'Refreshes beach_ml_performance_baseline materialized view. Called daily by pg_cron at 7am UTC. Uses CONCURRENTLY to avoid blocking reads.';

GRANT EXECUTE ON FUNCTION public.refresh_beach_ml_baseline TO service_role;

-- =============================================================================
-- INITIAL REFRESH
-- =============================================================================
-- Populate the view with current data
REFRESH MATERIALIZED VIEW public.beach_ml_performance_baseline;

-- =============================================================================
-- CRON SCHEDULE
-- =============================================================================
-- Schedule daily refresh at 7am UTC (after overnight prediction processing)
-- Uses DO block to check if schedule already exists before creating

DO $$
BEGIN
  -- Remove existing schedule if present (idempotent)
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh-beach-ml-baseline'
  ) THEN
    PERFORM cron.unschedule('refresh-beach-ml-baseline');
  END IF;

  -- Create new schedule
  PERFORM cron.schedule(
    'refresh-beach-ml-baseline',
    '0 7 * * *',  -- Daily at 7am UTC
    'SELECT public.refresh_beach_ml_baseline();'
  );

  RAISE NOTICE 'Scheduled beach_ml_performance_baseline refresh for daily 7am UTC';
END $$;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Service role only access (matches ml_predictions_log security model)
-- This is read-only monitoring data, not user-facing

ALTER MATERIALIZED VIEW public.beach_ml_performance_baseline OWNER TO postgres;

-- Note: Materialized views don't support RLS directly, but we control access
-- through function permissions and database roles. Only service_role can
-- query this view via the refresh function or direct SQL.

-- Grant SELECT to service_role for monitoring queries
GRANT SELECT ON public.beach_ml_performance_baseline TO service_role;

-- =============================================================================
-- HELPER FUNCTION: get_beach_ml_performance(beach_id UUID)
-- =============================================================================
-- Convenience function to fetch performance for a specific beach
-- Returns NULL if beach has insufficient data

CREATE OR REPLACE FUNCTION public.get_beach_ml_performance(p_beach_id UUID)
RETURNS TABLE (
  beach_id UUID,
  beach_name TEXT,
  predictions_total BIGINT,
  predictions_matched BIGINT,
  match_rate_pct NUMERIC,
  raw_mae NUMERIC,
  corrected_mae NUMERIC,
  mae_improvement_pct NUMERIC,
  improvement_rate_pct NUMERIC,
  avg_raw_bias NUMERIC,
  avg_corrected_bias NUMERIC,
  last_prediction_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    beach_id,
    beach_name,
    predictions_total,
    predictions_matched,
    match_rate_pct,
    raw_mae,
    corrected_mae,
    mae_improvement_pct,
    improvement_rate_pct,
    avg_raw_bias,
    avg_corrected_bias,
    last_prediction_at,
    period_start,
    period_end
  FROM beach_ml_performance_baseline
  WHERE beach_id = p_beach_id;
$$;

COMMENT ON FUNCTION public.get_beach_ml_performance IS
  'Returns ML performance metrics for a specific beach from the baseline view. Used by monitoring dashboards and APIs.';

GRANT EXECUTE ON FUNCTION public.get_beach_ml_performance TO service_role;

-- =============================================================================
-- HELPER FUNCTION: get_worst_performing_beaches(limit_count INT)
-- =============================================================================
-- Returns beaches with lowest improvement rates (requiring attention)
-- Useful for prioritizing model improvements

CREATE OR REPLACE FUNCTION public.get_worst_performing_beaches(
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  beach_id UUID,
  beach_name TEXT,
  predictions_matched BIGINT,
  improvement_rate_pct NUMERIC,
  mae_improvement_pct NUMERIC,
  raw_mae NUMERIC,
  corrected_mae NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    beach_id,
    beach_name,
    predictions_matched,
    improvement_rate_pct,
    mae_improvement_pct,
    raw_mae,
    corrected_mae
  FROM beach_ml_performance_baseline
  WHERE predictions_matched >= 10  -- Require sufficient data
  ORDER BY improvement_rate_pct ASC NULLS LAST
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_worst_performing_beaches IS
  'Returns beaches with lowest ML improvement rates. Used to identify beaches requiring model attention or better training data.';

GRANT EXECUTE ON FUNCTION public.get_worst_performing_beaches TO service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- SELECT cron.unschedule('refresh-beach-ml-baseline');
-- DROP FUNCTION IF EXISTS public.get_worst_performing_beaches(INT);
-- DROP FUNCTION IF EXISTS public.get_beach_ml_performance(UUID);
-- DROP FUNCTION IF EXISTS public.refresh_beach_ml_baseline();
-- DROP MATERIALIZED VIEW IF EXISTS public.beach_ml_performance_baseline CASCADE;
-- COMMIT;

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
--
-- 1. View all beach performance metrics:
--    SELECT * FROM beach_ml_performance_baseline ORDER BY improvement_rate_pct DESC;
--
-- 2. Find beaches with low improvement rates:
--    SELECT * FROM get_worst_performing_beaches(5);
--
-- 3. Check specific beach performance:
--    SELECT * FROM get_beach_ml_performance('beach-uuid-here');
--
-- 4. Find beaches with data gaps (low match rates):
--    SELECT beach_name, predictions_total, predictions_matched, match_rate_pct
--    FROM beach_ml_performance_baseline
--    WHERE match_rate_pct < 50
--    ORDER BY predictions_total DESC;
--
-- 5. Compare raw vs corrected performance:
--    SELECT beach_name, raw_mae, corrected_mae, mae_improvement_pct
--    FROM beach_ml_performance_baseline
--    WHERE predictions_matched >= 20
--    ORDER BY mae_improvement_pct DESC;
--
-- 6. Manual refresh (if needed outside cron schedule):
--    SELECT refresh_beach_ml_baseline();
