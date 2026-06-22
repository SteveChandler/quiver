-- Read-only preflight for the scoped Phase 2 Monterey Bay terrain write.
--
-- Proposed approved command, after human review only:
--   yarn terrain:analyze --missing-only --beach-ids=a3d480de-3743-4dd7-8092-fb52772a0fb2,c0f23f4b-fcc4-4849-88f4-cb6da7206d80,885ad595-67cb-4408-b4cc-9ecf2ce3a848 --concurrency=3 --human-approval-token=2026-06-19-phase2-terrain-write-approved --approval-report-json=/tmp/quiver-phase2-terrain-auto-approval-harness.json --approval-proposed-json=/tmp/quiver-phase2-terrain-auto-approval-subset.json --min-approval-gate-samples=75 --min-approval-slice-samples=25 --max-approval-report-age-hours=24
--
-- Command:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase2-terrain-monterey-bay-preflight.sql
--
-- This preflight is intentionally exact-ID scoped. Do not approve a broader
-- region-scoped terrain write from this 3-beach evidence packet.

BEGIN READ ONLY;

\set phase2_monterey_bay_preflight_assertions_passed 0

SELECT 'phase2_monterey_bay_preflight_summary' AS check_name;

WITH expected_target(beach_id, expected_name) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid, 'Del Monte Beach'),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid, 'Marina State Beach'),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid, 'Moss Landing')
),
active AS (
  SELECT *
  FROM public.beaches
  WHERE deleted_at IS NULL
),
target AS (
  SELECT
    e.beach_id,
    e.expected_name,
    b.id,
    b.name,
    b.slug,
    b.region,
    b.terrain_status,
    b.terrain_method,
    b.wind_exposure_factors,
    b.swell_access_factors
  FROM expected_target e
  LEFT JOIN active b ON b.id = e.beach_id
),
target_gaps AS (
  SELECT *
  FROM target
  WHERE id IS NOT NULL
    AND (
      terrain_status IS NULL
      OR wind_exposure_factors IS NULL
      OR swell_access_factors IS NULL
    )
),
target_invalid_lengths AS (
  SELECT *
  FROM target
  WHERE id IS NOT NULL
    AND (
      (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
      OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
    )
)
SELECT
  (SELECT COUNT(*) FROM active) AS active_beaches,
  (
    SELECT COUNT(*)
    FROM active
    WHERE terrain_status IS NOT NULL
      AND wind_exposure_factors IS NOT NULL
      AND swell_access_factors IS NOT NULL
  ) AS active_with_status_and_factor_arrays,
  (SELECT COUNT(*) FROM expected_target) AS expected_target_rows,
  COUNT(*) FILTER (WHERE target.id IS NOT NULL) AS expected_active_found,
  COUNT(*) FILTER (WHERE target.region = 'Monterey Bay') AS target_in_monterey_bay,
  (SELECT COUNT(*) FROM target_gaps) AS would_update_rows,
  COUNT(*) FILTER (
    WHERE target.id IS NOT NULL
      AND target.terrain_status IS NOT NULL
      AND target.wind_exposure_factors IS NOT NULL
      AND target.swell_access_factors IS NOT NULL
  ) AS already_complete_rows,
  COUNT(*) FILTER (WHERE target.id IS NULL) AS missing_or_deleted_rows,
  (SELECT COUNT(*) FROM target_invalid_lengths) AS target_invalid_factor_lengths
FROM target;

SELECT 'phase2_monterey_bay_target_rows' AS check_name;

WITH expected_target(beach_id, expected_name) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid, 'Del Monte Beach'),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid, 'Marina State Beach'),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid, 'Moss Landing')
)
SELECT
  e.expected_name,
  b.id,
  b.name,
  b.slug,
  b.region,
  b.terrain_status,
  b.terrain_method,
  array_length(b.wind_exposure_factors, 1) AS wind_factor_count,
  array_length(b.swell_access_factors, 1) AS swell_factor_count,
  (
    b.deleted_at IS NULL
    AND (
      b.terrain_status IS NULL
      OR b.wind_exposure_factors IS NULL
      OR b.swell_access_factors IS NULL
    )
  ) AS would_update
FROM expected_target e
LEFT JOIN public.beaches b ON b.id = e.beach_id
ORDER BY e.expected_name;

SELECT 'phase2_monterey_bay_phase0_schema_readiness' AS check_name;

WITH checks AS (
  SELECT
    'column' AS object_type,
    'ml_predictions_log.forecast_horizon_bucket' AS object_name,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'forecast_horizon_bucket'
    ) AS exists_now
  UNION ALL
  SELECT
    'column',
    'ml_predictions_log.display_wave_source',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_wave_source'
    )
  UNION ALL
  SELECT
    'column',
    'ml_predictions_log.display_raw_input_height_m',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_raw_input_height_m'
    )
  UNION ALL
  SELECT
    'function',
    'get_forecast_accuracy_horizon_metrics',
    to_regprocedure(
      'public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)'
    ) IS NOT NULL
)
SELECT object_type, object_name, exists_now
FROM checks
ORDER BY object_type, object_name;

WITH checks AS (
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ml_predictions_log'
      AND column_name = 'forecast_horizon_bucket'
  ) AS exists_now
  UNION ALL
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ml_predictions_log'
      AND column_name = 'display_wave_source'
  )
  UNION ALL
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ml_predictions_log'
      AND column_name = 'display_raw_input_height_m'
  )
  UNION ALL
  SELECT to_regprocedure(
    'public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)'
  ) IS NOT NULL
)
SELECT
  CASE
    WHEN bool_and(exists_now) THEN 'true'
    ELSE 'false'
  END AS phase2_monterey_bay_phase0_schema_ready
FROM checks
\gset

\if :phase2_monterey_bay_phase0_schema_ready

SELECT 'phase2_monterey_bay_observed_30d' AS check_name;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
coverage AS (
  SELECT
    p.beach_id,
    p.forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE 'unknown'
    END AS horizon_bucket,
    p.observed_m,
    p.display_wave_source,
    p.display_raw_input_height_m
  FROM public.ml_predictions_log p
  JOIN expected_target e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
)
SELECT
  horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE observed_m > 0) AS observed_rows,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND horizon_bucket IN ('0-24h', '25-72h')
      AND stored_horizon_bucket IN ('0-24h', '25-72h')
      AND display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources AS s
        WHERE s.source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) AS approval_0_72h_rows,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND horizon_bucket IN ('0-24h', '25-72h')
      AND (
        stored_horizon_bucket NOT IN ('0-24h', '25-72h')
        OR stored_horizon_bucket IS NULL
        OR display_wave_source IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = display_wave_source
        )
        OR display_raw_input_height_m IS NULL
        OR display_raw_input_height_m < 0
      )
  ) AS observed_0_72h_rows_without_approval_provenance
FROM coverage
GROUP BY horizon_bucket
ORDER BY
  CASE horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase2_monterey_bay_preflight_assertions' AS check_name;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
active_target AS (
  SELECT b.*
  FROM expected_target e
  JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
coverage AS (
  SELECT
    p.beach_id,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS horizon_bucket,
    p.forecast_horizon_bucket AS stored_horizon_bucket,
    p.observed_m,
    p.display_wave_source,
    p.display_raw_input_height_m
  FROM public.ml_predictions_log p
  JOIN expected_target e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
),
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE c.horizon_bucket IN ('0-24h', '25-72h')
        AND c.observed_m > 0
        AND c.stored_horizon_bucket IN ('0-24h', '25-72h')
        AND c.display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = c.display_wave_source
        )
        AND c.display_raw_input_height_m IS NOT NULL
        AND c.display_raw_input_height_m >= 0
    ) AS approval_0_72h_rows
  FROM expected_target e
  LEFT JOIN coverage c ON c.beach_id = e.beach_id
  GROUP BY e.beach_id
),
assertions AS (
  SELECT
    'phase0_metric_rpc_exists' AS assertion,
    to_regprocedure('public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)') IS NOT NULL AS passed
  UNION ALL
  SELECT
    'all_three_targets_active' AS assertion,
    (SELECT COUNT(*) FROM active_target) = 3 AS passed
  UNION ALL
  SELECT
    'all_targets_are_monterey_bay',
    COUNT(*) FILTER (WHERE region = 'Monterey Bay') = 3
  FROM active_target
  UNION ALL
  SELECT
    'all_targets_are_current_gaps',
    COUNT(*) FILTER (
      WHERE terrain_status IS NULL
        OR wind_exposure_factors IS NULL
        OR swell_access_factors IS NULL
    ) = 3
  FROM active_target
  UNION ALL
  SELECT
    'no_target_has_invalid_factor_lengths',
    COUNT(*) FILTER (
      WHERE (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
         OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
    ) = 0
  FROM active_target
  UNION ALL
  SELECT
    'approval_0_72h_rows_at_least_75',
    COUNT(*) FILTER (
      WHERE horizon_bucket IN ('0-24h', '25-72h')
        AND observed_m > 0
        AND stored_horizon_bucket IN ('0-24h', '25-72h')
        AND display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    ) >= 75
  FROM coverage
  UNION ALL
  SELECT
    'observed_0_72h_rows_without_approval_provenance_0',
    COUNT(*) FILTER (
      WHERE horizon_bucket IN ('0-24h', '25-72h')
        AND observed_m > 0
        AND (
          stored_horizon_bucket NOT IN ('0-24h', '25-72h')
          OR stored_horizon_bucket IS NULL
          OR display_wave_source IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM allowed_wave_sources AS s
            WHERE s.source_tag = display_wave_source
          )
          OR display_raw_input_height_m IS NULL
          OR display_raw_input_height_m < 0
        )
    ) = 0
  FROM coverage
  UNION ALL
  SELECT
    'all_targets_approval_0_72h_rows_at_least_25',
    COUNT(*) FILTER (WHERE approval_0_72h_rows >= 25) = 3
  FROM coverage_by_beach
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

SELECT 'phase2_monterey_bay_preflight_blockers' AS check_name;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
active_target AS (
  SELECT b.*
  FROM expected_target e
  JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
coverage AS (
  SELECT
    p.beach_id,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS horizon_bucket,
    p.forecast_horizon_bucket AS stored_horizon_bucket,
    p.observed_m,
    p.display_wave_source,
    p.display_raw_input_height_m
  FROM public.ml_predictions_log p
  JOIN expected_target e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
),
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE c.horizon_bucket IN ('0-24h', '25-72h')
        AND c.observed_m > 0
        AND c.stored_horizon_bucket IN ('0-24h', '25-72h')
        AND c.display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = c.display_wave_source
        )
        AND c.display_raw_input_height_m IS NOT NULL
        AND c.display_raw_input_height_m >= 0
    ) AS approval_0_72h_rows
  FROM expected_target e
  LEFT JOIN coverage c ON c.beach_id = e.beach_id
  GROUP BY e.beach_id
),
summary AS (
  SELECT
    to_regprocedure('public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)') IS NOT NULL AS phase0_metric_rpc_exists,
    (SELECT COUNT(*) FROM active_target) AS active_target_rows,
    (SELECT COUNT(*) FILTER (WHERE region = 'Monterey Bay') FROM active_target) AS monterey_bay_target_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE terrain_status IS NULL
          OR wind_exposure_factors IS NULL
          OR swell_access_factors IS NULL
      )
      FROM active_target
    ) AS current_gap_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
           OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
      )
      FROM active_target
    ) AS invalid_factor_length_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE horizon_bucket IN ('0-24h', '25-72h')
          AND observed_m > 0
          AND stored_horizon_bucket IN ('0-24h', '25-72h')
          AND display_wave_source IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM allowed_wave_sources AS s
            WHERE s.source_tag = display_wave_source
          )
          AND display_raw_input_height_m IS NOT NULL
          AND display_raw_input_height_m >= 0
      )
      FROM coverage
    ) AS approval_0_72h_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE horizon_bucket IN ('0-24h', '25-72h')
          AND observed_m > 0
          AND (
            stored_horizon_bucket NOT IN ('0-24h', '25-72h')
            OR stored_horizon_bucket IS NULL
            OR display_wave_source IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM allowed_wave_sources AS s
              WHERE s.source_tag = display_wave_source
            )
            OR display_raw_input_height_m IS NULL
            OR display_raw_input_height_m < 0
          )
      )
      FROM coverage
    ) AS observed_0_72h_rows_without_approval_provenance,
    (
      SELECT COUNT(*) FILTER (WHERE approval_0_72h_rows >= 25)
      FROM coverage_by_beach
    ) AS targets_with_approval_0_72h_rows_at_least_25
),
assertions AS (
  SELECT
    'phase0_metric_rpc_exists' AS blocker_code,
    'The Phase 0 canonical metric RPC is not live.' AS blocker_message,
    phase0_metric_rpc_exists AS passed,
    CASE WHEN phase0_metric_rpc_exists THEN 'present' ELSE 'missing' END AS detail
  FROM summary
  UNION ALL
  SELECT
    'all_three_targets_active',
    'The scoped Monterey Bay target set does not contain exactly 3 active beaches.',
    active_target_rows = 3,
    CONCAT('active_target_rows=', active_target_rows, ', expected=3')
  FROM summary
  UNION ALL
  SELECT
    'all_targets_are_monterey_bay',
    'One or more scoped targets is not in Monterey Bay.',
    monterey_bay_target_rows = 3,
    CONCAT('monterey_bay_target_rows=', monterey_bay_target_rows, ', expected=3')
  FROM summary
  UNION ALL
  SELECT
    'all_targets_are_current_gaps',
    'One or more scoped targets is no longer a terrain gap; regenerate a narrower proposal.',
    current_gap_rows = 3,
    CONCAT('current_gap_rows=', current_gap_rows, ', expected=3')
  FROM summary
  UNION ALL
  SELECT
    'no_target_has_invalid_factor_lengths',
    'One or more scoped targets has invalid terrain factor array lengths.',
    invalid_factor_length_rows = 0,
    CONCAT('invalid_factor_length_rows=', invalid_factor_length_rows, ', expected=0')
  FROM summary
  UNION ALL
  SELECT
    'approval_0_72h_rows_at_least_75',
    'The scoped Monterey Bay target set lacks 75 approval-provenanced observed 0-72h rows.',
    approval_0_72h_rows >= 75,
    CONCAT('approval_0_72h_rows=', approval_0_72h_rows, ', expected_at_least=75')
  FROM summary
  UNION ALL
  SELECT
    'observed_0_72h_rows_without_approval_provenance_0',
    'One or more scoped short-horizon observed rows lacks stored horizon-bucket or replay provenance.',
    observed_0_72h_rows_without_approval_provenance = 0,
    CONCAT('observed_0_72h_rows_without_approval_provenance=', observed_0_72h_rows_without_approval_provenance, ', expected=0')
  FROM summary
  UNION ALL
  SELECT
    'all_targets_approval_0_72h_rows_at_least_25',
    'One or more scoped Monterey Bay targets lacks 25 approval-provenanced observed 0-72h rows.',
    targets_with_approval_0_72h_rows_at_least_25 = 3,
    CONCAT('targets_with_approval_0_72h_rows_at_least_25=', targets_with_approval_0_72h_rows_at_least_25, ', expected=3')
  FROM summary
)
SELECT blocker_code, blocker_message, detail
FROM assertions
WHERE NOT passed
ORDER BY blocker_code;

WITH expected_target(beach_id) AS (
  VALUES
    ('a3d480de-3743-4dd7-8092-fb52772a0fb2'::uuid),
    ('c0f23f4b-fcc4-4849-88f4-cb6da7206d80'::uuid),
    ('885ad595-67cb-4408-b4cc-9ecf2ce3a848'::uuid)
),
allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
active_target AS (
  SELECT b.*
  FROM expected_target e
  JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
coverage AS (
  SELECT
    p.beach_id,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS horizon_bucket,
    p.forecast_horizon_bucket AS stored_horizon_bucket,
    p.observed_m,
    p.display_wave_source,
    p.display_raw_input_height_m
  FROM public.ml_predictions_log p
  JOIN expected_target e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
),
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE c.horizon_bucket IN ('0-24h', '25-72h')
        AND c.observed_m > 0
        AND c.stored_horizon_bucket IN ('0-24h', '25-72h')
        AND c.display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = c.display_wave_source
        )
        AND c.display_raw_input_height_m IS NOT NULL
        AND c.display_raw_input_height_m >= 0
    ) AS approval_0_72h_rows
  FROM expected_target e
  LEFT JOIN coverage c ON c.beach_id = e.beach_id
  GROUP BY e.beach_id
),
assertions AS (
  SELECT to_regprocedure('public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)') IS NOT NULL AS passed
  UNION ALL
  SELECT (SELECT COUNT(*) FROM active_target) = 3 AS passed
  UNION ALL
  SELECT COUNT(*) FILTER (WHERE region = 'Monterey Bay') = 3
  FROM active_target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE terrain_status IS NULL
      OR wind_exposure_factors IS NULL
      OR swell_access_factors IS NULL
  ) = 3
  FROM active_target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE (wind_exposure_factors IS NOT NULL AND array_length(wind_exposure_factors, 1) IS DISTINCT FROM 72)
       OR (swell_access_factors IS NOT NULL AND array_length(swell_access_factors, 1) IS DISTINCT FROM 72)
  ) = 0
  FROM active_target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE horizon_bucket IN ('0-24h', '25-72h')
      AND observed_m > 0
      AND stored_horizon_bucket IN ('0-24h', '25-72h')
      AND display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources AS s
        WHERE s.source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) >= 75
  FROM coverage
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE horizon_bucket IN ('0-24h', '25-72h')
      AND observed_m > 0
      AND (
        stored_horizon_bucket NOT IN ('0-24h', '25-72h')
        OR stored_horizon_bucket IS NULL
        OR display_wave_source IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = display_wave_source
        )
        OR display_raw_input_height_m IS NULL
        OR display_raw_input_height_m < 0
      )
  ) = 0
  FROM coverage
  UNION ALL
  SELECT COUNT(*) FILTER (WHERE approval_0_72h_rows >= 25) = 3
  FROM coverage_by_beach
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase2_monterey_bay_preflight_assertions_passed
FROM assertions
\gset

SELECT
  :phase2_monterey_bay_preflight_assertions_passed
    AS phase2_monterey_bay_preflight_assertions_passed;

\else

SELECT 'phase2_monterey_bay_observed_30d' AS check_name;

SELECT
  'skipped_missing_phase0_schema' AS horizon_bucket,
  0::bigint AS total_rows,
  0::bigint AS observed_rows,
  0::bigint AS approval_0_72h_rows,
  0::bigint AS observed_0_72h_rows_without_approval_provenance;

SELECT 'phase2_monterey_bay_preflight_assertions' AS check_name;

WITH assertions AS (
  SELECT 'phase2_monterey_bay_phase0_schema_ready' AS assertion, false AS passed
  UNION ALL
  SELECT 'approval_0_72h_rows_at_least_75', false
  UNION ALL
  SELECT 'all_targets_approval_0_72h_rows_at_least_25', false
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

SELECT 'phase2_monterey_bay_preflight_blockers' AS check_name;

SELECT blocker_code, blocker_message, detail
FROM (
  VALUES
    (
      'phase2_monterey_bay_phase0_schema_ready',
      'Phase 0 schema/RPC prerequisites are not live.',
      'skipped_missing_phase0_schema'
    ),
    (
      'approval_0_72h_rows_at_least_75',
      'Skipped approval-provenanced aggregate sample check because Phase 0 schema is not live.',
      'skipped_missing_phase0_schema'
    ),
    (
      'all_targets_approval_0_72h_rows_at_least_25',
      'Skipped per-beach approval-provenanced sample check because Phase 0 schema is not live.',
      'skipped_missing_phase0_schema'
    )
) blockers(blocker_code, blocker_message, detail)
ORDER BY blocker_code;

SELECT 0 AS phase2_monterey_bay_preflight_assertions_passed
\gset

SELECT
  :phase2_monterey_bay_preflight_assertions_passed
    AS phase2_monterey_bay_preflight_assertions_passed;

\endif

\if :phase2_monterey_bay_preflight_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 2 Monterey Bay terrain preflight assertions failed; see phase2_monterey_bay_preflight_blockers and phase2_monterey_bay_preflight_assertions above.';
END
$$;
\endif
