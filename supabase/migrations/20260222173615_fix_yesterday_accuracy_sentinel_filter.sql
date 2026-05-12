-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- ================================================================
-- Migration: Fix get_yesterday_accuracy sentinel value filter
-- Bug: AND p.observed_m IS NOT NULL included sentinel values (-1.00)
-- Fix: AND p.observed_m > 0 excludes sentinels and NULLs
-- ================================================================

CREATE OR REPLACE FUNCTION get_yesterday_accuracy(p_beach_id UUID)
RETURNS TABLE (
  beach_id UUID,
  forecast_date DATE,
  avg_predicted_m NUMERIC,
  avg_observed_m NUMERIC,
  mae_m NUMERIC,
  relative_error_pct NUMERIC,
  observation_count INTEGER,
  should_display BOOLEAN
) AS $$
DECLARE
  v_tz TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  -- Get beach timezone (default to LA)
  SELECT COALESCE(b.timezone, 'America/Los_Angeles') INTO v_tz
  FROM beaches b WHERE b.id = p_beach_id;

  IF v_tz IS NULL THEN
    v_tz := 'America/Los_Angeles';
  END IF;

  -- Pre-compute yesterday's UTC boundaries for index-friendly filtering
  -- on (beach_id, predicted_at) instead of DATE(predicted_at AT TIME ZONE ...)
  v_start := (CURRENT_DATE AT TIME ZONE v_tz - INTERVAL '1 day') AT TIME ZONE v_tz;
  v_end := (CURRENT_DATE AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  RETURN QUERY
  SELECT
    p.beach_id,
    (v_start AT TIME ZONE v_tz)::date AS forecast_date,
    ROUND(AVG(p.corrected_forecast_m)::numeric, 2) AS avg_predicted_m,
    ROUND(AVG(p.observed_m)::numeric, 2) AS avg_observed_m,
    ROUND(AVG(ABS(p.corrected_error_m))::numeric, 2) AS mae_m,
    -- Cap at 999% to prevent absurd values for very small observed waves
    LEAST(
      ROUND(
        AVG(
          CASE WHEN ABS(p.observed_m) > 0
          THEN ABS(p.corrected_error_m) / ABS(p.observed_m) * 100
          ELSE NULL END
        )::numeric, 1
      ),
      999
    ) AS relative_error_pct,
    COUNT(*)::integer AS observation_count,
    -- Hide when BOTH: error > 0.45m (~1.5ft) AND relative > 40%, OR observed < 0.3m (~1ft)
    NOT (
      AVG(ABS(p.corrected_error_m)) > 0.45
      AND COALESCE(AVG(
        CASE WHEN ABS(p.observed_m) > 0
        THEN ABS(p.corrected_error_m) / ABS(p.observed_m)
        ELSE NULL END
      ), 0) > 0.40
    ) AND AVG(p.observed_m) >= 0.3 AS should_display
  FROM ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.predicted_at >= v_start
    AND p.predicted_at < v_end
    -- Exclude NULLs and sentinel values (-1 marks ongoing/unmatched predictions)
    AND p.observed_m > 0
  GROUP BY p.beach_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMIT;
