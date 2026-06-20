-- Read-only data-readiness gate for:
--   supabase/migrations/20260618160000_phase0_forecast_accuracy_metrics.sql
--
-- Run after the migration is live and fresh forecast snapshot writes have had
-- time to land:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase0-forecast-accuracy-data-readiness.sql
--
-- This script fails closed until Phase 0 has usable 0-72h display snapshots
-- with stored horizon-bucket provenance, replay provenance, and enough
-- observed face-height rows for approval harness runs. It is intentionally
-- separate from schema postflight, which can pass immediately after migration
-- apply.

BEGIN READ ONLY;

\set phase0_data_readiness_assertions_passed 0

SELECT 'phase0_data_readiness_schema_state' AS check_name;

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
    'get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz)',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
        AND oidvectortypes(p.proargtypes) =
          'timestamp with time zone, timestamp with time zone'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
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
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_forecast_accuracy_horizon_metrics'
      AND oidvectortypes(p.proargtypes) =
        'timestamp with time zone, timestamp with time zone'
      AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
  )
)
SELECT
  CASE
    WHEN bool_and(exists_now) THEN 'true'
    ELSE 'false'
  END AS phase0_data_readiness_has_phase0_schema
FROM checks
\gset

\if :phase0_data_readiness_has_phase0_schema

SELECT 'phase0_data_readiness_24h' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
fresh AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    observed_m,
    display_wave_source,
    display_raw_input_height_m,
    created_at
  FROM public.ml_predictions_log
  WHERE created_at >= now() - interval '24 hours'
    AND display_source = 'face-Hs-transformer-v1'
)
SELECT
  effective_horizon_bucket AS horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE observed_m > 0) AS observed_rows,
  COUNT(*) FILTER (
    WHERE stored_horizon_bucket IN ('0-24h', '25-72h', '73h+')
  ) AS rows_with_horizon_bucket_provenance,
  COUNT(*) FILTER (
    WHERE stored_horizon_bucket IS NULL
       OR stored_horizon_bucket NOT IN ('0-24h', '25-72h', '73h+')
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
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM fresh
GROUP BY effective_horizon_bucket
ORDER BY
  CASE effective_horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_data_readiness_30d' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
observed AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    observed_m,
    display_wave_source,
    display_raw_input_height_m,
    predicted_at
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND display_source = 'face-Hs-transformer-v1'
)
SELECT
  effective_horizon_bucket AS horizon_bucket,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE observed_m > 0) AS observed_rows,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND stored_horizon_bucket IN ('0-24h', '25-72h', '73h+')
  ) AS observed_rows_with_horizon_bucket_provenance,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND (
        stored_horizon_bucket IS NULL
        OR stored_horizon_bucket NOT IN ('0-24h', '25-72h', '73h+')
      )
  ) AS observed_rows_missing_horizon_bucket_provenance,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources
        WHERE source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) AS observed_rows_with_replay_provenance,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND stored_horizon_bucket IN ('0-24h', '25-72h', '73h+')
      AND display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources
        WHERE source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) AS observed_rows_with_approval_provenance,
  MIN(predicted_at) AS first_predicted_at,
  MAX(predicted_at) AS last_predicted_at
FROM observed
GROUP BY effective_horizon_bucket
ORDER BY
  CASE effective_horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase0_data_readiness_assertions' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
fresh_short AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= now() - interval '24 hours'
    AND display_source = 'face-Hs-transformer-v1'
),
observed_short AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND display_source = 'face-Hs-transformer-v1'
    AND observed_m > 0
),
fresh_short_candidates AS (
  SELECT *
  FROM fresh_short
  WHERE effective_horizon_bucket IN ('0-24h', '25-72h')
),
observed_short_candidates AS (
  SELECT *
  FROM observed_short
  WHERE effective_horizon_bucket IN ('0-24h', '25-72h')
),
required_metrics AS (
  SELECT *
  FROM (
    VALUES
      ('0-24h'::text, 'current_display'::text),
      ('0-24h'::text, 'raw_display'::text),
      ('0-24h'::text, 'raw_om'::text),
      ('0-24h'::text, 'v5_shadow'::text),
      ('25-72h'::text, 'current_display'::text),
      ('25-72h'::text, 'raw_display'::text),
      ('25-72h'::text, 'raw_om'::text),
      ('25-72h'::text, 'v5_shadow'::text)
  ) AS required(horizon_bucket, baseline)
),
metric_rows AS (
  SELECT
    required_metrics.horizon_bucket,
    required_metrics.baseline,
    COALESCE(metrics.sample_count, 0) AS sample_count,
    metrics.mae_m,
    metrics.bias_m
  FROM required_metrics
  LEFT JOIN public.get_forecast_accuracy_horizon_metrics(
    now() - interval '30 days',
    now()
  ) AS metrics
    ON metrics.horizon_bucket = required_metrics.horizon_bucket
   AND metrics.baseline = required_metrics.baseline
),
assertions AS (
  SELECT
    'fresh_0_24h_snapshot_rows_present' AS assertion_name,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    ) > 0 AS passed,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    )::text AS detail
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'fresh_25_72h_snapshot_rows_present',
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    ) > 0,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    )::text
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'fresh_short_horizon_bucket_provenance_complete',
    COUNT(*) > 0
      AND COUNT(*) FILTER (
        WHERE stored_horizon_bucket IS NULL
           OR stored_horizon_bucket NOT IN ('0-24h', '25-72h')
      ) = 0,
    CONCAT(
      'total=',
      COUNT(*),
      ', missing=',
      COUNT(*) FILTER (
        WHERE stored_horizon_bucket IS NULL
           OR stored_horizon_bucket NOT IN ('0-24h', '25-72h')
      )
    )
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'fresh_short_horizon_source_provenance_complete',
    COUNT(*) > 0
      AND COUNT(*) FILTER (
        WHERE display_wave_source IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM allowed_wave_sources
             WHERE source_tag = display_wave_source
           )
           OR display_raw_input_height_m IS NULL
           OR display_raw_input_height_m < 0
      ) = 0,
    CONCAT(
      'total=',
      COUNT(*),
      ', missing=',
      COUNT(*) FILTER (
        WHERE display_wave_source IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM allowed_wave_sources
             WHERE source_tag = display_wave_source
           )
           OR display_raw_input_height_m IS NULL
           OR display_raw_input_height_m < 0
      )
    )
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'observed_0_24h_rows_present',
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    ) > 0,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_25_72h_rows_present',
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    ) > 0,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_rows_at_least_75',
    COUNT(*) >= 75,
    COUNT(*)::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_horizon_bucket_provenance_at_least_75',
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
    ) >= 75,
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_source_provenance_at_least_75',
    COUNT(*) FILTER (
      WHERE display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    ) >= 75,
    COUNT(*) FILTER (
      WHERE display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_approval_provenance_at_least_75',
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
        AND display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    ) >= 75,
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
        AND display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'canonical_metric_0_72h_required_baselines_present',
    COUNT(*) = 8,
    CONCAT(
      'present=',
      COUNT(*),
      '/8'
    )
  FROM metric_rows
  WHERE sample_count > 0
    AND mae_m IS NOT NULL
    AND mae_m >= 0
    AND mae_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND bias_m IS NOT NULL
    AND bias_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
)
SELECT
  assertion_name,
  passed,
  detail
FROM assertions
ORDER BY assertion_name;

SELECT 'phase0_data_readiness_blockers' AS check_name;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
fresh_short AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= now() - interval '24 hours'
    AND display_source = 'face-Hs-transformer-v1'
),
observed_short AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND display_source = 'face-Hs-transformer-v1'
    AND observed_m > 0
),
fresh_short_candidates AS (
  SELECT *
  FROM fresh_short
  WHERE effective_horizon_bucket IN ('0-24h', '25-72h')
),
observed_short_candidates AS (
  SELECT *
  FROM observed_short
  WHERE effective_horizon_bucket IN ('0-24h', '25-72h')
),
required_metrics AS (
  SELECT *
  FROM (
    VALUES
      ('0-24h'::text, 'current_display'::text),
      ('0-24h'::text, 'raw_display'::text),
      ('0-24h'::text, 'raw_om'::text),
      ('0-24h'::text, 'v5_shadow'::text),
      ('25-72h'::text, 'current_display'::text),
      ('25-72h'::text, 'raw_display'::text),
      ('25-72h'::text, 'raw_om'::text),
      ('25-72h'::text, 'v5_shadow'::text)
  ) AS required(horizon_bucket, baseline)
),
metric_rows AS (
  SELECT
    required_metrics.horizon_bucket,
    required_metrics.baseline,
    COALESCE(metrics.sample_count, 0) AS sample_count,
    metrics.mae_m,
    metrics.bias_m
  FROM required_metrics
  LEFT JOIN public.get_forecast_accuracy_horizon_metrics(
    now() - interval '30 days',
    now()
  ) AS metrics
    ON metrics.horizon_bucket = required_metrics.horizon_bucket
   AND metrics.baseline = required_metrics.baseline
),
assertions AS (
  SELECT
    'fresh_0_24h_snapshot_rows_present' AS blocker_code,
    'No fresh Phase 0 0-24h snapshot rows landed in the latest 24 hours.' AS blocker_message,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    ) > 0 AS passed,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    )::text AS detail
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'fresh_25_72h_snapshot_rows_present',
    'No fresh Phase 0 25-72h snapshot rows landed in the latest 24 hours.',
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    ) > 0,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    )::text
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'fresh_short_horizon_bucket_provenance_complete',
    'Fresh short-horizon rows are missing stored horizon-bucket provenance.',
    COUNT(*) > 0
      AND COUNT(*) FILTER (
        WHERE stored_horizon_bucket IS NULL
           OR stored_horizon_bucket NOT IN ('0-24h', '25-72h')
      ) = 0,
    CONCAT(
      'total=',
      COUNT(*),
      ', missing=',
      COUNT(*) FILTER (
        WHERE stored_horizon_bucket IS NULL
           OR stored_horizon_bucket NOT IN ('0-24h', '25-72h')
      )
    )
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'fresh_short_horizon_source_provenance_complete',
    'Fresh short-horizon rows are missing replay source provenance.',
    COUNT(*) > 0
      AND COUNT(*) FILTER (
        WHERE display_wave_source IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM allowed_wave_sources
             WHERE source_tag = display_wave_source
           )
           OR display_raw_input_height_m IS NULL
           OR display_raw_input_height_m < 0
      ) = 0,
    CONCAT(
      'total=',
      COUNT(*),
      ', missing=',
      COUNT(*) FILTER (
        WHERE display_wave_source IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM allowed_wave_sources
             WHERE source_tag = display_wave_source
           )
           OR display_raw_input_height_m IS NULL
           OR display_raw_input_height_m < 0
      )
    )
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    'observed_0_24h_rows_present',
    'No observed Phase 0 0-24h approval rows are available in the latest 30 days.',
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    ) > 0,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '0-24h'
        AND stored_horizon_bucket = '0-24h'
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_25_72h_rows_present',
    'No observed Phase 0 25-72h approval rows are available in the latest 30 days.',
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    ) > 0,
    COUNT(*) FILTER (
      WHERE effective_horizon_bucket = '25-72h'
        AND stored_horizon_bucket = '25-72h'
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_rows_at_least_75',
    'Observed 0-72h approval rows are below the minimum sample floor of 75.',
    COUNT(*) >= 75,
    COUNT(*)::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_horizon_bucket_provenance_at_least_75',
    'Observed 0-72h rows with stored horizon-bucket provenance are below 75.',
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
    ) >= 75,
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_source_provenance_at_least_75',
    'Observed 0-72h rows with replay source provenance are below 75.',
    COUNT(*) FILTER (
      WHERE display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    ) >= 75,
    COUNT(*) FILTER (
      WHERE display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'observed_0_72h_approval_provenance_at_least_75',
    'Observed 0-72h rows with both horizon-bucket and replay provenance are below 75.',
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
        AND display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    ) >= 75,
    COUNT(*) FILTER (
      WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
        AND display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources
          WHERE source_tag = display_wave_source
        )
        AND display_raw_input_height_m IS NOT NULL
        AND display_raw_input_height_m >= 0
    )::text
  FROM observed_short_candidates
  UNION ALL
  SELECT
    'canonical_metric_0_72h_required_baselines_present',
    'Canonical metric RPC is missing required finite 0-72h baseline rows.',
    COUNT(*) = 8,
    CONCAT('present=', COUNT(*), '/8')
  FROM metric_rows
  WHERE sample_count > 0
    AND mae_m IS NOT NULL
    AND mae_m >= 0
    AND mae_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND bias_m IS NOT NULL
    AND bias_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
)
SELECT blocker_code, blocker_message, detail
FROM assertions
WHERE NOT passed
ORDER BY blocker_code;

SELECT 'phase0_metric_rpc_readiness_30d' AS check_name;

WITH required_metrics AS (
  SELECT *
  FROM (
    VALUES
      ('0-24h'::text, 'current_display'::text),
      ('0-24h'::text, 'raw_display'::text),
      ('0-24h'::text, 'raw_om'::text),
      ('0-24h'::text, 'v5_shadow'::text),
      ('25-72h'::text, 'current_display'::text),
      ('25-72h'::text, 'raw_display'::text),
      ('25-72h'::text, 'raw_om'::text),
      ('25-72h'::text, 'v5_shadow'::text)
  ) AS required(horizon_bucket, baseline)
),
metrics AS (
  SELECT *
  FROM public.get_forecast_accuracy_horizon_metrics(
    now() - interval '30 days',
    now()
  )
)
SELECT
  required_metrics.horizon_bucket,
  required_metrics.baseline,
  COALESCE(metrics.sample_count, 0) AS sample_count,
  metrics.mae_m,
  metrics.bias_m,
  (
    COALESCE(metrics.sample_count, 0) > 0
    AND metrics.mae_m IS NOT NULL
    AND metrics.mae_m >= 0
    AND metrics.mae_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND metrics.bias_m IS NOT NULL
    AND metrics.bias_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
  ) AS passed
FROM required_metrics
LEFT JOIN metrics
  ON metrics.horizon_bucket = required_metrics.horizon_bucket
 AND metrics.baseline = required_metrics.baseline
ORDER BY
  CASE required_metrics.horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    ELSE 3
  END,
  CASE required_metrics.baseline
    WHEN 'current_display' THEN 1
    WHEN 'raw_display' THEN 2
    WHEN 'raw_om' THEN 3
    WHEN 'v5_shadow' THEN 4
    ELSE 5
  END;

WITH allowed_wave_sources(source_tag) AS (
  VALUES
    ('cdip_sig'),
    ('model_swell'),
    ('cdip_swell'),
    ('model_hs'),
    ('ndbc_buoy'),
    ('nowcast_anchor')
),
fresh_short AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m
  FROM public.ml_predictions_log
  WHERE created_at >= now() - interval '24 hours'
    AND display_source = 'face-Hs-transformer-v1'
),
observed_short AS (
  SELECT
    forecast_horizon_bucket AS stored_horizon_bucket,
    CASE
      WHEN forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN forecast_horizon_bucket
      WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS effective_horizon_bucket,
    display_wave_source,
    display_raw_input_height_m
  FROM public.ml_predictions_log
  WHERE predicted_at >= now() - interval '30 days'
    AND display_source = 'face-Hs-transformer-v1'
    AND observed_m > 0
),
fresh_short_candidates AS (
  SELECT *
  FROM fresh_short
  WHERE effective_horizon_bucket IN ('0-24h', '25-72h')
),
observed_short_candidates AS (
  SELECT *
  FROM observed_short
  WHERE effective_horizon_bucket IN ('0-24h', '25-72h')
),
required_metrics AS (
  SELECT *
  FROM (
    VALUES
      ('0-24h'::text, 'current_display'::text),
      ('0-24h'::text, 'raw_display'::text),
      ('0-24h'::text, 'raw_om'::text),
      ('0-24h'::text, 'v5_shadow'::text),
      ('25-72h'::text, 'current_display'::text),
      ('25-72h'::text, 'raw_display'::text),
      ('25-72h'::text, 'raw_om'::text),
      ('25-72h'::text, 'v5_shadow'::text)
  ) AS required(horizon_bucket, baseline)
),
metric_rows AS (
  SELECT
    required_metrics.horizon_bucket,
    required_metrics.baseline,
    COALESCE(metrics.sample_count, 0) AS sample_count,
    metrics.mae_m,
    metrics.bias_m
  FROM required_metrics
  LEFT JOIN public.get_forecast_accuracy_horizon_metrics(
    now() - interval '30 days',
    now()
  ) AS metrics
    ON metrics.horizon_bucket = required_metrics.horizon_bucket
   AND metrics.baseline = required_metrics.baseline
),
assertions AS (
  SELECT COUNT(*) FILTER (
    WHERE effective_horizon_bucket = '0-24h'
      AND stored_horizon_bucket = '0-24h'
  ) > 0 AS passed
  FROM fresh_short_candidates
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE effective_horizon_bucket = '25-72h'
      AND stored_horizon_bucket = '25-72h'
  ) > 0
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    COUNT(*) > 0
      AND COUNT(*) FILTER (
        WHERE stored_horizon_bucket IS NULL
           OR stored_horizon_bucket NOT IN ('0-24h', '25-72h')
      ) = 0
  FROM fresh_short_candidates
  UNION ALL
  SELECT
    COUNT(*) > 0
      AND COUNT(*) FILTER (
        WHERE display_wave_source IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM allowed_wave_sources
             WHERE source_tag = display_wave_source
           )
           OR display_raw_input_height_m IS NULL
           OR display_raw_input_height_m < 0
      ) = 0
  FROM fresh_short_candidates
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE effective_horizon_bucket = '0-24h'
      AND stored_horizon_bucket = '0-24h'
  ) > 0
  FROM observed_short_candidates
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE effective_horizon_bucket = '25-72h'
      AND stored_horizon_bucket = '25-72h'
  ) > 0
  FROM observed_short_candidates
  UNION ALL
  SELECT COUNT(*) >= 75
  FROM observed_short_candidates
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
  ) >= 75
  FROM observed_short_candidates
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources
        WHERE source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) >= 75
  FROM observed_short_candidates
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE stored_horizon_bucket IN ('0-24h', '25-72h')
      AND display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources
        WHERE source_tag = display_wave_source
      )
      AND display_raw_input_height_m IS NOT NULL
      AND display_raw_input_height_m >= 0
  ) >= 75
  FROM observed_short_candidates
  UNION ALL
  SELECT COUNT(*) = 8
  FROM metric_rows
  WHERE sample_count > 0
    AND mae_m IS NOT NULL
    AND mae_m >= 0
    AND mae_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND bias_m IS NOT NULL
    AND bias_m::text NOT IN ('NaN', 'Infinity', '-Infinity')
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase0_data_readiness_assertions_passed
FROM assertions
\gset

SELECT
  :phase0_data_readiness_assertions_passed
    AS phase0_data_readiness_assertions_passed;

\else

SELECT 'phase0_data_readiness_schema_assertion' AS check_name;

WITH checks AS (
  SELECT
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
    'get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz)',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
        AND oidvectortypes(p.proargtypes) =
          'timestamp with time zone, timestamp with time zone'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
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

SELECT 0 AS phase0_data_readiness_assertions_passed
\gset

SELECT
  :phase0_data_readiness_assertions_passed
    AS phase0_data_readiness_assertions_passed;

SELECT 'phase0_data_readiness_blockers' AS check_name;

WITH checks AS (
  SELECT
    'schema_forecast_horizon_bucket_missing' AS blocker_code,
    'ml_predictions_log.forecast_horizon_bucket is missing.' AS blocker_message,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'forecast_horizon_bucket'
    ) AS exists_now
  UNION ALL
  SELECT
    'schema_display_wave_source_missing',
    'ml_predictions_log.display_wave_source is missing.',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_wave_source'
    )
  UNION ALL
  SELECT
    'schema_display_raw_input_height_missing',
    'ml_predictions_log.display_raw_input_height_m is missing.',
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ml_predictions_log'
        AND column_name = 'display_raw_input_height_m'
    )
  UNION ALL
  SELECT
    'schema_canonical_accuracy_rpc_missing',
    'get_forecast_accuracy_horizon_metrics(timestamptz,timestamptz) is missing or not on live display columns.',
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'get_forecast_accuracy_horizon_metrics'
        AND oidvectortypes(p.proargtypes) =
          'timestamp with time zone, timestamp with time zone'
        AND POSITION('p.raw_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.offset_corrected_display_height_m' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.wave_height_om' IN pg_get_functiondef(p.oid)) > 0
        AND POSITION('p.v5_shadow_height_m' IN pg_get_functiondef(p.oid)) > 0
    )
)
SELECT
  blocker_code,
  blocker_message,
  'missing' AS detail
FROM checks
WHERE NOT exists_now
ORDER BY blocker_code;

\endif

\if :phase0_data_readiness_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 0 forecast accuracy data readiness failed; see phase0_data_readiness_blockers, phase0_data_readiness_assertions, and phase0_data_readiness_schema_state above.';
END
$$;
\endif
