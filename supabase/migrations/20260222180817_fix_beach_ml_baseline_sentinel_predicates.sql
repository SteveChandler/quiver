-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.beach_ml_performance_baseline CASCADE;

CREATE MATERIALIZED VIEW public.beach_ml_performance_baseline AS
SELECT
  b.id AS beach_id,
  b.name AS beach_name,
  COUNT(*) AS predictions_total,
  COUNT(*) FILTER (
    WHERE p.observed_m > 0
  ) AS predictions_matched,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE p.observed_m > 0
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS match_rate_pct,
  ROUND(AVG(p.raw_error_m)::numeric, 3) AS raw_mae,
  ROUND(AVG(p.corrected_error_m)::numeric, 3) AS corrected_mae,
  ROUND(
    100.0 * (
      AVG(p.raw_error_m) - AVG(p.corrected_error_m)
    ) / NULLIF(AVG(p.raw_error_m), 0),
    1
  ) AS mae_improvement_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE p.corrected_error_m < p.raw_error_m
    ) / NULLIF(COUNT(*) FILTER (
      WHERE p.observed_m > 0
    ), 0),
    1
  ) AS improvement_rate_pct,
  ROUND(
    AVG(p.raw_forecast_m - p.observed_m)::numeric,
    3
  ) AS avg_raw_bias,
  ROUND(
    AVG(p.corrected_forecast_m - p.observed_m)::numeric,
    3
  ) AS avg_corrected_bias,
  MAX(p.predicted_at) AS last_prediction_at,
  (NOW() - INTERVAL '14 days')::timestamptz AS period_start,
  NOW()::timestamptz AS period_end
FROM public.beaches b
INNER JOIN public.ml_predictions_log p ON p.beach_id = b.id
WHERE p.predicted_at > NOW() - INTERVAL '14 days'
  AND p.observed_m > 0
GROUP BY b.id, b.name
HAVING COUNT(*) FILTER (
  WHERE p.observed_m > 0
) >= 5
ORDER BY b.name;

COMMENT ON MATERIALIZED VIEW public.beach_ml_performance_baseline IS
  'Per-beach ML performance metrics over rolling 14-day window. Used for monitoring model performance, identifying problem beaches, and comparing regional patterns. Refreshed daily at 7am UTC.';

CREATE UNIQUE INDEX idx_beach_ml_baseline_beach_id
  ON public.beach_ml_performance_baseline(beach_id);

CREATE INDEX idx_beach_ml_baseline_improvement
  ON public.beach_ml_performance_baseline(improvement_rate_pct DESC NULLS LAST)
  WHERE predictions_matched >= 10;

CREATE INDEX idx_beach_ml_baseline_match_rate
  ON public.beach_ml_performance_baseline(match_rate_pct DESC NULLS LAST);

CREATE INDEX idx_beach_ml_baseline_last_prediction
  ON public.beach_ml_performance_baseline(last_prediction_at DESC NULLS LAST);

ALTER MATERIALIZED VIEW public.beach_ml_performance_baseline OWNER TO postgres;
GRANT SELECT ON public.beach_ml_performance_baseline TO service_role;

CREATE OR REPLACE FUNCTION public.get_beach_ml_performance(p_beach_id UUID)
RETURNS TABLE (
  beach_id UUID,
  beach_name TEXT,
  predictions_total BIGINT,
  predictions_matched BIGINT,
  match_rate_pct NUMERIC,
  raw_mae NUMERIC,
  corrected_mae NUMERIC,
  mae_improvement_pct NUMERIC,
  improvement_rate_pct NUMERIC,
  avg_raw_bias NUMERIC,
  avg_corrected_bias NUMERIC,
  last_prediction_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    beach_id, beach_name, predictions_total, predictions_matched,
    match_rate_pct, raw_mae, corrected_mae, mae_improvement_pct,
    improvement_rate_pct, avg_raw_bias, avg_corrected_bias,
    last_prediction_at, period_start, period_end
  FROM beach_ml_performance_baseline
  WHERE beach_id = p_beach_id;
$$;

COMMENT ON FUNCTION public.get_beach_ml_performance IS
  'Returns ML performance metrics for a specific beach from the baseline view.';

GRANT EXECUTE ON FUNCTION public.get_beach_ml_performance TO service_role;

CREATE OR REPLACE FUNCTION public.get_worst_performing_beaches(
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  beach_id UUID,
  beach_name TEXT,
  predictions_matched BIGINT,
  improvement_rate_pct NUMERIC,
  mae_improvement_pct NUMERIC,
  raw_mae NUMERIC,
  corrected_mae NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    beach_id, beach_name, predictions_matched,
    improvement_rate_pct, mae_improvement_pct, raw_mae, corrected_mae
  FROM beach_ml_performance_baseline
  WHERE predictions_matched >= 10
  ORDER BY improvement_rate_pct ASC NULLS LAST
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_worst_performing_beaches IS
  'Returns beaches with lowest ML improvement rates.';

GRANT EXECUTE ON FUNCTION public.get_worst_performing_beaches TO service_role;

COMMIT;
