BEGIN READ ONLY;

WITH positive_unlinked AS (
  SELECT
    c.beach_id,
    c.observed_at,
    c.source_created_by
  FROM public.session_wave_observation_candidates c
  JOIN public.profiles pr
    ON pr.id = c.user_id
   AND pr.deleted_at IS NULL
   AND COALESCE(pr.is_mock, false) = false
   AND COALESCE(pr.analytics_is_real_user, true) = true
   AND COALESCE(pr.is_system_account, false) = false
  WHERE c.quality_state <> 'rejected'
    AND c.observed_m IS NOT NULL
    AND c.observed_m > 0
    AND c.reported_wave_height_ft IS NOT NULL
    AND c.reported_wave_height_ft > 0
    AND c.ml_prediction_id IS NULL
),
relink_candidates AS (
  SELECT
    c.source_created_by,
    nearest.prediction_delta_minutes,
    nearest.forecast_horizon_bucket,
    nearest.forecast_horizon_hours,
    nearest.display_source AS nearest_display_source
  FROM positive_unlinked c
  LEFT JOIN LATERAL (
    SELECT
      round(
        (
          abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) / 60.0
        )::numeric,
        1
      ) AS prediction_delta_minutes,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
        WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
        ELSE NULL
      END AS forecast_horizon_bucket,
      p.forecast_horizon_hours,
      p.display_source
    FROM public.ml_predictions_log p
    WHERE p.beach_id = c.beach_id
      AND p.display_source = 'face-Hs-transformer-v1'
      AND p.predicted_at IS NOT NULL
      AND p.predicted_at BETWEEN c.observed_at - interval '6 hours'
                             AND c.observed_at + interval '6 hours'
    ORDER BY
      abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) ASC,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN 1
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN 2
        WHEN p.forecast_horizon_hours >= 73 THEN 3
        ELSE 4
      END ASC,
      p.forecast_horizon_hours ASC NULLS LAST,
      p.created_at DESC
    LIMIT 1
  ) nearest ON true
),
summary AS (
  SELECT
    count(*) AS positive_unlinked,
    count(*) FILTER (
      WHERE nearest_display_source = 'face-Hs-transformer-v1'
    ) AS relinkable_canonical_within_6h,
    count(*) FILTER (
      WHERE nearest_display_source = 'face-Hs-transformer-v1'
        AND forecast_horizon_bucket IN ('0-24h', '25-72h')
    ) AS relinkable_canonical_0_72h,
    count(*) FILTER (
      WHERE nearest_display_source IS NULL
    ) AS no_canonical_match_within_6h
  FROM relink_candidates
)
SELECT
  'track_a_session_truth_relinkability_summary' AS result,
  jsonb_build_object(
    'positive_unlinked', positive_unlinked,
    'relinkable_canonical_within_6h', relinkable_canonical_within_6h,
    'relinkable_canonical_0_72h', relinkable_canonical_0_72h,
    'no_canonical_match_within_6h', no_canonical_match_within_6h
  ) AS metrics
FROM summary;

WITH positive_unlinked AS (
  SELECT
    c.beach_id,
    c.observed_at,
    c.source_created_by
  FROM public.session_wave_observation_candidates c
  JOIN public.profiles pr
    ON pr.id = c.user_id
   AND pr.deleted_at IS NULL
   AND COALESCE(pr.is_mock, false) = false
   AND COALESCE(pr.analytics_is_real_user, true) = true
   AND COALESCE(pr.is_system_account, false) = false
  WHERE c.quality_state <> 'rejected'
    AND c.observed_m IS NOT NULL
    AND c.observed_m > 0
    AND c.reported_wave_height_ft IS NOT NULL
    AND c.reported_wave_height_ft > 0
    AND c.ml_prediction_id IS NULL
),
relink_candidates AS (
  SELECT
    COALESCE(c.source_created_by, 'unknown') AS source_created_by,
    nearest.prediction_delta_minutes,
    nearest.forecast_horizon_bucket,
    nearest.display_source AS nearest_display_source
  FROM positive_unlinked c
  LEFT JOIN LATERAL (
    SELECT
      round(
        (
          abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) / 60.0
        )::numeric,
        1
      ) AS prediction_delta_minutes,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
        WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
        ELSE NULL
      END AS forecast_horizon_bucket,
      p.display_source
    FROM public.ml_predictions_log p
    WHERE p.beach_id = c.beach_id
      AND p.display_source = 'face-Hs-transformer-v1'
      AND p.predicted_at IS NOT NULL
      AND p.predicted_at BETWEEN c.observed_at - interval '6 hours'
                             AND c.observed_at + interval '6 hours'
    ORDER BY
      abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) ASC,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN 1
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN 2
        WHEN p.forecast_horizon_hours >= 73 THEN 3
        ELSE 4
      END ASC,
      p.forecast_horizon_hours ASC NULLS LAST,
      p.created_at DESC
    LIMIT 1
  ) nearest ON true
),
source_rows AS (
  SELECT
    source_created_by,
    count(*) AS positive_unlinked,
    count(*) FILTER (
      WHERE nearest_display_source = 'face-Hs-transformer-v1'
    ) AS relinkable_canonical_within_6h,
    count(*) FILTER (
      WHERE nearest_display_source = 'face-Hs-transformer-v1'
        AND forecast_horizon_bucket IN ('0-24h', '25-72h')
    ) AS relinkable_canonical_0_72h
  FROM relink_candidates
  GROUP BY source_created_by
)
SELECT
  'track_a_session_truth_relinkability_by_source' AS result,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'source_created_by', source_created_by,
        'positive_unlinked', positive_unlinked,
        'relinkable_canonical_within_6h', relinkable_canonical_within_6h,
        'relinkable_canonical_0_72h', relinkable_canonical_0_72h
      )
      ORDER BY positive_unlinked DESC, source_created_by ASC
    ),
    '[]'::jsonb
  ) AS rows
FROM source_rows;

WITH positive_unlinked AS (
  SELECT
    c.beach_id,
    c.observed_at
  FROM public.session_wave_observation_candidates c
  JOIN public.profiles pr
    ON pr.id = c.user_id
   AND pr.deleted_at IS NULL
   AND COALESCE(pr.is_mock, false) = false
   AND COALESCE(pr.analytics_is_real_user, true) = true
   AND COALESCE(pr.is_system_account, false) = false
  WHERE c.quality_state <> 'rejected'
    AND c.observed_m IS NOT NULL
    AND c.observed_m > 0
    AND c.reported_wave_height_ft IS NOT NULL
    AND c.reported_wave_height_ft > 0
    AND c.ml_prediction_id IS NULL
),
relink_candidates AS (
  SELECT
    nearest.prediction_delta_minutes,
    nearest.forecast_horizon_bucket,
    nearest.display_source AS nearest_display_source
  FROM positive_unlinked c
  LEFT JOIN LATERAL (
    SELECT
      round(
        (
          abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) / 60.0
        )::numeric,
        1
      ) AS prediction_delta_minutes,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
        WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
        ELSE NULL
      END AS forecast_horizon_bucket,
      p.display_source
    FROM public.ml_predictions_log p
    WHERE p.beach_id = c.beach_id
      AND p.display_source = 'face-Hs-transformer-v1'
      AND p.predicted_at IS NOT NULL
      AND p.predicted_at BETWEEN c.observed_at - interval '6 hours'
                             AND c.observed_at + interval '6 hours'
    ORDER BY
      abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) ASC,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN 1
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN 2
        WHEN p.forecast_horizon_hours >= 73 THEN 3
        ELSE 4
      END ASC,
      p.forecast_horizon_hours ASC NULLS LAST,
      p.created_at DESC
    LIMIT 1
  ) nearest ON true
),
horizon_rows AS (
  SELECT
    COALESCE(forecast_horizon_bucket, 'no_match') AS potential_horizon_bucket,
    count(*) AS positive_unlinked,
    count(*) FILTER (
      WHERE nearest_display_source = 'face-Hs-transformer-v1'
    ) AS relinkable_canonical_within_6h
  FROM relink_candidates
  GROUP BY COALESCE(forecast_horizon_bucket, 'no_match')
)
SELECT
  'track_a_session_truth_relinkability_by_potential_horizon' AS result,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'potential_horizon_bucket', potential_horizon_bucket,
        'positive_unlinked', positive_unlinked,
        'relinkable_canonical_within_6h', relinkable_canonical_within_6h
      )
      ORDER BY
        CASE potential_horizon_bucket
          WHEN '0-24h' THEN 1
          WHEN '25-72h' THEN 2
          WHEN '73h+' THEN 3
          ELSE 4
        END,
        potential_horizon_bucket ASC
    ),
    '[]'::jsonb
  ) AS rows
FROM horizon_rows;

WITH positive_unlinked AS (
  SELECT
    c.beach_id,
    c.observed_at
  FROM public.session_wave_observation_candidates c
  JOIN public.profiles pr
    ON pr.id = c.user_id
   AND pr.deleted_at IS NULL
   AND COALESCE(pr.is_mock, false) = false
   AND COALESCE(pr.analytics_is_real_user, true) = true
   AND COALESCE(pr.is_system_account, false) = false
  WHERE c.quality_state <> 'rejected'
    AND c.observed_m IS NOT NULL
    AND c.observed_m > 0
    AND c.reported_wave_height_ft IS NOT NULL
    AND c.reported_wave_height_ft > 0
    AND c.ml_prediction_id IS NULL
),
relink_candidates AS (
  SELECT
    nearest.prediction_delta_minutes,
    nearest.display_source AS nearest_display_source
  FROM positive_unlinked c
  LEFT JOIN LATERAL (
    SELECT
      round(
        (
          abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) / 60.0
        )::numeric,
        1
      ) AS prediction_delta_minutes,
      p.display_source
    FROM public.ml_predictions_log p
    WHERE p.beach_id = c.beach_id
      AND p.display_source = 'face-Hs-transformer-v1'
      AND p.predicted_at IS NOT NULL
      AND p.predicted_at BETWEEN c.observed_at - interval '6 hours'
                             AND c.observed_at + interval '6 hours'
    ORDER BY
      abs(EXTRACT(EPOCH FROM (p.predicted_at - c.observed_at))) ASC,
      CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN 1
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN 2
        WHEN p.forecast_horizon_hours >= 73 THEN 3
        ELSE 4
      END ASC,
      p.forecast_horizon_hours ASC NULLS LAST,
      p.created_at DESC
    LIMIT 1
  ) nearest ON true
),
delta_rows AS (
  SELECT
    CASE
      WHEN nearest_display_source IS NULL THEN 'no_match'
      WHEN prediction_delta_minutes <= 30 THEN '0_30m'
      WHEN prediction_delta_minutes <= 90 THEN '31_90m'
      WHEN prediction_delta_minutes <= 180 THEN '91_180m'
      ELSE '181_360m'
    END AS delta_bucket,
    count(*) AS positive_unlinked
  FROM relink_candidates
  GROUP BY 1
)
SELECT
  'track_a_session_truth_relinkability_by_delta_bucket' AS result,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'delta_bucket', delta_bucket,
        'positive_unlinked', positive_unlinked
      )
      ORDER BY
        CASE delta_bucket
          WHEN '0_30m' THEN 1
          WHEN '31_90m' THEN 2
          WHEN '91_180m' THEN 3
          WHEN '181_360m' THEN 4
          ELSE 5
        END,
        delta_bucket ASC
    ),
    '[]'::jsonb
  ) AS rows
FROM delta_rows;

ROLLBACK;
