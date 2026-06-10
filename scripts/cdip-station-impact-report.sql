-- Read-only impact report for preferring beaches.cdip_station in
-- get_beach_observation_station().
--
-- Run before applying the station resolver migration:
--   supabase db query --linked -f scripts/cdip-station-impact-report.sql -o table

WITH beach_scope AS (
  SELECT
    b.id AS beach_id,
    b.name AS beach_name,
    b.city,
    b.state,
    b.cdip_station,
    public.get_beach_observation_station(b.id) AS current_station_id,
    'edu_ucsd_cdip_' || lpad(
      nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), ''),
      3,
      '0'
    ) AS proposed_cdip_station_id
  FROM public.beaches b
  WHERE b.cdip_station IS NOT NULL
    AND nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), '') IS NOT NULL
),
recent_cdip_observations AS (
  SELECT
    scope.beach_id,
    count(obs.*) AS recent_cdip_observation_count,
    max(obs.observed_at) AS latest_cdip_observed_at,
    min(obs.wave_height_m) AS recent_cdip_min_height_m,
    max(obs.wave_height_m) AS recent_cdip_max_height_m
  FROM beach_scope scope
  LEFT JOIN public.unified_wave_observations obs
    ON obs.station_id = scope.proposed_cdip_station_id
   AND obs.observed_at >= now() - interval '7 days'
   AND obs.wave_height_m IS NOT NULL
   AND obs.wave_height_m > 0
  GROUP BY scope.beach_id
),
prediction_impact AS (
  SELECT
    scope.beach_id,
    count(pred.*) FILTER (
      WHERE pred.predicted_at >= now() - interval '90 days'
    ) AS affected_ml_predictions,
    count(pred.*) FILTER (
      WHERE pred.predicted_at >= now() - interval '90 days'
        AND pred.observed_m IS NOT NULL
        AND pred.observed_m > 0
    ) AS affected_observed_predictions
  FROM beach_scope scope
  LEFT JOIN public.ml_predictions_log pred
    ON pred.beach_id = scope.beach_id
  GROUP BY scope.beach_id
)
SELECT
  scope.beach_id,
  scope.beach_name,
  scope.city,
  scope.state,
  scope.cdip_station,
  scope.current_station_id,
  scope.proposed_cdip_station_id,
  scope.current_station_id IS DISTINCT FROM scope.proposed_cdip_station_id
    AS station_would_change,
  obs.recent_cdip_observation_count,
  obs.latest_cdip_observed_at,
  round(obs.recent_cdip_min_height_m::numeric, 3) AS recent_cdip_min_height_m,
  round(obs.recent_cdip_max_height_m::numeric, 3) AS recent_cdip_max_height_m,
  impact.affected_ml_predictions,
  impact.affected_observed_predictions
FROM beach_scope scope
JOIN recent_cdip_observations obs ON obs.beach_id = scope.beach_id
JOIN prediction_impact impact ON impact.beach_id = scope.beach_id
WHERE obs.recent_cdip_observation_count > 0
ORDER BY
  station_would_change DESC,
  impact.affected_observed_predictions DESC,
  scope.state,
  scope.beach_name;
