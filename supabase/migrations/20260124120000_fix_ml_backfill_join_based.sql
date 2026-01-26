-- Fix ML backfill function: JOIN-based approach to skip unmatchable predictions
--
-- Problem: The row-by-row FOR LOOP processes predictions that may not have
-- matching observations, wasting time. Even with EXISTS checks, the function
-- processes predictions one-at-a-time with separate SELECT queries.
-- With 849K pending predictions, this approach is too slow to drain the backlog.
--
-- Fix:
-- 1. Replace FOR LOOP with single CTE-based UPDATE that directly JOINs
--    predictions with observations (only processes matchable predictions)
-- 2. Uses ±2h observation window (IOOS observations are sparse, every 2+ hours)
-- 3. Mark predictions older than 48h as permanently unmatchable (sentinel -1)
--    (IOOS data arrives within hours; if no match after 48h, it won't come)
-- 4. Update health metrics to scope match rate to observable beaches only
-- 5. Increase pg_cron batch size to 5000
BEGIN;

-- ==============================================================================
-- Step 1: Replace backfill function with JOIN-based approach
-- ==============================================================================
CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 5000)
RETURNS TABLE(processed INT, matched INT, elapsed_ms NUMERIC) AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  v_matched INT := 0;
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '2 hours';
  observation_window_start TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  -- Single UPDATE that directly JOINs predictions with their matching observations.
  -- Key improvement: only processes predictions that HAVE a matching observation,
  -- completely skipping unmatchable predictions (no wasted iterations).
  -- Uses ±2h window because IOOS observations arrive every 2+ hours.
  WITH matchable AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      uwo.wave_height_m AS obs_height
    FROM ml_predictions_log p
    INNER JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    INNER JOIN unified_wave_observations uwo
      ON uwo.nearest_beach_id = p.beach_id
      AND uwo.wave_height_m IS NOT NULL
      AND uwo.observed_at >= p.predicted_at - INTERVAL '2 hours'
      AND uwo.observed_at <= p.predicted_at + INTERVAL '2 hours'
    WHERE p.observed_m IS NULL
      AND p.predicted_at < cutoff
      AND p.predicted_at > observation_window_start
    ORDER BY p.id, ABS(EXTRACT(EPOCH FROM (uwo.observed_at - p.predicted_at)))
    LIMIT batch_size
  ),
  updated AS (
    UPDATE ml_predictions_log p
    SET
      observed_m = m.obs_height,
      raw_error_m = ABS(p.raw_forecast_m - m.obs_height),
      corrected_error_m = ABS(p.corrected_forecast_m - m.obs_height)
    FROM matchable m
    WHERE p.id = m.id
    RETURNING p.id
  )
  SELECT COUNT(*)::INT INTO v_matched FROM updated;

  RETURN QUERY SELECT
    v_matched,
    v_matched,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backfill_ml_observations_batch(INT) IS
  'JOIN-based ML ground truth matcher. Uses ±2h window to match predictions
   with observations via unified_wave_observations (observations are sparse).
   Skips unmatchable predictions entirely. Returns count of matched predictions.
   Fixed Jan 24 2026: replaced FOR LOOP with single CTE UPDATE.';

-- ==============================================================================
-- Step 2: Mark permanently unmatchable predictions (older than 48 hours)
-- IOOS observations arrive within hours. If a prediction hasn't matched after
-- 48h, the observation for that time window will never arrive.
-- Sentinel value observed_m = -1 means "no observation available".
-- ==============================================================================
UPDATE ml_predictions_log
SET observed_m = -1
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '48 hours';

-- ==============================================================================
-- Step 3: Fix get_ml_health_metrics to scope match rate to observable beaches
-- and exclude future/unmatchable predictions from pending count
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_ml_health_metrics()
RETURNS TABLE (
  total_predictions BIGINT,
  pending_observations BIGINT,
  matched_last_24h BIGINT,
  total_last_24h BIGINT,
  match_rate_24h NUMERIC,
  avg_raw_error_24h NUMERIC,
  avg_corrected_error_24h NUMERIC,
  improvement_pct_24h NUMERIC,
  oldest_pending_age_hours NUMERIC,
  observable_beaches_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      -- Only count predictions that are actually matchable as pending:
      -- Must be older than 2 hours AND within 48 hours (after that, sentinel marks them)
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '2 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
      ) as pending,
      -- Scope 24h metrics to observable beaches for meaningful match rate
      COUNT(*) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.predicted_at < NOW() - INTERVAL '2 hours'
          AND ob.beach_id IS NOT NULL
      ) as total_24h,
      COUNT(*) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.observed_m IS NOT NULL
          AND p.observed_m > 0
          AND ob.beach_id IS NOT NULL
      ) as matched_24h,
      AVG(p.raw_error_m) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.observed_m IS NOT NULL
          AND p.observed_m > 0
      ) as avg_raw_24h,
      AVG(p.corrected_error_m) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.observed_m IS NOT NULL
          AND p.observed_m > 0
      ) as avg_corr_24h,
      EXTRACT(EPOCH FROM (NOW() - MIN(p.predicted_at) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '2 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
      ))) / 3600 as oldest_pending_hours
    FROM ml_predictions_log p
    LEFT JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    WHERE p.predicted_at > NOW() - INTERVAL '30 days'
  ),
  beach_count AS (
    SELECT COUNT(*) as cnt FROM observable_beaches
  )
  SELECT
    s.total,
    s.pending,
    s.matched_24h,
    s.total_24h,
    ROUND(100.0 * s.matched_24h / NULLIF(s.total_24h, 0), 1),
    ROUND(s.avg_raw_24h, 3),
    ROUND(s.avg_corr_24h, 3),
    ROUND(100.0 * (s.avg_raw_24h - s.avg_corr_24h) / NULLIF(s.avg_raw_24h, 0), 1),
    ROUND(s.oldest_pending_hours, 1),
    b.cnt
  FROM stats s, beach_count b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_ml_health_metrics() IS
  'Returns ML pipeline health metrics. Match rate scoped to observable beaches.
   Pending count excludes future/sentinel predictions. Fixed Jan 24 2026.';

-- ==============================================================================
-- Step 4: Update pg_cron job to use larger batch size (5000)
-- The JOIN-based function is much faster, so we can process more per run.
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    -- Remove existing job
    PERFORM cron.unschedule('ml-backfill-observations')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations'
    );

    -- Re-schedule with larger batch size
    PERFORM cron.schedule(
      'ml-backfill-observations',
      '*/10 * * * *',
      'SELECT * FROM backfill_ml_observations_batch(5000)'
    );

    RAISE NOTICE 'pg_cron job "ml-backfill-observations" updated to batch_size=5000';
  ELSE
    RAISE NOTICE 'pg_cron not available - skipping job update';
  END IF;
END $$;

COMMIT;
