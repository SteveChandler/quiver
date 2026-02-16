-- Returns forecast accuracy metrics for yesterday at a given beach.
-- Used by the beach page accuracy badge to show users how well
-- yesterday's forecast matched actual buoy observations.
BEGIN;

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
  SELECT
    p.beach_id,
    DATE(p.predicted_at AT TIME ZONE COALESCE(b.timezone, 'America/Los_Angeles')) AS forecast_date,
    ROUND(AVG(p.corrected_forecast_m)::numeric, 2) AS avg_predicted_m,
    ROUND(AVG(p.observed_m)::numeric, 2) AS avg_observed_m,
    ROUND(AVG(ABS(p.corrected_error_m))::numeric, 2) AS mae_m,
    ROUND(
      AVG(
        CASE WHEN ABS(p.observed_m) > 0
        THEN ABS(p.corrected_error_m) / ABS(p.observed_m) * 100
        ELSE NULL END
      )::numeric, 1
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
  JOIN beaches b ON b.id = p.beach_id
  WHERE p.beach_id = p_beach_id
    AND DATE(p.predicted_at AT TIME ZONE COALESCE(b.timezone, 'America/Los_Angeles'))
        = (CURRENT_DATE AT TIME ZONE COALESCE(b.timezone, 'America/Los_Angeles') - INTERVAL '1 day')::date
    AND p.observed_m IS NOT NULL
  GROUP BY p.beach_id, DATE(p.predicted_at AT TIME ZONE COALESCE(b.timezone, 'America/Los_Angeles'))
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_yesterday_accuracy(UUID) IS
'Returns forecast accuracy metrics for yesterday at the given beach.
Uses ml_predictions_log with observed ground truth from IOOS buoys.
should_display is false when accuracy is poor (>0.45m MAE AND >40% relative) or waves too small (<0.3m).';

GRANT EXECUTE ON FUNCTION get_yesterday_accuracy(UUID) TO authenticated, anon, service_role;

COMMIT;
