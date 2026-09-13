-- Read-only aggregate inventory, compatible before/after the local v1 migration.
-- This bounded newest-first sample describes coverage; it is not an accuracy set.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH sample AS (
  SELECT p.beach_id, p.predicted_at, p.observed_m, p.raw_display_height_m,
    to_jsonb(p)->'observation_match' AS match,
    to_jsonb(p)->>'forecast_horizon_hours' AS horizon_hours
  FROM public.ml_predictions_log p
  WHERE p.predicted_at >= now() - interval '7 days'
    AND p.predicted_at < now() - interval '24 hours'
  ORDER BY p.predicted_at DESC, p.id LIMIT 1000
), classified AS (
  SELECT *, observed_m > 0 AND observed_m <= 30 AS operationally_matched,
    array_remove(ARRAY[
      CASE WHEN observed_m IS NULL THEN 'missing_label' END,
      CASE WHEN observed_m <= 0 OR observed_m > 30 THEN 'sentinel_or_invalid_height' END,
      CASE WHEN match IS NULL OR match->>'observation_id' IS NULL THEN 'missing_match_provenance' END,
      CASE WHEN raw_display_height_m IS NOT NULL AND match->>'target' = 'offshore_hs'
        THEN 'incompatible_face_vs_offshore_target' END,
      CASE WHEN match->>'quality' IS DISTINCT FROM 'passed' THEN 'unqualified_label' END,
      'legacy_log_is_not_a_versioned_issue_and_feature_manifest'
    ], NULL) AS limitations
  FROM sample
)
SELECT beach_id, (predicted_at AT TIME ZONE 'UTC')::date AS valid_date_utc,
  coalesce(match->>'station_id', 'unknown') AS station_id,
  coalesce(match->>'source', 'unknown') AS source,
  coalesce(horizon_hours, 'unknown') AS horizon_hours,
  limitations, count(*) AS sampled_rows,
  count(*) FILTER (WHERE operationally_matched) AS operationally_matched_rows,
  count(*) FILTER (WHERE match->>'available_at' IS NOT NULL) AS availability_recorded_rows,
  NULL::bigint AS strict_eligible_rows,
  'NOT_EVALUATED: export explicit v1 cases through Seaside validator' AS strict_status
FROM classified
GROUP BY beach_id, valid_date_utc, station_id, source, horizon_hours, limitations
ORDER BY valid_date_utc, beach_id, station_id, source, horizon_hours, limitations;
ROLLBACK;
