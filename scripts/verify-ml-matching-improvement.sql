-- ML Pipeline Phase 1 Verification Queries
-- Run these after deploying the migration to monitor improvement

-- ==============================================================================
-- 1. Quick health check - run immediately after migration
-- ==============================================================================
SELECT * FROM get_ml_health_metrics();

-- ==============================================================================
-- 2. Daily monitoring - run daily for first week
-- ==============================================================================
SELECT
  DATE(predicted_at) as date,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE observed_m > 0) as matched,
  COUNT(*) FILTER (WHERE observed_m = -1) as sentinel_marked,
  COUNT(*) FILTER (WHERE observed_m IS NULL) as still_pending,
  ROUND(100.0 * COUNT(*) FILTER (WHERE observed_m > 0) / COUNT(*), 1) as match_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE corrected_error_m < raw_error_m AND observed_m > 0)
    / NULLIF(COUNT(*) FILTER (WHERE observed_m > 0), 0), 1) as improvement_rate
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- ==============================================================================
-- 3. Match rate by temporal offset - understand matching distribution
-- ==============================================================================
WITH matched_predictions AS (
  SELECT
    p.id,
    p.predicted_at,
    uwo.observed_at,
    EXTRACT(EPOCH FROM (uwo.observed_at - p.predicted_at)) / 3600 as offset_hours
  FROM ml_predictions_log p
  INNER JOIN unified_wave_observations uwo
    ON uwo.nearest_beach_id = p.beach_id
    AND uwo.observed_at >= p.predicted_at - INTERVAL '4 hours'
    AND uwo.observed_at <= p.predicted_at + INTERVAL '4 hours'
  WHERE p.observed_m > 0
    AND p.predicted_at > NOW() - INTERVAL '24 hours'
)
SELECT
  CASE
    WHEN offset_hours BETWEEN -1 AND 1 THEN '±1h'
    WHEN offset_hours BETWEEN -2 AND 2 THEN '±2h'
    WHEN offset_hours BETWEEN -3 AND 3 THEN '±3h'
    ELSE '±4h'
  END as window_bucket,
  COUNT(*) as matches,
  ROUND(AVG(ABS(offset_hours)), 2) as avg_offset_hours
FROM matched_predictions
GROUP BY 1
ORDER BY 1;

-- ==============================================================================
-- 4. Backlog clearance progress - run hourly during backlog clear
-- ==============================================================================
SELECT
  COUNT(*) FILTER (WHERE observed_m IS NULL AND predicted_at < NOW() - INTERVAL '4 hours') as pending,
  COUNT(*) FILTER (WHERE observed_m > 0 AND predicted_at > NOW() - INTERVAL '1 hour') as matched_last_hour,
  COUNT(*) FILTER (WHERE observed_m = -1 AND predicted_at > NOW() - INTERVAL '1 hour') as sentinel_last_hour,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(predicted_at) FILTER (WHERE observed_m IS NULL))) / 3600, 1) as oldest_pending_hours
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '7 days';

-- ==============================================================================
-- 5. When to revert cron frequency - check if backlog is cleared
-- ==============================================================================
-- Run this query. When pending_observations < 10000, revert cron to */10:
--
-- DO $$
-- BEGIN
--   PERFORM cron.unschedule('ml-backfill-observations');
--   PERFORM cron.schedule(
--     'ml-backfill-observations',
--     '*/10 * * * *',  -- Back to normal frequency
--     'SELECT * FROM backfill_ml_observations_batch(10000)'
--   );
-- END $$;

SELECT
  pending_observations,
  CASE WHEN pending_observations < 10000 THEN 'READY to revert cron to */10'
       ELSE 'WAIT - backlog still clearing' END as action
FROM get_ml_health_metrics();
