-- Add ongoing sentinel marking to ML backfill function
--
-- Problem: The previous migration (20260124120000) included sentinel marking as
-- a one-time UPDATE statement, NOT as part of the recurring function.
-- Result: 69,329 predictions from Jan 22-23 that are NOW older than 48 hours
-- were never marked, and the backfill queue is not draining.
--
-- Fix: Add sentinel marking as Step 2 inside backfill_ml_observations_batch()
-- so predictions older than 48h are automatically marked every 10 minutes.
--
-- Returns: processed (matched + sentinel), matched, sentinel_marked, elapsed_ms
BEGIN;

-- ==============================================================================
-- Step 1: Drop old function (signature changed) and recreate with sentinel marking
-- ==============================================================================
DROP FUNCTION IF EXISTS backfill_ml_observations_batch(INT);

CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 5000)
RETURNS TABLE(processed INT, matched INT, sentinel_marked INT, elapsed_ms NUMERIC) AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  v_matched INT := 0;
  v_sentinel INT := 0;
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '2 hours';
  observation_window_start TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  -- Step 1: Match predictions with observations
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

  -- Step 2: Mark predictions older than 48h as permanently unmatchable
  -- IOOS observations arrive within hours. If a prediction hasn't matched after
  -- 48h, the observation for that time window will never arrive.
  -- Sentinel value observed_m = -1 means "no observation available".
  -- This runs EVERY invocation to continuously clean up aging predictions.
  WITH sentinel AS (
    UPDATE ml_predictions_log
    SET observed_m = -1
    WHERE observed_m IS NULL
      AND predicted_at < NOW() - INTERVAL '48 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_sentinel FROM sentinel;

  RETURN QUERY SELECT
    v_matched + v_sentinel,
    v_matched,
    v_sentinel,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backfill_ml_observations_batch(INT) IS
  'JOIN-based ML ground truth matcher with ongoing sentinel marking.
   Step 1: Match predictions with observations via ±2h window.
   Step 2: Mark predictions >48h old as unmatchable (sentinel -1).
   Returns: (processed, matched, sentinel_marked, elapsed_ms).
   Fixed Jan 25 2026: added ongoing sentinel marking to function body.';

-- ==============================================================================
-- Step 2: Mark current backlog of predictions older than 48 hours
-- This handles the 69,329 predictions that accumulated since Jan 24 migration
-- ==============================================================================
UPDATE ml_predictions_log
SET observed_m = -1
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '48 hours';

-- ==============================================================================
-- Step 3: Update get_ml_health_metrics to include sentinel stats
-- ==============================================================================
DROP FUNCTION IF EXISTS get_ml_health_metrics();

CREATE OR REPLACE FUNCTION get_ml_health_metrics()
RETURNS TABLE (
  total_predictions BIGINT,
  pending_observations BIGINT,
  sentinel_marked BIGINT,
  matched_last_24h BIGINT,
  total_observable_24h BIGINT,
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
      -- Must be older than 2 hours AND within 7 days window
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '2 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
      ) as pending,
      -- Count sentinel-marked predictions (observed_m = -1)
      COUNT(*) FILTER (
        WHERE p.observed_m = -1
      ) as sentinel,
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
    s.sentinel,
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
  'Returns ML pipeline health metrics including sentinel-marked count.
   Match rate scoped to observable beaches. Pending count excludes
   future predictions and sentinel-marked predictions.
   Fixed Jan 25 2026: added sentinel_marked column.';

COMMIT;
