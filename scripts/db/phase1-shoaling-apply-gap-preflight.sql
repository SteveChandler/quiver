-- Read-only preflight for:
--   supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql
--
-- Run before requesting production approval:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase1-shoaling-apply-gap-preflight.sql

BEGIN READ ONLY;

SELECT 'phase1_current_coverage' AS check_name;

WITH expected_gap(beach_id) AS (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid)
),
target AS (
  SELECT
    e.beach_id,
    b.id,
    b.shoaling_factors
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
)
SELECT
  (SELECT COUNT(*) FROM public.beaches WHERE deleted_at IS NULL) AS active_beaches,
  (
    SELECT COUNT(*)
    FROM public.beaches
    WHERE deleted_at IS NULL
      AND shoaling_factors IS NOT NULL
  ) AS active_with_shoaling_factors,
  (SELECT COUNT(*) FROM expected_gap) AS expected_gap_rows,
  COUNT(*) FILTER (WHERE target.id IS NOT NULL) AS expected_active_found,
  COUNT(*) FILTER (
    WHERE target.id IS NOT NULL
      AND target.shoaling_factors IS NULL
  ) AS would_update_rows,
  COUNT(*) FILTER (
    WHERE target.id IS NOT NULL
      AND target.shoaling_factors IS NOT NULL
  ) AS already_populated_rows,
  COUNT(*) FILTER (WHERE target.id IS NULL) AS missing_or_deleted_rows
FROM target;

SELECT 'phase1_phase0_schema_readiness' AS check_name;

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
  END AS phase1_phase0_schema_ready
FROM checks
\gset

\if :phase1_phase0_schema_ready

SELECT 'phase1_target_rows' AS check_name;

WITH expected_gap(beach_id) AS (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid)
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
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE p.forecast_horizon_hours BETWEEN 0 AND 24
        AND p.observed_m > 0
    ) AS observed_0_24h_rows,
    COUNT(*) FILTER (
      WHERE p.forecast_horizon_hours BETWEEN 25 AND 72
        AND p.observed_m > 0
    ) AS observed_25_72h_rows,
    COUNT(*) FILTER (
      WHERE p.forecast_horizon_hours BETWEEN 0 AND 72
        AND p.observed_m > 0
    ) AS observed_0_72h_rows,
    COUNT(*) FILTER (
      WHERE p.observed_m > 0
        AND (
          CASE
            WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
            WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
            WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
            WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
            ELSE NULL
          END
        ) IN ('0-24h', '25-72h')
        AND p.forecast_horizon_bucket IN ('0-24h', '25-72h')
        AND p.display_wave_source IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM allowed_wave_sources AS s
          WHERE s.source_tag = p.display_wave_source
        )
        AND p.display_raw_input_height_m IS NOT NULL
        AND p.display_raw_input_height_m >= 0
    ) AS approval_0_72h_rows,
    COUNT(*) FILTER (
      WHERE p.observed_m > 0
        AND (
          CASE
            WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
            WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
            WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
            WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
            ELSE NULL
          END
        ) IN ('0-24h', '25-72h')
        AND (
          p.forecast_horizon_bucket NOT IN ('0-24h', '25-72h')
          OR p.forecast_horizon_bucket IS NULL
          OR p.display_wave_source IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM allowed_wave_sources AS s
            WHERE s.source_tag = p.display_wave_source
          )
          OR p.display_raw_input_height_m IS NULL
          OR p.display_raw_input_height_m < 0
        )
    ) AS observed_0_72h_rows_without_approval_provenance
  FROM expected_gap e
  LEFT JOIN public.ml_predictions_log p
    ON p.beach_id = e.beach_id
   AND p.predicted_at >= now() - interval '30 days'
   AND p.display_source = 'face-Hs-transformer-v1'
  GROUP BY e.beach_id
)
SELECT
  b.region,
  b.name,
  b.slug,
  e.beach_id,
  b.shoaling_factors IS NULL AS would_update,
  c.observed_0_24h_rows,
  c.observed_25_72h_rows,
  c.observed_0_72h_rows,
  c.approval_0_72h_rows,
  c.observed_0_72h_rows_without_approval_provenance,
  c.approval_0_72h_rows >= 25 AS has_slice_sample_floor
FROM expected_gap e
LEFT JOIN public.beaches b
  ON b.id = e.beach_id
 AND b.deleted_at IS NULL
LEFT JOIN coverage_by_beach c ON c.beach_id = e.beach_id
ORDER BY b.region NULLS LAST, b.name NULLS LAST, e.beach_id;

SELECT 'phase1_target_observed_30d' AS check_name;

WITH expected_gap(beach_id) AS (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid)
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
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE 'unknown'
    END AS horizon_bucket,
    p.observed_m,
    (
      p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+')
      AND p.display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources AS s
        WHERE s.source_tag = p.display_wave_source
      )
      AND p.display_raw_input_height_m IS NOT NULL
      AND p.display_raw_input_height_m >= 0
    ) AS has_approval_provenance
  FROM public.ml_predictions_log p
  JOIN expected_gap e ON e.beach_id = p.beach_id
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
      AND has_approval_provenance
  ) AS observed_approval_provenanced_rows,
  COUNT(*) FILTER (
    WHERE observed_m > 0
      AND horizon_bucket IN ('0-24h', '25-72h')
      AND NOT has_approval_provenance
  ) AS observed_rows_without_approval_provenance
FROM coverage
GROUP BY horizon_bucket
ORDER BY
  CASE horizon_bucket
    WHEN '0-24h' THEN 1
    WHEN '25-72h' THEN 2
    WHEN '73h+' THEN 3
    ELSE 4
  END;

SELECT 'phase1_preflight_assertions' AS check_name;

WITH expected_gap(beach_id) AS (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid)
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
target AS (
  SELECT
    e.beach_id,
    b.id,
    b.shoaling_factors
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
coverage AS (
  SELECT
    e.beach_id,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS horizon_bucket,
    (
      p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+')
      AND p.display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources AS s
        WHERE s.source_tag = p.display_wave_source
      )
      AND p.display_raw_input_height_m IS NOT NULL
      AND p.display_raw_input_height_m >= 0
    ) AS has_approval_provenance
  FROM public.ml_predictions_log p
  JOIN expected_gap e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
    AND p.observed_m > 0
),
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE c.horizon_bucket IN ('0-24h', '25-72h')
        AND c.has_approval_provenance
    ) AS approval_0_72h_rows
  FROM expected_gap e
  LEFT JOIN coverage c ON c.beach_id = e.beach_id
  GROUP BY e.beach_id
),
assertions AS (
  SELECT
    'expected_active_found_30' AS assertion,
    COUNT(*) FILTER (WHERE target.id IS NOT NULL) = 30 AS passed
  FROM target
  UNION ALL
  SELECT
    'would_update_rows_30',
    COUNT(*) FILTER (
      WHERE target.id IS NOT NULL
        AND target.shoaling_factors IS NULL
    ) = 30
  FROM target
  UNION ALL
  SELECT
    'already_populated_rows_0',
    COUNT(*) FILTER (
      WHERE target.id IS NOT NULL
        AND target.shoaling_factors IS NOT NULL
    ) = 0
  FROM target
  UNION ALL
  SELECT
    'missing_or_deleted_rows_0',
    COUNT(*) FILTER (WHERE target.id IS NULL) = 0
  FROM target
  UNION ALL
  SELECT
    'approval_0_72h_rows_at_least_75',
    COUNT(*) FILTER (
      WHERE horizon_bucket IN ('0-24h', '25-72h')
        AND has_approval_provenance
    ) >= 75
  FROM coverage
  UNION ALL
  SELECT
    'observed_0_72h_rows_without_approval_provenance_0',
    COUNT(*) FILTER (
      WHERE horizon_bucket IN ('0-24h', '25-72h')
        AND NOT has_approval_provenance
    ) = 0
  FROM coverage
  UNION ALL
  SELECT
    'all_targets_approval_0_72h_rows_at_least_25',
    COUNT(*) FILTER (WHERE approval_0_72h_rows >= 25) = 30
  FROM coverage_by_beach
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

SELECT 'phase1_preflight_blockers' AS check_name;

WITH expected_gap(beach_id) AS (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid)
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
target AS (
  SELECT
    e.beach_id,
    b.id,
    b.shoaling_factors
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
coverage AS (
  SELECT
    e.beach_id,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS horizon_bucket,
    (
      p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+')
      AND p.display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources AS s
        WHERE s.source_tag = p.display_wave_source
      )
      AND p.display_raw_input_height_m IS NOT NULL
      AND p.display_raw_input_height_m >= 0
    ) AS has_approval_provenance
  FROM public.ml_predictions_log p
  JOIN expected_gap e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
    AND p.observed_m > 0
),
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE c.horizon_bucket IN ('0-24h', '25-72h')
        AND c.has_approval_provenance
    ) AS approval_0_72h_rows
  FROM expected_gap e
  LEFT JOIN coverage c ON c.beach_id = e.beach_id
  GROUP BY e.beach_id
),
summary AS (
  SELECT
    (SELECT COUNT(*) FILTER (WHERE target.id IS NOT NULL) FROM target) AS expected_active_found,
    (
      SELECT COUNT(*) FILTER (
        WHERE target.id IS NOT NULL
          AND target.shoaling_factors IS NULL
      )
      FROM target
    ) AS would_update_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE target.id IS NOT NULL
          AND target.shoaling_factors IS NOT NULL
      )
      FROM target
    ) AS already_populated_rows,
    (SELECT COUNT(*) FILTER (WHERE target.id IS NULL) FROM target) AS missing_or_deleted_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE horizon_bucket IN ('0-24h', '25-72h')
          AND has_approval_provenance
      )
      FROM coverage
    ) AS approval_0_72h_rows,
    (
      SELECT COUNT(*) FILTER (
        WHERE horizon_bucket IN ('0-24h', '25-72h')
          AND NOT has_approval_provenance
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
    'expected_active_found_30' AS blocker_code,
    'The Phase 1 target set does not contain exactly 30 active beaches.' AS blocker_message,
    expected_active_found = 30 AS passed,
    CONCAT('expected_active_found=', expected_active_found, ', expected=30') AS detail
  FROM summary
  UNION ALL
  SELECT
    'would_update_rows_30',
    'The Phase 1 target set does not contain exactly 30 active beaches still missing shoaling_factors.',
    would_update_rows = 30,
    CONCAT('would_update_rows=', would_update_rows, ', expected=30')
  FROM summary
  UNION ALL
  SELECT
    'already_populated_rows_0',
    'One or more Phase 1 target beaches already has shoaling_factors; regenerate a narrower migration.',
    already_populated_rows = 0,
    CONCAT('already_populated_rows=', already_populated_rows, ', expected=0')
  FROM summary
  UNION ALL
  SELECT
    'missing_or_deleted_rows_0',
    'One or more Phase 1 target beaches is missing or deleted.',
    missing_or_deleted_rows = 0,
    CONCAT('missing_or_deleted_rows=', missing_or_deleted_rows, ', expected=0')
  FROM summary
  UNION ALL
  SELECT
    'approval_0_72h_rows_at_least_75',
    'The Phase 1 target set lacks 75 approval-provenanced observed 0-72h rows.',
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
    'One or more Phase 1 target beaches lacks 25 approval-provenanced observed 0-72h rows.',
    targets_with_approval_0_72h_rows_at_least_25 = 30,
    CONCAT('targets_with_approval_0_72h_rows_at_least_25=', targets_with_approval_0_72h_rows_at_least_25, ', expected=30')
  FROM summary
)
SELECT blocker_code, blocker_message, detail
FROM assertions
WHERE NOT passed
ORDER BY blocker_code;

WITH expected_gap(beach_id) AS (
  VALUES
    ('1207215c-f61d-4fe1-bbaa-a3db7d4e7d53'::uuid),
    ('da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid),
    ('12e0096c-9826-443f-9131-53aaa646f789'::uuid),
    ('71bdbe5a-67f6-429c-b1e4-80ec390ec4a3'::uuid),
    ('0e557ec4-355a-4176-8352-6ea50e379c13'::uuid),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid),
    ('be03bc6f-878a-4806-bff2-9cf870a9f241'::uuid),
    ('66ef3c08-a8a2-4cf1-9361-273489bac45b'::uuid),
    ('d60dd5c8-d147-4042-a531-c2ec55c620af'::uuid),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid),
    ('071db1df-b5ee-4af6-a022-ea8a09667cbe'::uuid),
    ('72726bcb-bed0-4b76-8336-f90d7fb57159'::uuid),
    ('025cfc18-8357-49d6-994e-e0abf0a16f6d'::uuid),
    ('b57b32b9-0057-46f6-9fa9-cd35d5bd5319'::uuid),
    ('502bd50f-21c8-4cdc-ae96-1d53fcbc34de'::uuid),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid),
    ('53cc78d5-a759-4153-8a2e-b13cf1bb6b4e'::uuid),
    ('bbe7f4eb-9807-4e65-8e69-e2cee28d6b24'::uuid),
    ('11662c67-a1bb-43a0-b0f7-0e4071b1c3f2'::uuid),
    ('e64001e6-e2bd-4596-8f24-d8064e7f5186'::uuid),
    ('d9524c9d-8315-4686-9d35-24ceb6db2a82'::uuid),
    ('13a91b0d-3e80-4140-b11e-2c1b12e00687'::uuid),
    ('a0e764f1-d0bb-4341-b397-7b21823cb93b'::uuid),
    ('79e8be90-df33-4b80-9d92-e79e26a67a69'::uuid),
    ('c2c7cc01-4920-4fd9-941c-68df6b46ced0'::uuid),
    ('101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid),
    ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid),
    ('836f218a-9471-46c9-b201-24da1dfe0f3a'::uuid)
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
target AS (
  SELECT
    e.beach_id,
    b.id,
    b.shoaling_factors
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
coverage AS (
  SELECT
    e.beach_id,
    CASE
      WHEN p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+') THEN p.forecast_horizon_bucket
      WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
      WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
      WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
      ELSE NULL
    END AS horizon_bucket,
    (
      p.forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+')
      AND p.display_wave_source IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM allowed_wave_sources AS s
        WHERE s.source_tag = p.display_wave_source
      )
      AND p.display_raw_input_height_m IS NOT NULL
      AND p.display_raw_input_height_m >= 0
    ) AS has_approval_provenance
  FROM public.ml_predictions_log p
  JOIN expected_gap e ON e.beach_id = p.beach_id
  WHERE p.predicted_at >= now() - interval '30 days'
    AND p.display_source = 'face-Hs-transformer-v1'
    AND p.observed_m > 0
),
coverage_by_beach AS (
  SELECT
    e.beach_id,
    COUNT(*) FILTER (
      WHERE c.horizon_bucket IN ('0-24h', '25-72h')
        AND c.has_approval_provenance
    ) AS approval_0_72h_rows
  FROM expected_gap e
  LEFT JOIN coverage c ON c.beach_id = e.beach_id
  GROUP BY e.beach_id
),
assertions AS (
  SELECT COUNT(*) FILTER (WHERE target.id IS NOT NULL) = 30 AS passed
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE target.id IS NOT NULL
      AND target.shoaling_factors IS NULL
  ) = 30
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE target.id IS NOT NULL
      AND target.shoaling_factors IS NOT NULL
  ) = 0
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (WHERE target.id IS NULL) = 0
  FROM target
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE horizon_bucket IN ('0-24h', '25-72h')
      AND has_approval_provenance
  ) >= 75
  FROM coverage
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE horizon_bucket IN ('0-24h', '25-72h')
      AND NOT has_approval_provenance
  ) = 0
  FROM coverage
  UNION ALL
  SELECT COUNT(*) FILTER (WHERE approval_0_72h_rows >= 25) = 30
  FROM coverage_by_beach
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase1_preflight_assertions_passed
FROM assertions
\gset

SELECT :phase1_preflight_assertions_passed AS phase1_preflight_assertions_passed;

\else

SELECT 'phase1_target_rows' AS check_name;

SELECT
  'skipped_missing_phase0_schema' AS blocked_reason,
  'Run Phase 0 migration and postflight before Phase 1 observation checks' AS next_action;

SELECT 'phase1_target_observed_30d' AS check_name;

SELECT
  'skipped_missing_phase0_schema' AS horizon_bucket,
  0::bigint AS total_rows,
  0::bigint AS observed_rows,
  0::bigint AS observed_approval_provenanced_rows,
  0::bigint AS observed_rows_without_approval_provenance;

SELECT 'phase1_preflight_assertions' AS check_name;

WITH assertions AS (
  SELECT 'phase1_phase0_schema_ready' AS assertion, false AS passed
  UNION ALL
  SELECT 'approval_0_72h_rows_at_least_75', false
  UNION ALL
  SELECT 'all_targets_approval_0_72h_rows_at_least_25', false
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

SELECT 'phase1_preflight_blockers' AS check_name;

SELECT blocker_code, blocker_message, detail
FROM (
  VALUES
    (
      'phase1_phase0_schema_ready',
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

\set phase1_preflight_assertions_passed 0

SELECT :phase1_preflight_assertions_passed AS phase1_preflight_assertions_passed;

\endif

\if :phase1_preflight_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 1 shoaling apply-gap preflight assertions failed; see phase1_preflight_blockers and phase1_preflight_assertions above.';
END
$$;
\endif
