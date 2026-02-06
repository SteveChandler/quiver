-- Expand ML matching window: ±2h → ±4h for improved ground truth matching
--
-- Problem: Match rate only 19.8% (target: >50%) with 77K pending observations
-- - ±2h window too narrow for sparse IOOS observations (arrive every 2-6h)
-- - Many predictions expire unmatched before observation data arrives
--
-- Solution:
-- 1. Expand matching window: ±2h → ±4h (double the window)
-- 2. Temporarily increase cron frequency: */10 → */5 to clear backlog
-- 3. ORDER BY already prioritizes closest temporal match (no change needed)
--
-- Expected Impact:
-- - Match rate: 20% → ~35%
-- - Pending observations: 77K → <5K within 24-48h
-- - Better ground truth coverage for ML model training
--
-- IMPORTANT: Revert cron to */10 by 2026-02-10 or when pending <10K
-- See ROLLBACK section at end of file for reversion instructions.
--
BEGIN;

-- ==============================================================================
-- Step 1: Replace backfill function with expanded ±4h matching window
-- ==============================================================================
DROP FUNCTION IF EXISTS backfill_ml_observations_batch(INT);

CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 10000)
RETURNS TABLE(processed INT, matched INT, sentinel_marked INT, expired_deleted INT, elapsed_ms NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  v_matched INT := 0;
  v_sentinel INT := 0;
  v_expired INT := 0;
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '4 hours';  -- Updated: was 2 hours
  observation_window_start TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  -- Step 1: Match predictions with observations
  -- Single UPDATE that directly JOINs predictions with their matching observations.
  -- Key improvement: only processes predictions that HAVE a matching observation,
  -- completely skipping unmatchable predictions (no wasted iterations).
  -- Uses ±4h window (expanded from ±2h) because IOOS observations can be sparse.
  WITH matchable AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      uwo.wave_height_m AS obs_height
    FROM ml_predictions_log p
    INNER JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    INNER JOIN unified_wave_observations uwo
      ON uwo.nearest_beach_id = p.beach_id
      AND uwo.wave_height_m IS NOT NULL
      AND uwo.observed_at >= p.predicted_at - INTERVAL '4 hours'  -- Expanded from 2h
      AND uwo.observed_at <= p.predicted_at + INTERVAL '4 hours'  -- Expanded from 2h
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

  -- Step 2: Mark predictions older than 24h as permanently unmatchable
  -- IOOS observations arrive within hours. If a prediction hasn't matched after
  -- 24h, the observation for that time window will never arrive.
  -- Sentinel value observed_m = -1 means "no observation available".
  WITH sentinel AS (
    UPDATE ml_predictions_log
    SET observed_m = -1
    WHERE observed_m IS NULL
      AND predicted_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_sentinel FROM sentinel;

  -- Step 3: DELETE predictions older than 72h that were never matched
  -- These predictions will never match and serve no purpose in the backlog.
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
$$;

COMMENT ON FUNCTION backfill_ml_observations_batch(INT) IS
  'JOIN-based ML ground truth matcher with expanded ±4h window.
   Step 1: Match predictions with observations via ±4h window (was ±2h).
   Step 2: Mark predictions >24h old as unmatchable (sentinel -1).
   Step 3: DELETE pending predictions >72h old (TTL cleanup).
   Returns: (processed, matched, sentinel_marked, expired_deleted, elapsed_ms).
   Updated Feb 2 2026: expanded matching window 2h→4h for better match rate.';

-- ==============================================================================
-- Step 2: Temporarily increase cron frequency to clear backlog faster
-- IMPORTANT: Revert to */10 by 2026-02-10 or when pending <10K
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    -- Remove existing job if it exists (fixed: proper IF-THEN instead of PERFORM WHERE)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations') THEN
      PERFORM cron.unschedule('ml-backfill-observations');
    END IF;

    -- Re-schedule with faster frequency (*/5 instead of */10)
    -- IMPORTANT: Revert to */10 by 2026-02-10 or when pending <10K
    PERFORM cron.schedule(
      'ml-backfill-observations',
      '*/5 * * * *',  -- Temporary: was */10, revert after backlog clears
      'SELECT * FROM backfill_ml_observations_batch(10000)'
    );

    RAISE NOTICE 'pg_cron job "ml-backfill-observations" updated to */5 frequency (temporary until 2026-02-10)';
  ELSE
    RAISE NOTICE 'pg_cron not available - skipping job update';
  END IF;
END $$;

-- ==============================================================================
-- Step 3: Update health metrics function to reflect 4h matching window
-- ==============================================================================
DROP FUNCTION IF EXISTS get_ml_health_metrics();

CREATE OR REPLACE FUNCTION get_ml_health_metrics()
RETURNS TABLE (
  total_predictions BIGINT,
  pending_observations BIGINT,
  pending_12_24h BIGINT,
  pending_gt_24h BIGINT,
  sentinel_marked BIGINT,
  matched_last_24h BIGINT,
  total_observable_24h BIGINT,
  match_rate_24h NUMERIC,
  avg_raw_error_24h NUMERIC,
  avg_corrected_error_24h NUMERIC,
  improvement_pct_24h NUMERIC,
  oldest_pending_age_hours NUMERIC,
  observable_beaches_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      -- Only count predictions that are actually matchable as pending:
      -- Must be older than 4 hours (expanded from 2h) AND within 7 days window
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '4 hours'  -- Updated from 2h
          AND p.predicted_at > NOW() - INTERVAL '7 days'
      ) as pending,
      -- Early warning - predictions 12-24h old (approaching sentinel threshold)
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '12 hours'
          AND p.predicted_at >= NOW() - INTERVAL '24 hours'
      ) as pending_12_24h,
      -- Should be 0 - predictions >24h should be sentinel-marked
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
          AND p.predicted_at < NOW() - INTERVAL '4 hours'  -- Updated from 2h
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
          AND p.predicted_at < NOW() - INTERVAL '4 hours'  -- Updated from 2h
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
$$;

COMMENT ON FUNCTION get_ml_health_metrics() IS
  'Returns ML pipeline health metrics with ±4h matching window.
   Pending count uses 4h cutoff (expanded from 2h) to match backfill function.
   New columns: pending_12_24h (early warning), pending_gt_24h (should be 0).
   Match rate scoped to observable beaches.
   Updated Feb 2 2026: aligned with 4h matching window expansion.';

COMMIT;

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ==============================================================================
--
-- To revert matching window from ±4h back to ±2h:
--
-- Option 1: Re-run the previous migration (recommended for full revert)
--   Re-apply: supabase/migrations/20260130071552_optimize_ml_backlog_processing.sql
--   This contains the ±2h version of both functions.
--
-- Option 2: Manual revert of specific changes
--
--   -- Step 1: Revert backfill function to ±2h window
--   -- Change all INTERVAL '4 hours' back to INTERVAL '2 hours' in:
--   --   - cutoff variable (line 37)
--   --   - observed_at >= (line 54)
--   --   - observed_at <= (line 55)
--
--   -- Step 2: Revert health metrics function similarly
--   -- Change all INTERVAL '4 hours' back to INTERVAL '2 hours'
--
--   -- Step 3: Revert cron frequency to */10 (run this regardless)
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations') THEN
--       PERFORM cron.unschedule('ml-backfill-observations');
--     END IF;
--     PERFORM cron.schedule(
--       'ml-backfill-observations',
--       '*/10 * * * *',  -- Back to normal frequency
--       'SELECT * FROM backfill_ml_observations_batch(10000)'
--     );
--   END $$;
--
-- Note: Predictions already matched with ±4h window will retain their matches.
-- Only future matching will use the reverted window after rollback.
--
-- ==============================================================================
-- CRON FREQUENCY REVERT (run when pending <10K or by 2026-02-10)
-- ==============================================================================
--
-- Run this query to check if ready to revert:
--   SELECT pending_observations,
--     CASE WHEN pending_observations < 10000 THEN 'READY to revert cron'
--          ELSE 'WAIT - backlog still clearing' END as action
--   FROM get_ml_health_metrics();
--
-- When ready, run:
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations') THEN
--       PERFORM cron.unschedule('ml-backfill-observations');
--     END IF;
--     PERFORM cron.schedule(
--       'ml-backfill-observations',
--       '*/10 * * * *',  -- Back to normal frequency
--       'SELECT * FROM backfill_ml_observations_batch(10000)'
--     );
--     RAISE NOTICE 'Cron frequency reverted to */10';
--   END $$;
--
