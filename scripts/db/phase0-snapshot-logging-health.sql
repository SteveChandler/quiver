-- Read-only health check for deployed forecast snapshot logging.
--
-- Run after the Phase 0 application deploy, before requesting migration
-- approval. Pass the deploy timestamp when available so the check proves rows
-- landed after that deployment:
--   psql "$POSTGRES_URL_NON_POOLING" \
--     -v ON_ERROR_STOP=1 \
--     -v phase0_snapshot_min_created_at='2026-06-19T18:00:00Z' \
--     -f scripts/db/phase0-snapshot-logging-health.sql
--
-- If no timestamp is supplied, the script checks the latest 24 hours.

BEGIN READ ONLY;

\set phase0_snapshot_logging_health_assertions_passed 0

\if :{?phase0_snapshot_min_created_at}
SELECT :'phase0_snapshot_min_created_at'::timestamptz AS phase0_snapshot_min_created_at
\gset
\else
SELECT now() - interval '24 hours' AS phase0_snapshot_min_created_at
\gset
\endif

SELECT 'phase0_snapshot_logging_health_parameters' AS check_name;

SELECT
  :'phase0_snapshot_min_created_at'::timestamptz AS min_created_at,
  now() AS checked_at;

SELECT 'phase0_snapshot_logging_schema_state' AS check_name;

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
    'index',
    'idx_ml_predictions_display_horizon_source_unique',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ml_predictions_log'
        AND indexname = 'idx_ml_predictions_display_horizon_source_unique'
    )
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
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ml_predictions_log'
      AND indexname = 'idx_ml_predictions_display_horizon_source_unique'
  )
)
SELECT
  CASE
    WHEN bool_and(exists_now) THEN 'true'
    ELSE 'false'
  END AS phase0_snapshot_health_has_phase0_schema,
  CASE
    WHEN bool_or(exists_now) AND NOT bool_and(exists_now) THEN 'true'
    ELSE 'false'
  END AS phase0_snapshot_health_has_partial_phase0_schema
FROM checks
\gset

\if :phase0_snapshot_health_has_partial_phase0_schema

SELECT 'phase0_snapshot_logging_health_partial_schema_assertion' AS check_name;

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
    'index',
    'idx_ml_predictions_display_horizon_source_unique',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ml_predictions_log'
        AND indexname = 'idx_ml_predictions_display_horizon_source_unique'
    )
),
summary AS (
  SELECT
    COUNT(*) FILTER (WHERE exists_now) AS present_objects,
    COUNT(*) FILTER (WHERE NOT exists_now) AS missing_objects,
    string_agg(object_name, ', ' ORDER BY object_name)
      FILTER (WHERE exists_now) AS present_object_names,
    string_agg(object_name, ', ' ORDER BY object_name)
      FILTER (WHERE NOT exists_now) AS missing_object_names
  FROM checks
)
SELECT
  present_objects,
  missing_objects,
  COALESCE(present_object_names, 'none') AS present_object_names,
  COALESCE(missing_object_names, 'none') AS missing_object_names
FROM summary;

SELECT
  0 AS phase0_snapshot_logging_health_partial_schema_assertion_passed
FROM summary
\gset

SELECT
  :phase0_snapshot_logging_health_partial_schema_assertion_passed
    AS phase0_snapshot_logging_health_partial_schema_assertion_passed;

SELECT 'phase0_snapshot_logging_health_blockers' AS check_name;

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
    'index',
    'idx_ml_predictions_display_horizon_source_unique',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ml_predictions_log'
        AND indexname = 'idx_ml_predictions_display_horizon_source_unique'
    )
),
summary AS (
  SELECT
    COUNT(*) FILTER (WHERE exists_now) AS present_objects,
    COUNT(*) FILTER (WHERE NOT exists_now) AS missing_objects,
    string_agg(object_name, ', ' ORDER BY object_name)
      FILTER (WHERE exists_now) AS present_object_names,
    string_agg(object_name, ', ' ORDER BY object_name)
      FILTER (WHERE NOT exists_now) AS missing_object_names
  FROM checks
)
SELECT
  'partial_phase0_schema' AS blocker_code,
  'Some Phase 0 schema objects are present and others are missing.' AS blocker_message,
  CONCAT(
    'present=',
    present_objects,
    ', missing=',
    missing_objects,
    ', present_objects=',
    COALESCE(present_object_names, 'none'),
    ', missing_objects=',
    COALESCE(missing_object_names, 'none')
  ) AS detail
FROM summary
ORDER BY blocker_code;

\elif :phase0_snapshot_health_has_phase0_schema

SELECT 'phase0_snapshot_logging_health_phase0_window' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
recent AS (
  SELECT
    beach_id,
    forecast_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m,
    raw_display_height_m,
    offset_corrected_display_height_m,
    created_at
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
)
SELECT
  forecast_horizon_bucket AS stored_horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT beach_id) AS distinct_beaches,
  COUNT(*) FILTER (
    WHERE forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+')
  ) AS rows_with_horizon_bucket_provenance,
  COUNT(*) FILTER (
    WHERE forecast_horizon_bucket IS NULL
       OR forecast_horizon_bucket NOT IN ('0-24h', '25-72h', '73h+')
  ) AS rows_missing_horizon_bucket_provenance,
  COUNT(*) FILTER (
    WHERE display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources
        WHERE source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) AS rows_with_replay_provenance,
  COUNT(*) FILTER (
    WHERE display_wave_source IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM allowed_wave_sources
         WHERE source_tag = display_wave_source
       )
       OR display_raw_input_height_m IS NULL
       OR display_raw_input_height_m < 0
  ) AS rows_missing_replay_provenance,
  COUNT(*) FILTER (
    WHERE raw_display_height_m IS NULL
       OR offset_corrected_display_height_m IS NULL
  ) AS rows_missing_display_heights,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM recent
GROUP BY forecast_horizon_bucket
ORDER BY
  CASE forecast_horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_snapshot_logging_health_assertions' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
recent AS (
  SELECT
    forecast_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m,
    raw_display_height_m,
    offset_corrected_display_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
summary AS (
  SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket = '0-24h'
    ) AS fresh_0_24h_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket = '25-72h'
    ) AS fresh_25_72h_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket IS NULL
         OR forecast_horizon_bucket NOT IN ('0-24h', '25-72h', '73h+')
    ) AS rows_missing_horizon_bucket_provenance,
    COUNT(*) FILTER (
      WHERE display_wave_source IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM allowed_wave_sources
           WHERE source_tag = display_wave_source
         )
         OR display_raw_input_height_m IS NULL
         OR display_raw_input_height_m < 0
    ) AS rows_missing_replay_provenance,
    COUNT(*) FILTER (
      WHERE raw_display_height_m IS NULL
         OR offset_corrected_display_height_m IS NULL
    ) AS rows_missing_display_heights
  FROM recent
),
assertions AS (
  SELECT
    'recent_face_hs_rows_present' AS assertion_name,
    total_rows > 0 AS passed,
    total_rows::text AS detail
  FROM summary
  UNION ALL
  SELECT
    'phase0_fresh_0_24h_rows_present',
    total_rows > 0 AND fresh_0_24h_rows > 0,
    fresh_0_24h_rows::text
  FROM summary
  UNION ALL
  SELECT
    'phase0_fresh_25_72h_rows_present',
    total_rows > 0 AND fresh_25_72h_rows > 0,
    fresh_25_72h_rows::text
  FROM summary
  UNION ALL
  SELECT
    'phase0_horizon_bucket_provenance_complete',
    total_rows > 0 AND rows_missing_horizon_bucket_provenance = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_horizon_bucket_provenance)
  FROM summary
  UNION ALL
  SELECT
    'phase0_replay_provenance_complete',
    total_rows > 0 AND rows_missing_replay_provenance = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_replay_provenance)
  FROM summary
  UNION ALL
  SELECT
    'display_heights_complete',
    total_rows > 0 AND rows_missing_display_heights = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_display_heights)
  FROM summary
)
SELECT assertion_name, passed, detail
FROM assertions
ORDER BY assertion_name;

SELECT 'phase0_snapshot_logging_health_blockers' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
recent AS (
  SELECT
    forecast_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m,
    raw_display_height_m,
    offset_corrected_display_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
summary AS (
  SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket = '0-24h'
    ) AS fresh_0_24h_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket = '25-72h'
    ) AS fresh_25_72h_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket IS NULL
         OR forecast_horizon_bucket NOT IN ('0-24h', '25-72h', '73h+')
    ) AS rows_missing_horizon_bucket_provenance,
    COUNT(*) FILTER (
      WHERE display_wave_source IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM allowed_wave_sources
           WHERE source_tag = display_wave_source
         )
         OR display_raw_input_height_m IS NULL
         OR display_raw_input_height_m < 0
    ) AS rows_missing_replay_provenance,
    COUNT(*) FILTER (
      WHERE raw_display_height_m IS NULL
         OR offset_corrected_display_height_m IS NULL
    ) AS rows_missing_display_heights
  FROM recent
),
assertions AS (
  SELECT
    'recent_face_hs_rows_present' AS blocker_code,
    'No fresh canonical face-Hs snapshot rows landed in the checked window.' AS blocker_message,
    total_rows > 0 AS passed,
    total_rows::text AS detail
  FROM summary
  UNION ALL
  SELECT
    'phase0_fresh_0_24h_rows_present',
    'No fresh Phase 0 0-24h snapshot rows landed in the checked window.',
    total_rows > 0 AND fresh_0_24h_rows > 0,
    fresh_0_24h_rows::text
  FROM summary
  UNION ALL
  SELECT
    'phase0_fresh_25_72h_rows_present',
    'No fresh Phase 0 25-72h snapshot rows landed in the checked window.',
    total_rows > 0 AND fresh_25_72h_rows > 0,
    fresh_25_72h_rows::text
  FROM summary
  UNION ALL
  SELECT
    'phase0_horizon_bucket_provenance_complete',
    'Fresh Phase 0 rows are missing stored horizon-bucket provenance.',
    total_rows > 0 AND rows_missing_horizon_bucket_provenance = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_horizon_bucket_provenance)
  FROM summary
  UNION ALL
  SELECT
    'phase0_replay_provenance_complete',
    'Fresh Phase 0 rows are missing display replay provenance.',
    total_rows > 0 AND rows_missing_replay_provenance = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_replay_provenance)
  FROM summary
  UNION ALL
  SELECT
    'display_heights_complete',
    'Fresh canonical rows are missing display height fields.',
    total_rows > 0 AND rows_missing_display_heights = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_display_heights)
  FROM summary
)
SELECT blocker_code, blocker_message, detail
FROM assertions
WHERE NOT passed
ORDER BY blocker_code;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
recent AS (
  SELECT
    forecast_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m,
    raw_display_height_m,
    offset_corrected_display_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
summary AS (
  SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket = '0-24h'
    ) AS fresh_0_24h_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket = '25-72h'
    ) AS fresh_25_72h_rows,
    COUNT(*) FILTER (
      WHERE forecast_horizon_bucket IS NULL
         OR forecast_horizon_bucket NOT IN ('0-24h', '25-72h', '73h+')
    ) AS rows_missing_horizon_bucket_provenance,
    COUNT(*) FILTER (
      WHERE display_wave_source IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM allowed_wave_sources
           WHERE source_tag = display_wave_source
         )
         OR display_raw_input_height_m IS NULL
         OR display_raw_input_height_m < 0
    ) AS rows_missing_replay_provenance,
    COUNT(*) FILTER (
      WHERE raw_display_height_m IS NULL
         OR offset_corrected_display_height_m IS NULL
    ) AS rows_missing_display_heights
  FROM recent
),
assertions AS (
  SELECT total_rows > 0 AS passed
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND fresh_0_24h_rows > 0
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND fresh_25_72h_rows > 0
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND rows_missing_horizon_bucket_provenance = 0
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND rows_missing_replay_provenance = 0
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND rows_missing_display_heights = 0
  FROM summary
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase0_snapshot_logging_health_assertions_passed
FROM assertions
\gset

SELECT
  :phase0_snapshot_logging_health_assertions_passed
    AS phase0_snapshot_logging_health_assertions_passed;

\else

SELECT 'phase0_snapshot_logging_health_legacy_window' AS check_name;

WITH recent AS (
  SELECT
    beach_id,
    forecast_horizon_hours,
    model_version,
    raw_display_height_m,
    offset_corrected_display_height_m,
    created_at
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
bucketed AS (
  SELECT
    beach_id,
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS computed_horizon_bucket,
    forecast_horizon_hours,
    model_version,
    raw_display_height_m,
    offset_corrected_display_height_m,
    created_at
  FROM recent
)
SELECT
  computed_horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT beach_id) AS distinct_beaches,
  COUNT(*) FILTER (
    WHERE model_version = 'face-Hs-transformer-v1'
  ) AS rows_with_canonical_model_version,
  COUNT(*) FILTER (
    WHERE model_version IS DISTINCT FROM 'face-Hs-transformer-v1'
  ) AS rows_missing_canonical_model_version,
  COUNT(*) FILTER (
    WHERE forecast_horizon_hours BETWEEN 0 AND 168
      AND computed_horizon_bucket IN ('0-24h', '25-72h', '73h+')
  ) AS rows_with_valid_horizon_hours,
  COUNT(*) FILTER (
    WHERE forecast_horizon_hours IS NULL
       OR forecast_horizon_hours < 0
       OR forecast_horizon_hours > 168
       OR computed_horizon_bucket IS NULL
  ) AS rows_missing_valid_horizon_hours,
  COUNT(*) FILTER (
    WHERE raw_display_height_m IS NULL
       OR offset_corrected_display_height_m IS NULL
  ) AS rows_missing_display_heights,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM bucketed
GROUP BY computed_horizon_bucket
ORDER BY
  CASE computed_horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_snapshot_logging_health_assertions' AS check_name;

WITH recent AS (
  SELECT
    forecast_horizon_hours,
    model_version,
    raw_display_height_m,
    offset_corrected_display_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
summary AS (
  SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
      WHERE model_version IS DISTINCT FROM 'face-Hs-transformer-v1'
    ) AS rows_missing_canonical_model_version,
    COUNT(*) FILTER (
      WHERE forecast_horizon_hours IS NULL
         OR forecast_horizon_hours < 0
         OR forecast_horizon_hours > 168
    ) AS rows_missing_valid_horizon_hours,
    COUNT(*) FILTER (
      WHERE raw_display_height_m IS NULL
         OR offset_corrected_display_height_m IS NULL
    ) AS rows_missing_display_heights
  FROM recent
),
assertions AS (
  SELECT
    'legacy_recent_face_hs_rows_present' AS assertion_name,
    total_rows > 0 AS passed,
    total_rows::text AS detail
  FROM summary
  UNION ALL
  SELECT
    'legacy_model_version_contract_complete',
    total_rows > 0 AND rows_missing_canonical_model_version = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_canonical_model_version)
  FROM summary
  UNION ALL
  SELECT
    'legacy_horizon_hours_valid',
    total_rows > 0 AND rows_missing_valid_horizon_hours = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_valid_horizon_hours)
  FROM summary
  UNION ALL
  SELECT
    'legacy_display_heights_complete',
    total_rows > 0 AND rows_missing_display_heights = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_display_heights)
  FROM summary
)
SELECT assertion_name, passed, detail
FROM assertions
ORDER BY assertion_name;

SELECT 'phase0_snapshot_logging_health_blockers' AS check_name;

WITH recent AS (
  SELECT
    forecast_horizon_hours,
    model_version,
    raw_display_height_m,
    offset_corrected_display_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
summary AS (
  SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
      WHERE model_version IS DISTINCT FROM 'face-Hs-transformer-v1'
    ) AS rows_missing_canonical_model_version,
    COUNT(*) FILTER (
      WHERE forecast_horizon_hours IS NULL
         OR forecast_horizon_hours < 0
         OR forecast_horizon_hours > 168
    ) AS rows_missing_valid_horizon_hours,
    COUNT(*) FILTER (
      WHERE raw_display_height_m IS NULL
         OR offset_corrected_display_height_m IS NULL
    ) AS rows_missing_display_heights
  FROM recent
),
assertions AS (
  SELECT
    'legacy_recent_face_hs_rows_present' AS blocker_code,
    'No fresh canonical face-Hs snapshot rows landed in the checked legacy-schema window.' AS blocker_message,
    total_rows > 0 AS passed,
    total_rows::text AS detail
  FROM summary
  UNION ALL
  SELECT
    'legacy_model_version_contract_complete',
    'Recent legacy-schema rows are missing canonical face-Hs model_version.',
    total_rows > 0 AND rows_missing_canonical_model_version = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_canonical_model_version)
  FROM summary
  UNION ALL
  SELECT
    'legacy_horizon_hours_valid',
    'Recent legacy-schema rows have invalid forecast_horizon_hours.',
    total_rows > 0 AND rows_missing_valid_horizon_hours = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_valid_horizon_hours)
  FROM summary
  UNION ALL
  SELECT
    'legacy_display_heights_complete',
    'Recent legacy-schema rows are missing display height fields.',
    total_rows > 0 AND rows_missing_display_heights = 0,
    CONCAT('total=', total_rows, ', missing=', rows_missing_display_heights)
  FROM summary
)
SELECT blocker_code, blocker_message, detail
FROM assertions
WHERE NOT passed
ORDER BY blocker_code;

WITH recent AS (
  SELECT
    forecast_horizon_hours,
    model_version,
    raw_display_height_m,
    offset_corrected_display_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= :'phase0_snapshot_min_created_at'::timestamptz
    AND display_source = 'face-Hs-transformer-v1'
),
summary AS (
  SELECT
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
      WHERE model_version IS DISTINCT FROM 'face-Hs-transformer-v1'
    ) AS rows_missing_canonical_model_version,
    COUNT(*) FILTER (
      WHERE forecast_horizon_hours IS NULL
         OR forecast_horizon_hours < 0
         OR forecast_horizon_hours > 168
    ) AS rows_missing_valid_horizon_hours,
    COUNT(*) FILTER (
      WHERE raw_display_height_m IS NULL
         OR offset_corrected_display_height_m IS NULL
    ) AS rows_missing_display_heights
  FROM recent
),
assertions AS (
  SELECT total_rows > 0 AS passed
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND rows_missing_canonical_model_version = 0
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND rows_missing_valid_horizon_hours = 0
  FROM summary
  UNION ALL
  SELECT total_rows > 0 AND rows_missing_display_heights = 0
  FROM summary
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase0_snapshot_logging_health_assertions_passed
FROM assertions
\gset

SELECT
  :phase0_snapshot_logging_health_assertions_passed
    AS phase0_snapshot_logging_health_assertions_passed;

\endif

\if :phase0_snapshot_logging_health_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 0 snapshot logging health failed; see phase0_snapshot_logging_health_blockers and phase0_snapshot_logging_health_assertions above.';
END
$$;
\endif
