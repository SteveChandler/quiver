-- Apple Sign-In orphan population diagnostic (2026-08-02)
--
-- Operator use:
--   psql "$READ_ONLY_DATABASE_URL" \
--     -v ON_ERROR_STOP=1 \
--     -f .planning/apple-orphan-population-20260802.sql
--
-- This file is intentionally SELECT-only inside a READ ONLY transaction.
-- Run it only with a role that is independently restricted to read-only access.
-- The pair rows contain user IDs and email addresses; handle output as PII.
--
-- Result set 1:
--   * summary rows count Apple-shaped accounts, probable pairs, and confidence.
--   * pair rows list the evidence used for each probable match.
--   * zero probable pairs produces summary rows and no pair rows.
-- Result set 2:
--   * zero rows means the Apple recovery dependency registry covers every
--     current public FK into auth.users/public.profiles.
--   * any row means assess returns schema_coverage_incomplete until a reviewed
--     migration registers that exact constraint.

BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '60s';

WITH
auth_accounts AS MATERIALIZED (
  SELECT
    auth_user.id,
    auth_user.email,
    auth_user.created_at,
    auth_user.last_sign_in_at,
    auth_user.raw_app_meta_data,
    auth_user.raw_user_meta_data,
    lower(
      regexp_replace(
        trim(
          coalesce(
            nullif(auth_user.raw_user_meta_data->>'full_name', ''),
            nullif(auth_user.raw_user_meta_data->>'name', ''),
            nullif(
              concat_ws(
                ' ',
                auth_user.raw_user_meta_data->>'given_name',
                auth_user.raw_user_meta_data->>'family_name'
              ),
              ''
            )
          )
        ),
        '[^[:alnum:]]+',
        '',
        'g'
      )
    ) AS normalized_auth_name,
    coalesce(
      nullif(auth_user.raw_user_meta_data->>'sub', ''),
      (
        SELECT coalesce(
          nullif(identity_row.identity_data->>'sub', ''),
          nullif(identity_row.provider_id, '')
        )
        FROM auth.identities identity_row
        WHERE identity_row.user_id = auth_user.id
          AND identity_row.provider = 'apple'
        ORDER BY identity_row.created_at
        LIMIT 1
      )
    ) AS metadata_apple_sub,
    auth_user.email ILIKE '%@privaterelay.appleid.com' AS is_private_relay,
    auth_user.raw_user_meta_data->>'iss' ILIKE '%appleid.apple.com%' AS has_apple_issuer,
    EXISTS (
      SELECT 1
      FROM auth.identities identity_row
      WHERE identity_row.user_id = auth_user.id
        AND identity_row.provider = 'apple'
    ) AS has_apple_identity,
    NOT EXISTS (
      SELECT 1
      FROM auth.identities identity_row
      WHERE identity_row.user_id = auth_user.id
    ) AS has_no_identity
  FROM auth.users auth_user
  WHERE auth_user.deleted_at IS NULL
),
profile_accounts AS MATERIALIZED (
  SELECT
    profile.id,
    lower(
      regexp_replace(
        trim(coalesce(nullif(profile.full_name, ''), nullif(profile.display_name, ''))),
        '[^[:alnum:]]+',
        '',
        'g'
      )
    ) AS normalized_profile_name,
    nullif(lower(trim(profile.phone_number)), '') AS normalized_phone,
    nullif(lower(trim(profile.instagram)), '') AS normalized_instagram,
    profile.home_beach_id,
    nullif(lower(trim(profile.home_region)), '') AS normalized_home_region,
    nullif(lower(trim(profile.location)), '') AS normalized_location
  FROM public.profiles profile
  WHERE profile.deleted_at IS NULL
),
apple_accounts AS MATERIALIZED (
  SELECT account.*
  FROM auth_accounts account
  WHERE account.is_private_relay
     OR account.has_apple_issuer
     OR account.has_apple_identity
),
real_email_accounts AS MATERIALIZED (
  SELECT account.*
  FROM auth_accounts account
  WHERE account.email IS NOT NULL
    AND account.email NOT ILIKE '%@privaterelay.appleid.com'
),
pair_signals AS MATERIALIZED (
  SELECT
    apple.id AS apple_user_id,
    apple.email AS apple_email,
    apple.created_at AS apple_created_at,
    apple.last_sign_in_at AS apple_last_sign_in_at,
    apple.is_private_relay,
    apple.has_apple_issuer,
    apple.has_apple_identity,
    apple.has_no_identity,
    real_account.id AS probable_canonical_user_id,
    real_account.email AS probable_canonical_email,
    real_account.created_at AS canonical_created_at,
    real_account.last_sign_in_at AS canonical_last_sign_in_at,
    apple.normalized_auth_name <> ''
      AND apple.normalized_auth_name = real_account.normalized_auth_name
      AS shared_auth_name,
    apple_profile.normalized_profile_name <> ''
      AND apple_profile.normalized_profile_name = real_profile.normalized_profile_name
      AS shared_profile_name,
    apple_profile.normalized_phone IS NOT NULL
      AND apple_profile.normalized_phone = real_profile.normalized_phone
      AS shared_phone,
    apple_profile.normalized_instagram IS NOT NULL
      AND apple_profile.normalized_instagram = real_profile.normalized_instagram
      AS shared_instagram,
    apple_profile.home_beach_id IS NOT NULL
      AND apple_profile.home_beach_id = real_profile.home_beach_id
      AS shared_home_beach,
    apple_profile.normalized_home_region IS NOT NULL
      AND apple_profile.normalized_home_region = real_profile.normalized_home_region
      AS shared_home_region,
    apple_profile.normalized_location IS NOT NULL
      AND apple_profile.normalized_location = real_profile.normalized_location
      AS shared_location,
    EXISTS (
      SELECT 1
      FROM auth.identities identity_row
      WHERE identity_row.user_id = real_account.id
        AND identity_row.provider = 'apple'
        AND (
          identity_row.provider_id = apple.metadata_apple_sub
          OR identity_row.identity_data->>'sub' = apple.metadata_apple_sub
        )
    ) AS shared_apple_sub,
    EXISTS (
      SELECT 1
      FROM public.user_devices apple_device
      JOIN public.user_devices canonical_device
        ON canonical_device.device_token = apple_device.device_token
      WHERE apple_device.user_id = apple.id
        AND canonical_device.user_id = real_account.id
    ) AS shared_user_device,
    EXISTS (
      SELECT 1
      FROM public.user_events apple_event
      JOIN public.user_events canonical_event
        ON canonical_event.metadata->>'native_install_id'
          = apple_event.metadata->>'native_install_id'
      WHERE apple_event.user_id = apple.id
        AND canonical_event.user_id = real_account.id
        AND nullif(apple_event.metadata->>'native_install_id', '') IS NOT NULL
    ) AS shared_native_install,
    EXISTS (
      SELECT 1
      FROM public.user_events apple_event
      JOIN public.user_events canonical_event
        ON canonical_event.session_id = apple_event.session_id
      WHERE apple_event.user_id = apple.id
        AND canonical_event.user_id = real_account.id
        AND apple_event.session_id IS NOT NULL
    ) AS shared_event_session
  FROM apple_accounts apple
  JOIN real_email_accounts real_account ON real_account.id <> apple.id
  LEFT JOIN profile_accounts apple_profile ON apple_profile.id = apple.id
  LEFT JOIN profile_accounts real_profile ON real_profile.id = real_account.id
),
scored_pairs AS MATERIALIZED (
  SELECT
    pair_signals.*,
    (
      CASE WHEN shared_apple_sub THEN 100 ELSE 0 END
      + CASE WHEN shared_user_device THEN 60 ELSE 0 END
      + CASE WHEN shared_native_install THEN 60 ELSE 0 END
      + CASE WHEN shared_event_session THEN 60 ELSE 0 END
      + CASE WHEN shared_phone THEN 50 ELSE 0 END
      + CASE WHEN shared_instagram THEN 35 ELSE 0 END
      + CASE WHEN shared_auth_name THEN 25 ELSE 0 END
      + CASE WHEN shared_profile_name THEN 20 ELSE 0 END
      + CASE WHEN shared_home_beach THEN 10 ELSE 0 END
      + CASE WHEN shared_home_region THEN 5 ELSE 0 END
      + CASE WHEN shared_location THEN 5 ELSE 0 END
    ) AS evidence_score
  FROM pair_signals
),
probable_pairs AS MATERIALIZED (
  SELECT
    scored_pairs.*,
    CASE
      WHEN shared_apple_sub
        OR shared_user_device
        OR shared_native_install
        OR shared_event_session
        OR shared_phone
        THEN 'high'
      ELSE 'medium'
    END AS confidence,
    array_remove(
      ARRAY[
        CASE WHEN shared_apple_sub THEN 'stable_apple_sub' END,
        CASE WHEN shared_user_device THEN 'user_device_token' END,
        CASE WHEN shared_native_install THEN 'native_install_id' END,
        CASE WHEN shared_event_session THEN 'event_session_id' END,
        CASE WHEN shared_phone THEN 'profile_phone' END,
        CASE WHEN shared_instagram THEN 'profile_instagram' END,
        CASE WHEN shared_auth_name THEN 'auth_metadata_name' END,
        CASE WHEN shared_profile_name THEN 'profile_name' END,
        CASE WHEN shared_home_beach THEN 'profile_home_beach' END,
        CASE WHEN shared_home_region THEN 'profile_home_region' END,
        CASE WHEN shared_location THEN 'profile_location' END
      ],
      NULL
    ) AS evidence
  FROM scored_pairs
  WHERE shared_apple_sub
     OR shared_user_device
     OR shared_native_install
     OR shared_event_session
     OR shared_phone
     OR (
       is_private_relay
       AND canonical_created_at < apple_created_at
       AND (shared_auth_name OR shared_profile_name)
       AND (
         shared_instagram
         OR shared_home_beach
         OR shared_home_region
         OR shared_location
       )
     )
),
summary_rows AS (
  SELECT 1 AS sort_order, 'summary'::text AS record_type,
    'apple_shaped_accounts'::text AS metric,
    (SELECT count(*) FROM apple_accounts)::text AS metric_value
  UNION ALL
  SELECT 2, 'summary', 'apple_oidc_without_identity',
    (SELECT count(*) FROM apple_accounts WHERE has_apple_issuer AND has_no_identity)::text
  UNION ALL
  SELECT 3, 'summary', 'probable_orphan_users',
    (SELECT count(DISTINCT apple_user_id) FROM probable_pairs)::text
  UNION ALL
  SELECT 4, 'summary', 'probable_pairs',
    (SELECT count(*) FROM probable_pairs)::text
  UNION ALL
  SELECT 5, 'summary', 'high_confidence_pairs',
    (SELECT count(*) FROM probable_pairs WHERE confidence = 'high')::text
  UNION ALL
  SELECT 6, 'summary', 'medium_confidence_pairs',
    (SELECT count(*) FROM probable_pairs WHERE confidence = 'medium')::text
)
SELECT
  output.record_type,
  output.metric,
  output.metric_value,
  output.confidence,
  output.evidence_score,
  output.evidence,
  output.apple_user_id,
  output.apple_email,
  output.apple_created_at,
  output.apple_last_sign_in_at,
  output.apple_has_no_identity,
  output.probable_canonical_user_id,
  output.probable_canonical_email,
  output.canonical_created_at,
  output.canonical_last_sign_in_at
FROM (
  SELECT
    summary.sort_order,
    summary.record_type,
    summary.metric,
    summary.metric_value,
    NULL::text AS confidence,
    NULL::integer AS evidence_score,
    NULL::text[] AS evidence,
    NULL::uuid AS apple_user_id,
    NULL::text AS apple_email,
    NULL::timestamptz AS apple_created_at,
    NULL::timestamptz AS apple_last_sign_in_at,
    NULL::boolean AS apple_has_no_identity,
    NULL::uuid AS probable_canonical_user_id,
    NULL::text AS probable_canonical_email,
    NULL::timestamptz AS canonical_created_at,
    NULL::timestamptz AS canonical_last_sign_in_at
  FROM summary_rows summary

  UNION ALL

  SELECT
    100 + row_number() OVER (
      ORDER BY pair.evidence_score DESC, pair.apple_created_at DESC
    ) AS sort_order,
    'pair'::text AS record_type,
    NULL::text AS metric,
    NULL::text AS metric_value,
    pair.confidence,
    pair.evidence_score,
    pair.evidence,
    pair.apple_user_id,
    pair.apple_email,
    pair.apple_created_at,
    pair.apple_last_sign_in_at,
    pair.has_no_identity AS apple_has_no_identity,
    pair.probable_canonical_user_id,
    pair.probable_canonical_email,
    pair.canonical_created_at,
    pair.canonical_last_sign_in_at
  FROM probable_pairs pair
) output
ORDER BY output.sort_order;

SELECT
  source_ns.nspname AS source_schema,
  source_table.relname AS source_table,
  current_constraint.conname AS constraint_name,
  target_ns.nspname AS target_schema,
  target_table.relname AS target_table
FROM pg_constraint current_constraint
JOIN pg_class source_table ON source_table.oid = current_constraint.conrelid
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
JOIN pg_class target_table ON target_table.oid = current_constraint.confrelid
JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
WHERE current_constraint.contype = 'f'
  AND source_ns.nspname = 'public'
  AND current_constraint.confrelid IN (
    'auth.users'::regclass,
    'public.profiles'::regclass
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.apple_recovery_dependency_registry registry
    WHERE registry.source_schema = source_ns.nspname
      AND registry.source_table = source_table.relname
      AND registry.constraint_name = current_constraint.conname
      AND registry.target_schema = target_ns.nspname
      AND registry.target_table = target_table.relname
  )
ORDER BY source_schema, source_table, constraint_name;

COMMIT;
