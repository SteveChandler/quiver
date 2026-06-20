-- Read-only postflight for:
--   supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
--
-- Run after the approved migration has been applied:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-postflight.sql
--
-- This script fails if the Phase 0 schema/RPC state is not live. It also
-- prints current horizon coverage so the first post-apply run can confirm
-- whether fresh 0-72h snapshots have begun landing.

BEGIN READ ONLY;

\set phase0_schema_assertions_passed 0

SELECT 'phase0_expected_objects' AS check_name;

WITH checks AS (
  SELECT
    'column' AS object_type,
    'ml_predictions_log.forecast_horizon_bucket' AS object_name,
    true AS expected_exists,
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
    true,
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
    true,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_raw_input_height_m'
    )
  UNION ALL
  SELECT
    'constraint',
    'ml_predictions_log_display_wave_source_check',
    true,
    EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ml_predictions_log_display_wave_source_check'
        AND conrelid = 'public.ml_predictions_log'::regclass
    )
  UNION ALL
  SELECT
    'constraint',
    'ml_predictions_log_display_raw_input_height_nonnegative_check',
    true,
    EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ml_predictions_log_display_raw_input_height_nonnegative_check'
        AND conrelid = 'public.ml_predictions_log'::regclass
    )
  UNION ALL
  SELECT
    'index',
    'idx_ml_predictions_beach_predicted_at_unique',
    false,
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
    true,
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
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
    )
  UNION ALL
  SELECT
    'function',
    'get_ml_weekly_metrics',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_weekly_metrics'
    )
  UNION ALL
  SELECT
    'function',
    'get_ml_health_metrics',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_health_metrics'
    )
  UNION ALL
  SELECT
    'function',
    'sync_session_wave_observation_candidate',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'sync_session_wave_observation_candidate'
    )
  UNION ALL
  SELECT
    'function_body',
    'get_forecast_accuracy_horizon_metrics live baseline columns',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
    )
  UNION ALL
  SELECT
    'function_body',
    'get_ml_weekly_metrics live display columns',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_weekly_metrics'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
    )
  UNION ALL
  SELECT
    'function_body',
    'get_ml_health_metrics live display columns',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_health_metrics'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
    )
  UNION ALL
  SELECT
    'function_body',
    'sync_session_wave_observation_candidate face-Hs source predicate',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'sync_session_wave_observation_candidate'
        AND POSITION('p.display_source = ''face-Hs-transformer-v1''' IN pg_get_functiondef(p.oid)) > 0
    )
)
SELECT
  object_type,
  object_name,
  expected_exists,
  exists_now,
  (exists_now = expected_exists) AS passed
FROM checks
ORDER BY object_type, object_name;

WITH checks AS (
  SELECT true AS expected_exists, EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ml_predictions_log'
      AND column_name = 'forecast_horizon_bucket'
  ) AS exists_now
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ml_predictions_log'
      AND column_name = 'display_wave_source'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ml_predictions_log'
      AND column_name = 'display_raw_input_height_m'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_display_wave_source_check'
      AND conrelid = 'public.ml_predictions_log'::regclass
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_display_raw_input_height_nonnegative_check'
      AND conrelid = 'public.ml_predictions_log'::regclass
  )
  UNION ALL
  SELECT false, EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ml_predictions_log'
      AND indexname = 'idx_ml_predictions_beach_predicted_at_unique'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ml_predictions_log'
      AND indexname = 'idx_ml_predictions_display_horizon_source_unique'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_forecast_accuracy_horizon_metrics'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_ml_weekly_metrics'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_ml_health_metrics'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_session_wave_observation_candidate'
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_forecast_accuracy_horizon_metrics'
      AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
      AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
      AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_ml_weekly_metrics'
      AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
      AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
      AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_ml_health_metrics'
      AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
      AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
      AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
  )
  UNION ALL
  SELECT true, EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_session_wave_observation_candidate'
      AND POSITION('p.display_source = ''face-Hs-transformer-v1''' IN pg_get_functiondef(p.oid)) > 0
  )
)
SELECT
  CASE
    WHEN bool_and(exists_now = expected_exists) THEN 1
    ELSE 0
  END AS phase0_schema_assertions_passed
FROM checks
\gset

SELECT :phase0_schema_assertions_passed AS phase0_schema_assertions_passed;

SELECT 'phase0_postflight_blockers' AS check_name;

WITH checks AS (
  SELECT
    'column' AS object_type,
    'ml_predictions_log.forecast_horizon_bucket' AS object_name,
    true AS expected_exists,
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
    true,
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
    true,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_raw_input_height_m'
    )
  UNION ALL
  SELECT
    'constraint',
    'ml_predictions_log_display_wave_source_check',
    true,
    EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ml_predictions_log_display_wave_source_check'
        AND conrelid = 'public.ml_predictions_log'::regclass
    )
  UNION ALL
  SELECT
    'constraint',
    'ml_predictions_log_display_raw_input_height_nonnegative_check',
    true,
    EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ml_predictions_log_display_raw_input_height_nonnegative_check'
        AND conrelid = 'public.ml_predictions_log'::regclass
    )
  UNION ALL
  SELECT
    'index',
    'idx_ml_predictions_beach_predicted_at_unique',
    false,
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
    true,
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
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
    )
  UNION ALL
  SELECT
    'function',
    'get_ml_weekly_metrics',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_weekly_metrics'
    )
  UNION ALL
  SELECT
    'function',
    'get_ml_health_metrics',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_health_metrics'
    )
  UNION ALL
  SELECT
    'function',
    'sync_session_wave_observation_candidate',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'sync_session_wave_observation_candidate'
    )
  UNION ALL
  SELECT
    'function_body',
    'get_forecast_accuracy_horizon_metrics live baseline columns',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
    )
  UNION ALL
  SELECT
    'function_body',
    'get_ml_weekly_metrics live display columns',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_weekly_metrics'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
    )
  UNION ALL
  SELECT
    'function_body',
    'get_ml_health_metrics live display columns',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_ml_health_metrics'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.raw_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_error_m' IN pg_get_functiondef(p.oid)) = 0
        AND POSITION('p.corrected_forecast_m' IN pg_get_functiondef(p.oid)) = 0
    )
  UNION ALL
  SELECT
    'function_body',
    'sync_session_wave_observation_candidate face-Hs source predicate',
    true,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'sync_session_wave_observation_candidate'
        AND POSITION('p.display_source = ''face-Hs-transformer-v1''' IN pg_get_functiondef(p.oid)) > 0
    )
)
SELECT
  CONCAT(
    CASE WHEN expected_exists THEN 'missing_' ELSE 'unexpected_' END,
    REGEXP_REPLACE(LOWER(object_name), '[^a-z0-9]+', '_', 'g')
  ) AS blocker_code,
  object_type,
  object_name,
  expected_exists,
  exists_now
FROM checks
WHERE exists_now IS DISTINCT FROM expected_exists
ORDER BY blocker_code;

\if :phase0_schema_assertions_passed

SELECT 'phase0_metric_rpc_sample_7d' AS check_name;

SELECT *
FROM public.get_forecast_accuracy_horizon_metrics(
  now() - interval '7 days',
  now()
);

SELECT 'phase0_horizon_coverage_24h' AS check_name;

WITH coverage AS (
  SELECT
    forecast_horizon_bucket AS horizon_bucket,
    observed_m,
    created_at
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '24 hours'
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

ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 0 forecast accuracy postflight failed; see phase0_postflight_blockers and phase0_expected_objects above.';
END
$$;
\endif
