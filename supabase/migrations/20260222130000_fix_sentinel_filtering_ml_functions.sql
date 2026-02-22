-- Fix sentinel value filtering in ML pipeline functions
--
-- ml_predictions_log uses observed_m = -1 as a sentinel meaning "no observation
-- will ever arrive." Six code locations filter with observed_m IS NOT NULL instead
-- of observed_m > 0, which includes sentinel rows.
--
-- Sentinel rows have ALL NULL error columns (raw_error_m, corrected_error_m,
-- candidate_corrected_m), so AVG() on error columns accidentally skips them.
-- However, COUNT(observed_m) does NOT skip them, corrupting count-based metrics:
-- - with_ground_truth is inflated
-- - pct_improved denominator is inflated (% appears lower than reality)
--
-- This migration fixes both get_ml_weekly_metrics() and check_ml_drift().

BEGIN;

-- =============================================================================
-- FIX 1: get_ml_weekly_metrics() — COUNT inflation on sentinel rows
-- =============================================================================
-- Before: COUNT(p.observed_m) counted sentinel rows (observed_m = -1)
-- After:  COUNT(*) FILTER (WHERE p.observed_m > 0) excludes sentinels
--
-- Before: FILTER (WHERE p.observed_m IS NOT NULL) included sentinels in denominator
-- After:  FILTER (WHERE p.observed_m > 0) excludes sentinels from denominator

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

-- =============================================================================
-- FIX 2: check_ml_drift() — sentinel rows included in previous-week AVG
-- =============================================================================
-- Before: AND observed_m IS NOT NULL (included sentinel rows in AVG denominator)
-- After:  AND observed_m > 0 (excludes sentinels)
--
-- Note: AVG(corrected_error_m) already skips sentinels because their
-- corrected_error_m is NULL, but the filter is still wrong in principle
-- and would break if sentinels ever got error values populated.

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
  -- Get current week metrics
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

  -- If no data, no drift
  IF v_current_improvement IS NULL THEN
    RETURN false;
  END IF;

  -- Check absolute floor: improvement < 40%
  IF v_current_improvement < 40 THEN
    RETURN true;
  END IF;

  -- Get previous week MAE for the same model version
  SELECT
    ROUND(AVG(corrected_error_m)::numeric, 3)
  INTO v_previous_mae
  FROM ml_predictions_log
  WHERE model_version = v_current_model_version
    AND predicted_at > now() - interval '14 days'
    AND predicted_at <= now() - interval '7 days'
    AND observed_m > 0;

  -- If we have previous week data, check for degradation
  IF v_previous_mae IS NOT NULL AND v_previous_mae > 0 THEN
    v_mae_degradation_pct := 100.0 * (v_current_mae - v_previous_mae) / v_previous_mae;

    -- Check relative degradation: >20% worse than previous week
    IF v_mae_degradation_pct > 20 THEN
      RETURN true;
    END IF;
  END IF;

  -- No drift detected
  RETURN false;
END;
$$;

COMMIT;
