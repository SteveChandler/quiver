-- Create function to get weekly ML metrics
BEGIN;

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
    COUNT(p.observed_m)::BIGINT as with_ground_truth,
    ROUND(AVG(p.raw_error_m)::numeric, 3) as avg_raw_error_m,
    ROUND(AVG(p.corrected_error_m)::numeric, 3) as avg_corrected_error_m,
    ROUND(AVG(p.raw_error_m - p.corrected_error_m)::numeric, 3) as avg_improvement_m,
    ROUND(100.0 * COUNT(*) FILTER (WHERE p.corrected_error_m < p.raw_error_m) /
          NULLIF(COUNT(*) FILTER (WHERE p.observed_m IS NOT NULL), 0), 1) as pct_improved
  FROM ml_predictions_log p
  WHERE p.predicted_at > now() - interval '7 days'
  GROUP BY p.model_version
  ORDER BY p.model_version DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;
