-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Fix sentinel value filtering in ML pipeline functions
-- ml_predictions_log uses observed_m = -1 as a sentinel meaning "no observation
-- will ever arrive." COUNT(observed_m) includes sentinels, corrupting metrics.

BEGIN;

-- FIX 1: get_ml_weekly_metrics() — COUNT inflation on sentinel rows
CREATE OR REPLACE FUNCTION get_ml_weekly_metrics()
RETURNS TABLE (
  model_version TEXT,
  predictions BIGINT,
  with_ground_truth BIGINT,
  avg_raw_error_m NUMERIC,
  avg_corrected_error_m NUMERIC,
  avg_improvement_m NUMERIC,
  pct_improved NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.model_version,
    COUNT(*)::BIGINT as predictions,
    COUNT(*) FILTER (WHERE p.observed_m > 0)::BIGINT as with_ground_truth,
    ROUND(AVG(p.raw_error_m)::numeric, 3) as avg_raw_error_m,
    ROUND(AVG(p.corrected_error_m)::numeric, 3) as avg_corrected_error_m,
    ROUND(AVG(p.raw_error_m - p.corrected_error_m)::numeric, 3) as avg_improvement_m,
    ROUND(100.0 * COUNT(*) FILTER (WHERE p.corrected_error_m < p.raw_error_m) /
          NULLIF(COUNT(*) FILTER (WHERE p.observed_m > 0), 0), 1) as pct_improved
  FROM ml_predictions_log p
  WHERE p.predicted_at > now() - interval '7 days'
  GROUP BY p.model_version
  ORDER BY p.model_version DESC;
END;
$$ LANGUAGE plpgsql;

-- FIX 2: check_ml_drift() — sentinel rows in previous-week AVG filter
CREATE OR REPLACE FUNCTION public.check_ml_drift()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_improvement NUMERIC;
  v_current_mae NUMERIC;
  v_previous_mae NUMERIC;
  v_mae_degradation_pct NUMERIC;
  v_current_model_version TEXT;
BEGIN
  SELECT
    pct_improved,
    avg_corrected_error_m,
    model_version
  INTO
    v_current_improvement,
    v_current_mae,
    v_current_model_version
  FROM get_ml_weekly_metrics()
  LIMIT 1;

  IF v_current_improvement IS NULL THEN
    RETURN false;
  END IF;

  IF v_current_improvement < 40 THEN
    RETURN true;
  END IF;

  SELECT
    ROUND(AVG(corrected_error_m)::numeric, 3)
  INTO v_previous_mae
  FROM ml_predictions_log
  WHERE model_version = v_current_model_version
    AND predicted_at > now() - interval '14 days'
    AND predicted_at <= now() - interval '7 days'
    AND observed_m > 0;

  IF v_previous_mae IS NOT NULL AND v_previous_mae > 0 THEN
    v_mae_degradation_pct := 100.0 * (v_current_mae - v_previous_mae) / v_previous_mae;

    IF v_mae_degradation_pct > 20 THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMIT;
