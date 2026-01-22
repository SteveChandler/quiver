-- Add pg_cron backup for ML observations backfill
-- This provides database-level reliability when Vercel cron jobs fail
BEGIN;

-- ==============================================================================
-- Function: backfill_ml_observations_batch
-- Purpose: Match ML predictions with actual observations for ground truth
-- ==============================================================================
CREATE OR REPLACE FUNCTION backfill_ml_observations_batch(batch_size INT DEFAULT 500)
RETURNS TABLE(processed INT, matched INT, elapsed_ms NUMERIC) AS $$
DECLARE
  start_ts TIMESTAMPTZ := clock_timestamp();
  pred RECORD;
  obs_height NUMERIC;
  match_count INT := 0;
  process_count INT := 0;
BEGIN
  -- Process pending predictions that:
  -- 1. Have no observed_m value (ground truth not yet matched)
  -- 2. Are older than 2 hours (allow time for observation data to arrive)
  -- 3. Are within 7 days (observations older than this are likely unavailable)
  -- 4. Are from beaches that have observation sources (via observable_beaches view)
  -- 5. Have a matching observation available (EXISTS check for efficiency)
  FOR pred IN
    SELECT p.id, p.beach_id, p.predicted_at, p.raw_forecast_m, p.corrected_forecast_m
    FROM ml_predictions_log p
    JOIN observable_beaches ob ON ob.beach_id = p.beach_id
    WHERE p.observed_m IS NULL
      AND p.predicted_at < NOW() - INTERVAL '2 hours'
      AND p.predicted_at > NOW() - INTERVAL '7 days'
      AND EXISTS (
        SELECT 1 FROM marine_forecasts mf
        WHERE mf.beach_id = p.beach_id
          AND mf.is_observed = true
          AND mf.wave_height_m IS NOT NULL
          AND mf.ts BETWEEN p.predicted_at - INTERVAL '1 hour' AND p.predicted_at + INTERVAL '1 hour'
      )
    ORDER BY p.predicted_at DESC  -- Process newest first (most likely to have obs)
    LIMIT batch_size
  LOOP
    process_count := process_count + 1;

    -- Find matching observation within ±1 hour window
    -- Takes the earliest observation in the window for consistency
    SELECT wave_height_m INTO obs_height
    FROM marine_forecasts
    WHERE beach_id = pred.beach_id
      AND is_observed = true
      AND wave_height_m IS NOT NULL
      AND ts BETWEEN pred.predicted_at - INTERVAL '1 hour'
              AND pred.predicted_at + INTERVAL '1 hour'
    ORDER BY ts ASC
    LIMIT 1;

    IF obs_height IS NOT NULL THEN
      UPDATE ml_predictions_log
      SET observed_m = obs_height,
          raw_error_m = ABS(raw_forecast_m - obs_height),
          corrected_error_m = ABS(corrected_forecast_m - obs_height)
      WHERE id = pred.id;
      match_count := match_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    process_count,
    match_count,
    ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backfill_ml_observations_batch(INT) IS
  'Matches ML predictions with observed wave heights for ground truth validation.
   Returns count of processed/matched predictions and elapsed time in ms.';

-- ==============================================================================
-- Function: get_ml_health_metrics
-- Purpose: Dashboard view of ML pipeline health
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
      COUNT(*) FILTER (WHERE observed_m IS NULL) as pending,
      COUNT(*) FILTER (WHERE predicted_at > NOW() - INTERVAL '24 hours') as total_24h,
      COUNT(*) FILTER (WHERE predicted_at > NOW() - INTERVAL '24 hours' AND observed_m IS NOT NULL) as matched_24h,
      AVG(raw_error_m) FILTER (WHERE predicted_at > NOW() - INTERVAL '24 hours') as avg_raw_24h,
      AVG(corrected_error_m) FILTER (WHERE predicted_at > NOW() - INTERVAL '24 hours') as avg_corr_24h,
      EXTRACT(EPOCH FROM (NOW() - MIN(predicted_at) FILTER (WHERE observed_m IS NULL))) / 3600 as oldest_pending_hours
    FROM ml_predictions_log
    WHERE predicted_at > NOW() - INTERVAL '30 days'
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
  'Returns ML pipeline health metrics including match rates, error stats, and backlog age.';

-- ==============================================================================
-- Schedule pg_cron job (every 10 minutes as backup to Vercel cron)
-- ==============================================================================
DO $$
BEGIN
  -- Only schedule if pg_cron is available
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    -- Remove existing job if present (idempotent)
    PERFORM cron.unschedule('ml-backfill-observations')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'ml-backfill-observations'
    );

    -- Schedule new job: every 10 minutes
    PERFORM cron.schedule(
      'ml-backfill-observations',
      '*/10 * * * *',
      'SELECT * FROM backfill_ml_observations_batch(500)'
    );

    RAISE NOTICE 'pg_cron job "ml-backfill-observations" scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron not available - skipping job scheduling';
  END IF;
END $$;

COMMIT;
