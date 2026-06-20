-- Read-only preflight for:
--   supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
--
-- Run before requesting production approval:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-preflight.sql

BEGIN READ ONLY;

\set phase0_preflight_assertions_passed 0

SELECT 'phase0_existing_objects' AS check_name;

SELECT object_type, object_name, exists_now
FROM (
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
    'idx_ml_predictions_beach_predicted_at_unique',
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ml_predictions_log'
        AND indexname = 'idx_ml_predictions_beach_predicted_at_unique'
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
  UNION ALL
  SELECT
    'function',
    'get_forecast_accuracy_horizon_metrics',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
    )
) checks
ORDER BY object_type, object_name;

SELECT 'phase0_required_columns' AS check_name;

SELECT required.column_name, (actual.column_name IS NOT NULL) AS exists_now
FROM (
  VALUES
    ('created_at'),
    ('display_source'),
    ('forecast_horizon_hours'),
    ('model_version'),
    ('observed_m'),
    ('raw_display_height_m'),
    ('offset_corrected_display_height_m'),
    ('wave_height_om'),
    ('v5_shadow_height_m'),
    ('noaa_swell_1_height_m'),
    ('noaa_swell_1_period_s'),
    ('noaa_swell_1_direction_deg'),
    ('noaa_swell_2_height_m'),
    ('noaa_swell_2_period_s'),
    ('noaa_swell_2_direction_deg'),
    ('noaa_wind_wave_height_m'),
    ('noaa_wind_wave_period_s'),
    ('noaa_wind_wave_direction_deg')
) AS required(column_name)
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'public'
 AND actual.table_name = 'ml_predictions_log'
 AND actual.column_name = required.column_name
ORDER BY required.column_name;

SELECT 'phase0_required_columns_assertion' AS check_name;

WITH required AS (
  SELECT column_name
  FROM (
    VALUES
      ('created_at'),
      ('display_source'),
      ('forecast_horizon_hours'),
      ('model_version'),
      ('observed_m'),
      ('raw_display_height_m'),
      ('offset_corrected_display_height_m'),
      ('wave_height_om'),
      ('v5_shadow_height_m'),
      ('noaa_swell_1_height_m'),
      ('noaa_swell_1_period_s'),
      ('noaa_swell_1_direction_deg'),
      ('noaa_swell_2_height_m'),
      ('noaa_swell_2_period_s'),
      ('noaa_swell_2_direction_deg'),
      ('noaa_wind_wave_height_m'),
      ('noaa_wind_wave_period_s'),
      ('noaa_wind_wave_direction_deg')
  ) AS required(column_name)
),
missing AS (
  SELECT required.column_name
  FROM required
  LEFT JOIN information_schema.columns actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'ml_predictions_log'
   AND actual.column_name = required.column_name
  WHERE actual.column_name IS NULL
)
SELECT
  COUNT(*) AS missing_required_columns,
  COALESCE(string_agg(column_name, ', ' ORDER BY column_name), 'none') AS missing_columns,
  CASE
    WHEN COUNT(*) = 0 THEN 1
    ELSE 0
  END AS phase0_required_columns_assertion_passed
FROM missing;

SELECT 'phase0_new_unique_index_duplicate_risk' AS check_name;

WITH bucketed AS (
  SELECT
    beach_id,
    predicted_at,
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS forecast_horizon_bucket,
    display_source
  FROM public.ml_predictions_log
),
duplicate_groups AS (
  SELECT
    beach_id,
    predicted_at,
    forecast_horizon_bucket,
    display_source,
    COUNT(*) AS row_count
  FROM bucketed
  GROUP BY beach_id, predicted_at, forecast_horizon_bucket, display_source
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*) AS duplicate_groups,
  COALESCE(SUM(row_count - 1), 0) AS duplicate_rows
FROM duplicate_groups;

SELECT 'phase0_new_unique_index_duplicate_risk_assertion' AS check_name;

WITH bucketed AS (
  SELECT
    beach_id,
    predicted_at,
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS forecast_horizon_bucket,
    display_source
  FROM public.ml_predictions_log
),
duplicate_groups AS (
  SELECT
    beach_id,
    predicted_at,
    forecast_horizon_bucket,
    display_source,
    COUNT(*) AS row_count
  FROM bucketed
  GROUP BY beach_id, predicted_at, forecast_horizon_bucket, display_source
  HAVING COUNT(*) > 1
),
summary AS (
  SELECT
    COUNT(*) AS duplicate_groups,
    COALESCE(SUM(row_count - 1), 0) AS duplicate_rows
  FROM duplicate_groups
)
SELECT
  duplicate_groups,
  duplicate_rows,
  CASE
    WHEN duplicate_groups = 0 AND duplicate_rows = 0 THEN 1
    ELSE 0
  END AS phase0_new_unique_index_duplicate_risk_assertion_passed
FROM summary;

SELECT 'phase0_face_hs_display_source_contract_30d' AS check_name;

WITH candidate_rows AS (
  SELECT
    display_source,
    model_version
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND (
      display_source = 'face-Hs-transformer-v1'
      OR model_version = 'face-Hs-transformer-v1'
      OR raw_display_height_m IS NOT NULL
      OR offset_corrected_display_height_m IS NOT NULL
    )
)
SELECT
  COUNT(*) AS candidate_rows,
  COUNT(*) FILTER (
    WHERE display_source = 'face-Hs-transformer-v1'
  ) AS face_hs_display_source_rows,
  COUNT(*) FILTER (
    WHERE model_version = 'face-Hs-transformer-v1'
      AND display_source IS DISTINCT FROM 'face-Hs-transformer-v1'
  ) AS model_version_face_hs_without_display_source_rows,
  COUNT(*) FILTER (
    WHERE display_source IS NULL
  ) AS missing_display_source_rows,
  COUNT(*) FILTER (
    WHERE display_source IS NOT NULL
      AND display_source <> 'face-Hs-transformer-v1'
  ) AS other_display_source_rows
FROM candidate_rows;

SELECT 'phase0_face_hs_display_source_contract_assertion' AS check_name;

WITH candidate_rows AS (
  SELECT
    display_source,
    model_version
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND (
      display_source = 'face-Hs-transformer-v1'
      OR model_version = 'face-Hs-transformer-v1'
      OR raw_display_height_m IS NOT NULL
      OR offset_corrected_display_height_m IS NOT NULL
    )
),
summary AS (
  SELECT
    COUNT(*) AS candidate_rows,
    COUNT(*) FILTER (
      WHERE display_source = 'face-Hs-transformer-v1'
    ) AS face_hs_display_source_rows,
    COUNT(*) FILTER (
      WHERE model_version = 'face-Hs-transformer-v1'
        AND display_source IS DISTINCT FROM 'face-Hs-transformer-v1'
    ) AS model_version_face_hs_without_display_source_rows
  FROM candidate_rows
)
SELECT
  candidate_rows,
  face_hs_display_source_rows,
  model_version_face_hs_without_display_source_rows,
  CASE
    WHEN face_hs_display_source_rows > 0
      AND model_version_face_hs_without_display_source_rows = 0
    THEN 1
    ELSE 0
  END AS phase0_face_hs_display_source_contract_assertion_passed
FROM summary;

SELECT 'phase0_current_horizon_coverage_30d' AS check_name;

WITH coverage AS (
  SELECT
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE 'unknown'
    END AS horizon_bucket,
    observed_m,
    created_at
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND display_source = 'face-Hs-transformer-v1'
)
SELECT
  horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE observed_m > 0) AS observed_rows,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM coverage
GROUP BY horizon_bucket
ORDER BY
  CASE horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_current_short_horizon_freshness_24h' AS check_name;

WITH coverage AS (
  SELECT
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE 'unknown'
    END AS horizon_bucket,
    observed_m,
    created_at
  FROM public.ml_predictions_log
  WHERE created_at >= now() - interval '24 hours'
    AND display_source = 'face-Hs-transformer-v1'
)
SELECT
  horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE observed_m > 0) AS observed_rows,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM coverage
GROUP BY horizon_bucket
ORDER BY
  CASE horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_legacy_current_0_72h_slot_horizon_shape' AS check_name;

WITH current_short_slots AS (
  SELECT
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE 'unknown'
    END AS logged_horizon_bucket,
    created_at
  FROM public.ml_predictions_log
  WHERE predicted_at >= now()
    AND predicted_at < now() + interval '72 hours'
    AND display_source = 'face-Hs-transformer-v1'
)
SELECT
  logged_horizon_bucket,
  COUNT(*) AS rows,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS created_last_24h,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM current_short_slots
GROUP BY logged_horizon_bucket
ORDER BY
  CASE logged_horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_preflight_readiness_summary' AS check_name;

WITH required_columns AS (
  SELECT column_name
  FROM (
    VALUES
      ('created_at'),
      ('display_source'),
      ('forecast_horizon_hours'),
      ('model_version'),
      ('observed_m'),
      ('raw_display_height_m'),
      ('offset_corrected_display_height_m'),
      ('wave_height_om'),
      ('v5_shadow_height_m'),
      ('noaa_swell_1_height_m'),
      ('noaa_swell_1_period_s'),
      ('noaa_swell_1_direction_deg'),
      ('noaa_swell_2_height_m'),
      ('noaa_swell_2_period_s'),
      ('noaa_swell_2_direction_deg'),
      ('noaa_wind_wave_height_m'),
      ('noaa_wind_wave_period_s'),
      ('noaa_wind_wave_direction_deg')
  ) AS required(column_name)
),
required_column_summary AS (
  SELECT
    COUNT(*) FILTER (WHERE actual.column_name IS NULL) AS missing_required_columns
  FROM required_columns
  LEFT JOIN information_schema.columns actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'ml_predictions_log'
   AND actual.column_name = required_columns.column_name
),
bucketed AS (
  SELECT
    beach_id,
    predicted_at,
    CASE
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS forecast_horizon_bucket,
    display_source
  FROM public.ml_predictions_log
),
duplicate_summary AS (
  SELECT
    COUNT(*) AS duplicate_groups,
    COALESCE(SUM(row_count - 1), 0) AS duplicate_rows
  FROM (
    SELECT
      beach_id,
      predicted_at,
      forecast_horizon_bucket,
      display_source,
      COUNT(*) AS row_count
    FROM bucketed
    GROUP BY beach_id, predicted_at, forecast_horizon_bucket, display_source
    HAVING COUNT(*) > 1
  ) duplicate_groups
),
face_hs_source_summary AS (
  SELECT
    COUNT(*) FILTER (
      WHERE display_source = 'face-Hs-transformer-v1'
    ) AS face_hs_display_source_rows,
    COUNT(*) FILTER (
      WHERE model_version = 'face-Hs-transformer-v1'
        AND display_source IS DISTINCT FROM 'face-Hs-transformer-v1'
    ) AS model_version_face_hs_without_display_source_rows
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND (
      display_source = 'face-Hs-transformer-v1'
      OR model_version = 'face-Hs-transformer-v1'
      OR raw_display_height_m IS NOT NULL
      OR offset_corrected_display_height_m IS NOT NULL
    )
),
object_summary AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ml_predictions_log'
        AND indexname = 'idx_ml_predictions_beach_predicted_at_unique'
    ) AS legacy_unique_index_present,
    EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'ml_predictions_log'
        AND indexname = 'idx_ml_predictions_display_horizon_source_unique'
    ) AS horizon_source_unique_index_present,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'forecast_horizon_bucket'
    ) AS forecast_horizon_bucket_column_present,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_wave_source'
    ) AS display_wave_source_column_present,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_raw_input_height_m'
    ) AS display_raw_input_height_column_present,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
    ) AS canonical_accuracy_rpc_present
),
legacy_current_slot_shape AS (
  SELECT
    COUNT(*) FILTER (
      WHERE logged_horizon_bucket IN ('0-24h', '25-72h')
    ) AS current_0_72h_slots_logged_short_horizon,
    COUNT(*) FILTER (
      WHERE logged_horizon_bucket = '73h+'
    ) AS current_0_72h_slots_logged_73h_plus,
    COUNT(*) FILTER (
      WHERE logged_horizon_bucket IN ('0-24h', '25-72h')
        AND created_at >= now() - interval '24 hours'
    ) AS current_0_72h_slots_logged_short_horizon_last_24h
  FROM (
    SELECT
      CASE
        WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
        WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
        WHEN forecast_horizon_hours >= 73 THEN '73h+'
        ELSE 'unknown'
      END AS logged_horizon_bucket,
      created_at
    FROM public.ml_predictions_log
    WHERE predicted_at >= now()
      AND predicted_at < now() + interval '72 hours'
      AND display_source = 'face-Hs-transformer-v1'
  ) current_slots
),
summary AS (
  SELECT
    required_column_summary.missing_required_columns = 0 AS required_columns_present,
    duplicate_summary.duplicate_groups = 0
      AND duplicate_summary.duplicate_rows = 0 AS new_unique_index_duplicate_risk_clear,
    face_hs_source_summary.face_hs_display_source_rows > 0
      AND face_hs_source_summary.model_version_face_hs_without_display_source_rows = 0 AS face_hs_display_source_contract_clear,
    object_summary.legacy_unique_index_present,
    object_summary.horizon_source_unique_index_present,
    object_summary.forecast_horizon_bucket_column_present,
    object_summary.display_wave_source_column_present,
    object_summary.display_raw_input_height_column_present,
    object_summary.canonical_accuracy_rpc_present,
    object_summary.legacy_unique_index_present
      AND NOT object_summary.horizon_source_unique_index_present
      AND NOT object_summary.forecast_horizon_bucket_column_present
      AND NOT object_summary.display_wave_source_column_present
      AND NOT object_summary.display_raw_input_height_column_present
      AND NOT object_summary.canonical_accuracy_rpc_present
      AS pre_migration_schema_shape_clear,
    legacy_current_slot_shape.current_0_72h_slots_logged_short_horizon,
    legacy_current_slot_shape.current_0_72h_slots_logged_73h_plus,
    legacy_current_slot_shape.current_0_72h_slots_logged_short_horizon_last_24h,
    legacy_current_slot_shape.current_0_72h_slots_logged_short_horizon_last_24h = 0
      AND legacy_current_slot_shape.current_0_72h_slots_logged_73h_plus > 0
      AS legacy_short_horizon_starvation_detected
  FROM required_column_summary
  CROSS JOIN duplicate_summary
  CROSS JOIN face_hs_source_summary
  CROSS JOIN object_summary
  CROSS JOIN legacy_current_slot_shape
)
SELECT
  required_columns_present,
  new_unique_index_duplicate_risk_clear,
  face_hs_display_source_contract_clear,
  legacy_unique_index_present,
  horizon_source_unique_index_present,
  forecast_horizon_bucket_column_present,
  display_wave_source_column_present,
  display_raw_input_height_column_present,
  canonical_accuracy_rpc_present,
  pre_migration_schema_shape_clear,
  current_0_72h_slots_logged_short_horizon,
  current_0_72h_slots_logged_73h_plus,
  current_0_72h_slots_logged_short_horizon_last_24h,
  legacy_short_horizon_starvation_detected,
  (
    required_columns_present
    AND new_unique_index_duplicate_risk_clear
    AND face_hs_display_source_contract_clear
    AND pre_migration_schema_shape_clear
  ) AS can_request_phase0_migration_approval
FROM summary
\gset

SELECT
  :'required_columns_present'::boolean AS required_columns_present,
  :'new_unique_index_duplicate_risk_clear'::boolean AS new_unique_index_duplicate_risk_clear,
  :'face_hs_display_source_contract_clear'::boolean AS face_hs_display_source_contract_clear,
  :'legacy_unique_index_present'::boolean AS legacy_unique_index_present,
  :'horizon_source_unique_index_present'::boolean AS horizon_source_unique_index_present,
  :'forecast_horizon_bucket_column_present'::boolean AS forecast_horizon_bucket_column_present,
  :'display_wave_source_column_present'::boolean AS display_wave_source_column_present,
  :'display_raw_input_height_column_present'::boolean AS display_raw_input_height_column_present,
  :'canonical_accuracy_rpc_present'::boolean AS canonical_accuracy_rpc_present,
  :'pre_migration_schema_shape_clear'::boolean AS pre_migration_schema_shape_clear,
  :'current_0_72h_slots_logged_short_horizon'::bigint AS current_0_72h_slots_logged_short_horizon,
  :'current_0_72h_slots_logged_73h_plus'::bigint AS current_0_72h_slots_logged_73h_plus,
  :'current_0_72h_slots_logged_short_horizon_last_24h'::bigint AS current_0_72h_slots_logged_short_horizon_last_24h,
  :'legacy_short_horizon_starvation_detected'::boolean AS legacy_short_horizon_starvation_detected,
  :'can_request_phase0_migration_approval'::boolean AS can_request_phase0_migration_approval;

SELECT 'phase0_preflight_blockers' AS check_name;

SELECT blocker_code, blocker_message
FROM (
  VALUES
    (
      'required_columns_missing',
      'One or more source ml_predictions_log columns required by Phase 0 are missing.',
      NOT :'required_columns_present'::boolean
    ),
    (
      'new_unique_index_duplicate_risk',
      'Existing rows would violate the Phase 0 horizon/source unique index.',
      NOT :'new_unique_index_duplicate_risk_clear'::boolean
    ),
    (
      'face_hs_display_source_contract_failed',
      'Recent face-Hs rows do not consistently use display_source = face-Hs-transformer-v1.',
      NOT :'face_hs_display_source_contract_clear'::boolean
    ),
    (
      'legacy_unique_index_missing',
      'The legacy (beach_id, predicted_at) unique index is missing before migration apply.',
      NOT :'legacy_unique_index_present'::boolean
    ),
    (
      'horizon_source_unique_index_already_present',
      'The Phase 0 horizon/source unique index is already present before migration approval.',
      :'horizon_source_unique_index_present'::boolean
    ),
    (
      'forecast_horizon_bucket_column_already_present',
      'ml_predictions_log.forecast_horizon_bucket already exists before migration approval.',
      :'forecast_horizon_bucket_column_present'::boolean
    ),
    (
      'display_wave_source_column_already_present',
      'ml_predictions_log.display_wave_source already exists before migration approval.',
      :'display_wave_source_column_present'::boolean
    ),
    (
      'display_raw_input_height_column_already_present',
      'ml_predictions_log.display_raw_input_height_m already exists before migration approval.',
      :'display_raw_input_height_column_present'::boolean
    ),
    (
      'canonical_accuracy_rpc_already_present',
      'get_forecast_accuracy_horizon_metrics already exists before migration approval.',
      :'canonical_accuracy_rpc_present'::boolean
    )
) blockers(blocker_code, blocker_message, is_blocked)
WHERE is_blocked
ORDER BY blocker_code;

SELECT
  CASE
    WHEN :'can_request_phase0_migration_approval'::boolean THEN 1
    ELSE 0
  END AS phase0_preflight_assertions_passed;

\if :can_request_phase0_migration_approval
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 0 forecast accuracy preflight failed; see phase0_preflight_blockers and phase0_preflight_readiness_summary above.';
END
$$;
\endif
