-- Read-only postflight for:
--   supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql
--
-- Run after the approved migration has been applied:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/phase1-shoaling-apply-gap-postflight.sql
--
-- This script fails if any of the 30 Phase 1 target beaches did not receive
-- valid period_lookup shoaling factors.

BEGIN READ ONLY;

\set phase1_apply_gap_assertions_passed 0

SELECT 'phase1_postflight_coverage' AS check_name;

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
    b.shoaling_factors,
    jsonb_array_length(COALESCE(b.shoaling_factors->'buckets', '[]'::jsonb)) AS bucket_count
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
  COUNT(*) FILTER (WHERE target.shoaling_factors IS NOT NULL) AS target_populated_rows,
  COUNT(*) FILTER (
    WHERE target.shoaling_factors->>'type' = 'period_lookup'
      AND target.bucket_count = 4
  ) AS valid_period_lookup_rows,
  COUNT(*) FILTER (WHERE target.id IS NULL) AS missing_or_deleted_rows
FROM target;

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
assertions AS (
  SELECT
    'all_target_rows_populated' AS assertion,
    COUNT(*) FILTER (WHERE b.shoaling_factors IS NOT NULL) = 30 AS passed
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
  UNION ALL
  SELECT
    'all_target_rows_valid_period_lookup',
    COUNT(*) FILTER (
      WHERE b.shoaling_factors->>'type' = 'period_lookup'
        AND jsonb_array_length(COALESCE(b.shoaling_factors->'buckets', '[]'::jsonb)) = 4
    ) = 30
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
  UNION ALL
  SELECT
    'active_shoaling_coverage_at_least_117',
    COUNT(*) FILTER (WHERE shoaling_factors IS NOT NULL) >= 117
  FROM public.beaches
  WHERE deleted_at IS NULL
)
SELECT assertion, passed
FROM assertions
ORDER BY assertion;

SELECT 'phase1_postflight_blockers' AS check_name;

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
    b.shoaling_factors,
    jsonb_array_length(COALESCE(b.shoaling_factors->'buckets', '[]'::jsonb)) AS bucket_count
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
),
summary AS (
  SELECT
    COUNT(*) FILTER (WHERE target.shoaling_factors IS NOT NULL) AS target_populated_rows,
    COUNT(*) FILTER (
      WHERE target.shoaling_factors->>'type' = 'period_lookup'
        AND target.bucket_count = 4
    ) AS valid_period_lookup_rows,
    (
      SELECT COUNT(*)
      FROM public.beaches
      WHERE deleted_at IS NULL
        AND shoaling_factors IS NOT NULL
    ) AS active_with_shoaling_factors
  FROM target
),
assertions AS (
  SELECT
    'all_target_rows_populated' AS blocker_code,
    'Not all 30 Phase 1 target beaches have shoaling_factors after apply.' AS blocker_message,
    target_populated_rows = 30 AS passed,
    CONCAT('target_populated_rows=', target_populated_rows, ', expected=30') AS detail
  FROM summary
  UNION ALL
  SELECT
    'all_target_rows_valid_period_lookup',
    'Not all 30 Phase 1 target beaches have valid 4-bucket period_lookup shoaling factors.',
    valid_period_lookup_rows = 30,
    CONCAT('valid_period_lookup_rows=', valid_period_lookup_rows, ', expected=30')
  FROM summary
  UNION ALL
  SELECT
    'active_shoaling_coverage_at_least_117',
    'Active shoaling-factor coverage did not reach the Phase 1 floor of 117 beaches.',
    active_with_shoaling_factors >= 117,
    CONCAT('active_with_shoaling_factors=', active_with_shoaling_factors, ', expected_at_least=117')
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
assertions AS (
  SELECT COUNT(*) FILTER (WHERE b.shoaling_factors IS NOT NULL) = 30 AS passed
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
  UNION ALL
  SELECT COUNT(*) FILTER (
    WHERE b.shoaling_factors->>'type' = 'period_lookup'
      AND jsonb_array_length(COALESCE(b.shoaling_factors->'buckets', '[]'::jsonb)) = 4
  ) = 30
  FROM expected_gap e
  LEFT JOIN public.beaches b
    ON b.id = e.beach_id
   AND b.deleted_at IS NULL
  UNION ALL
  SELECT COUNT(*) FILTER (WHERE shoaling_factors IS NOT NULL) >= 117
  FROM public.beaches
  WHERE deleted_at IS NULL
)
SELECT
  CASE
    WHEN bool_and(passed) THEN 1
    ELSE 0
  END AS phase1_apply_gap_assertions_passed
FROM assertions
\gset

SELECT :phase1_apply_gap_assertions_passed AS phase1_apply_gap_assertions_passed;

\if :phase1_apply_gap_assertions_passed
ROLLBACK;
\else
ROLLBACK;
DO $$
BEGIN
  RAISE EXCEPTION
    'Phase 1 shoaling apply-gap postflight assertions failed; see phase1_postflight_blockers and phase1_postflight_coverage above.';
END
$$;
\endif
