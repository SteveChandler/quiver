-- Optimize ML backlog processing: reduce thresholds and add TTL cleanup
--
-- Problem: 117K pending observations with oldest at 45.1h (approaching 48h threshold)
-- - Backlog is growing faster than it can be processed
-- - Match rate only 19% (81% of predictions never match)
-- - IOOS data actually arrives within hours, so 48h threshold is unnecessarily generous
--
-- Solution:
-- 1. Reduce sentinel threshold: 48h → 24h (IOOS data arrives within hours)
-- 2. Add 72h TTL: DELETE predictions that will never match (no point storing forever)
-- 3. Increase batch size: 5,000 → 10,000 per pg_cron run
-- 4. Enhanced monitoring: Track predictions approaching thresholds
--
-- Expected Impact:
-- - Immediate ~50-70% reduction in pending queue
-- - oldest_pending_age_hours drops from 45h to <24h
-- - Faster steady-state processing
--
BEGIN;

-- ==============================================================================
-- Step 1: Replace backfill function with optimized thresholds
-- ==============================================================================
DROP FUNCTION IF EXISTS backfill_ml_observations_batch(INT);

CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 10000)
RETURNS TABLE(processed INT, matched INT, sentinel_marked INT, expired_deleted INT, elapsed_ms NUMERIC) AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  v_matched INT := 0;
  v_sentinel INT := 0;
  v_expired INT := 0;
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

  -- Step 2: Mark predictions older than 24h as permanently unmatchable (was 48h)
  -- IOOS observations arrive within hours. If a prediction hasn't matched after
  -- 24h, the observation for that time window will never arrive.
  -- Reduced from 48h because IOOS data typically arrives within 1-6 hours.
  -- Sentinel value observed_m = -1 means "no observation available".
  WITH sentinel AS (
    UPDATE ml_predictions_log
    SET observed_m = -1
    WHERE observed_m IS NULL
      AND predicted_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_sentinel FROM sentinel;

  -- Step 3: DELETE predictions older than 72h that were never matched (NEW)
  -- These predictions will never match and serve no purpose in the backlog.
  -- They've either been sentinel-marked or will never be processed.
  -- TTL cleanup prevents unbounded table growth.
  WITH expired AS (
    DELETE FROM ml_predictions_log
    WHERE observed_m IS NULL
      AND predicted_at < NOW() - INTERVAL '72 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_expired FROM expired;

  RETURN QUERY SELECT
    v_matched + v_sentinel + v_expired,
    v_matched,
    v_sentinel,
    v_expired,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backfill_ml_observations_batch(INT) IS
  'JOIN-based ML ground truth matcher with sentinel marking and TTL cleanup.
   Step 1: Match predictions with observations via ±2h window.
   Step 2: Mark predictions >24h old as unmatchable (sentinel -1). (was 48h)
   Step 3: DELETE pending predictions >72h old (TTL cleanup).
   Returns: (processed, matched, sentinel_marked, expired_deleted, elapsed_ms).
   Optimized Jan 30 2026: reduced sentinel 48h→24h, added 72h TTL, batch 10k.';

-- ==============================================================================
-- Step 2: One-time cleanup of existing backlog
-- ==============================================================================

-- Mark predictions 24-48h old as sentinel (these would have been pending under old rules)
UPDATE ml_predictions_log
SET observed_m = -1
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '24 hours'
  AND predicted_at >= NOW() - INTERVAL '48 hours';

-- Delete predictions >72h old that are still pending (should be rare/none)
DELETE FROM ml_predictions_log
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '72 hours';

-- ==============================================================================
-- Step 3: Update pg_cron job with larger batch size (10,000)
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
      'SELECT * FROM backfill_ml_observations_batch(10000)'
    );

    RAISE NOTICE 'pg_cron job "ml-backfill-observations" updated to batch_size=10000';
  ELSE
    RAISE NOTICE 'pg_cron not available - skipping job update';
  END IF;
END $$;

-- ==============================================================================
-- Step 4: Update get_ml_health_metrics with enhanced monitoring
-- ==============================================================================
DROP FUNCTION IF EXISTS get_ml_health_metrics();

CREATE OR REPLACE FUNCTION get_ml_health_metrics()
RETURNS TABLE (
  total_predictions BIGINT,
  pending_observations BIGINT,
  pending_12_24h BIGINT,          -- NEW: early warning bucket
  pending_gt_24h BIGINT,          -- NEW: should be 0 after this migration
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
      -- NEW: Early warning - predictions 12-24h old (approaching sentinel threshold)
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '12 hours'
          AND p.predicted_at >= NOW() - INTERVAL '24 hours'
      ) as pending_12_24h,
      -- NEW: Should be 0 - predictions >24h should be sentinel-marked
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '24 hours'
      ) as pending_gt_24h,
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
    s.pending_12_24h,
    s.pending_gt_24h,
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
  'Returns ML pipeline health metrics with enhanced monitoring.
   New columns: pending_12_24h (early warning), pending_gt_24h (should be 0).
   Match rate scoped to observable beaches. Pending count excludes
   future predictions and sentinel-marked predictions.
   Updated Jan 30 2026: added early warning buckets for new 24h threshold.';

COMMIT;
