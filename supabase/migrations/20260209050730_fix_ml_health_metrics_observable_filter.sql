-- Fix ML health metrics to only count observable beaches in pending metrics
-- and revert cron frequency from */5 back to */10
--
-- Context:
-- - ML pipeline has 186 beaches but only 46 are observable (have ground truth)
-- - The pending_observations count was including all beaches (~62K inflated)
-- - Should only count predictions for beaches in observable_beaches table
-- - Cron frequency was temporarily increased to */5 on Feb 2, reverting to */10
--
-- Changes:
-- 1. Add "AND ob.beach_id IS NOT NULL" filter to pending, pending_12_24h,
--    pending_gt_24h, and oldest_pending_hours metrics
-- 2. Revert cron job frequency from */5 to */10 minutes
--
-- Date: 2026-02-09

BEGIN;

-- Drop and recreate the get_ml_health_metrics function with observable beach filtering
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
      -- Only count predictions for observable beaches (have ground truth)
      -- Must be older than 4 hours AND within 7 days window
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '4 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ) as pending,
      -- Early warning - predictions 12-24h old (approaching sentinel threshold)
      -- Only count observable beaches
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '12 hours'
          AND p.predicted_at >= NOW() - INTERVAL '24 hours'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ) as pending_12_24h,
      -- Should be 0 - predictions >24h should be sentinel-marked
      -- Only count observable beaches
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '24 hours'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
      ) as pending_gt_24h,
      -- Count sentinel-marked predictions (observed_m = -1)
      COUNT(*) FILTER (
        WHERE p.observed_m = -1
      ) as sentinel,
      -- Scope 24h metrics to observable beaches for meaningful match rate
      COUNT(*) FILTER (
        WHERE p.predicted_at > NOW() - INTERVAL '24 hours'
          AND p.predicted_at < NOW() - INTERVAL '4 hours'
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
      -- Oldest pending age - only consider observable beaches
      EXTRACT(EPOCH FROM (NOW() - MIN(p.predicted_at) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < NOW() - INTERVAL '4 hours'
          AND p.predicted_at > NOW() - INTERVAL '7 days'
          AND ob.beach_id IS NOT NULL  -- FIXED: only count observable beaches
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
   Pending counts are filtered to only include observable beaches (have ground truth).
   Pending count uses 4h cutoff to match backfill function.
   Metrics: pending_12_24h (early warning), pending_gt_24h (should be 0).
   Match rate scoped to observable beaches.
   Updated Feb 9 2026: fixed pending counts to only include observable beaches.';

-- Revert cron frequency from */5 back to */10 minutes
-- Temporary increase was for Feb 2-10 observation period
-- Guard: only run if pg_cron extension is installed (not available in local dev)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'cron' AND p.proname = 'schedule') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations') THEN
      PERFORM cron.unschedule('ml-backfill-observations');
      RAISE NOTICE 'Unscheduled existing ml-backfill-observations job';
    END IF;

    PERFORM cron.schedule(
      'ml-backfill-observations',
      '*/10 * * * *',
      'SELECT * FROM backfill_ml_observations_batch(10000)'
    );
    RAISE NOTICE 'Cron frequency reverted to */10 minutes (was */5)';
  ELSE
    RAISE NOTICE 'pg_cron not available, skipping cron schedule update';
  END IF;
END $$;

COMMIT;
