-- Read-only audit for completed rated sessions with missing or unreliable
-- forecast snapshots. Do not mutate production from this script.

WITH session_snapshot_state AS (
  SELECT
    s.id AS session_id,
    s.user_id,
    s.beach_id,
    s.custom_spot_id,
    s.arrival_time,
    s.rating,
    cs.nearest_beach_id AS custom_spot_nearest_beach_id,
    cs.nearest_beach_distance_mi,
    sfs.id AS snapshot_id,
    sfs.forecast_snapshot,
    nearest.forecast_at AS nearest_forecast_at,
    ROUND((ABS(EXTRACT(EPOCH FROM (nearest.forecast_at - s.arrival_time))) / 60)::numeric, 2) AS nearest_delta_minutes
  FROM public.sessions s
  LEFT JOIN public.session_forecast_snapshots sfs
    ON sfs.session_id = s.id
  LEFT JOIN public.custom_spots cs
    ON cs.id = s.custom_spot_id
  LEFT JOIN LATERAL (
    SELECT ef.forecast_at
    FROM public.enhanced_forecasts ef
    WHERE ef.beach_id = s.beach_id
      AND ef.forecast_at IS NOT NULL
      AND ef.forecast_at BETWEEN s.arrival_time - interval '90 minutes'
        AND s.arrival_time + interval '90 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_at - s.arrival_time))) ASC
    LIMIT 1
  ) nearest ON true
  WHERE s.status = 'completed'
    AND s.rating IS NOT NULL
)
SELECT
  beach_id,
  COUNT(*) FILTER (
    WHERE snapshot_id IS NULL
      OR forecast_snapshot IS NULL
      OR jsonb_typeof(forecast_snapshot) <> 'object'
  ) AS missing_or_unreliable_snapshot_count,
  COUNT(*) FILTER (
    WHERE nearest_forecast_at IS NOT NULL
      AND (
        custom_spot_id IS NULL
        OR (
          custom_spot_nearest_beach_id = beach_id
          AND nearest_beach_distance_mi IS NOT NULL
          AND nearest_beach_distance_mi <= 5
        )
      )
  ) AS strict_repair_eligible_count,
  COUNT(*) FILTER (
    WHERE custom_spot_id IS NOT NULL
      AND (
        custom_spot_nearest_beach_id IS DISTINCT FROM beach_id
        OR nearest_beach_distance_mi IS NULL
        OR nearest_beach_distance_mi > 5
      )
  ) AS custom_spot_not_repairable_count,
  MIN(nearest_delta_minutes) AS min_repair_delta_minutes,
  MAX(nearest_delta_minutes) AS max_repair_delta_minutes
FROM session_snapshot_state
GROUP BY beach_id
ORDER BY missing_or_unreliable_snapshot_count DESC, beach_id;
