-- Runtime proof for migration
-- 20260727231500_create_trusted_external_forecast_adjustments.sql.
--
-- Everything here executes against a real PostgreSQL instance: forbidden
-- UPDATE/DELETE statements are actually run, the RPC is actually called, and
-- the stored digest is compared against a digest this file recomputes. No
-- assertion in this file is a regex over the migration text.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(62);

-- ---------------------------------------------------------------------------
-- Helpers. Running a statement inside a PL/pgSQL exception block gives us the
-- SQLSTATE without aborting the surrounding test transaction, and rolls the
-- attempted work back to the implicit savepoint — which is exactly the
-- atomicity property the receipt-last RPC must have.
-- ---------------------------------------------------------------------------

CREATE FUNCTION pg_temp.raised_sqlstate(p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

CREATE FUNCTION pg_temp.raised_message(p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;

CREATE FUNCTION pg_temp.canonical_sha256(p_payload jsonb)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT encode(
    pg_catalog.sha256(
      convert_to(
        public.trusted_forecast_canonical_build_payload(p_payload)::text,
        'UTF8'
      )
    ),
    'hex'
  );
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

INSERT INTO public.beaches (id, name, lat, lon) VALUES
  ('9a000000-0000-4000-8000-000000000001', 'Trusted Forecast Test A', 33.38, -117.59),
  ('9a000000-0000-4000-8000-000000000002', 'Trusted Forecast Test B', 21.66, -158.05);

-- A WaveCast spot-chart issue: region_key carries a chart SPOT SLUG and
-- exposure carries free source text. Both would fail immediately under a
-- vocabulary CHECK, which is why the migration deliberately has none.
INSERT INTO public.trusted_forecast_issues (
  issue_id,
  provider_lineage,
  source_key,
  issued_at,
  valid_local_date,
  valid_timezone,
  valid_start_at,
  valid_end_at,
  validity_basis,
  scope_type,
  region_key,
  exposure,
  day_part,
  measurement_basis,
  min_face_ft,
  max_face_ft,
  parser_version,
  source_hash,
  issue_identity_key,
  revision_hash,
  authority_eligible,
  evidence_class,
  ingest_run_id,
  fetched_at
) VALUES (
  '9b000000-0000-4000-8000-000000000001',
  'wavecast',
  'socal',
  '2026-07-27T13:45:00Z',
  '2026-07-27',
  'America/Los_Angeles',
  '2026-07-27T13:00:00Z',
  '2026-07-28T13:00:00Z',
  'derived_publication_day',
  'spot',
  'huntington-beach',
  'primary',
  'all_day',
  'breaking_face_ft',
  2.0,
  3.0,
  'wavecast-spot-chart.v1',
  repeat('c', 64),
  repeat('a', 64),
  repeat('b', 64),
  true,
  'human_face_height_authority',
  '9c000000-0000-4000-8000-000000000001',
  '2026-07-27T14:00:00Z'
),
(
  '9b000000-0000-4000-8000-000000000002',
  'nws',
  'nws_hawaii_srf',
  '2026-07-27T10:00:00Z',
  '2026-07-27',
  'Pacific/Honolulu',
  '2026-07-27T16:00:00Z',
  '2026-07-28T04:00:00Z',
  'stated',
  'regional',
  'hawaii',
  'kauai/NORTH',
  'day',
  'breaking_face_ft',
  4.0,
  6.0,
  'nws-hawaii-srf.v2',
  repeat('d', 64),
  repeat('e', 64),
  repeat('f', 64),
  true,
  'human_face_height_authority',
  '9c000000-0000-4000-8000-000000000001',
  '2026-07-27T14:00:00Z'
);

INSERT INTO public.trusted_forecast_ingest_runs (
  ingest_run_id, started_at, finished_at, source_count, ok_count,
  failed_count, issue_count, healthy
) VALUES (
  '9c000000-0000-4000-8000-000000000001',
  '2026-07-27T14:00:00Z',
  '2026-07-27T14:02:00Z',
  17, 17, 0, 512, true
);

-- A pre-existing first-write snapshot the RPC must never touch.
INSERT INTO public.ml_predictions_log (
  id,
  beach_id,
  predicted_at,
  forecast_horizon_hours,
  forecast_horizon_bucket,
  raw_display_height_m,
  offset_corrected_display_height_m,
  display_source,
  model_version
) VALUES (
  '9d000000-0000-4000-8000-000000000001',
  '9a000000-0000-4000-8000-000000000001',
  '2026-07-27T18:00:00Z',
  6,
  '0-24h',
  1.1100,
  1.1100,
  'face-Hs-transformer-v1',
  'face-Hs-transformer-v1'
);

CREATE TEMPORARY TABLE trusted_snapshot_before AS
SELECT to_jsonb(row) AS snapshot
FROM public.ml_predictions_log AS row
WHERE row.id = '9d000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Payload fixtures
-- ---------------------------------------------------------------------------

CREATE TEMPORARY TABLE trusted_payload (name text PRIMARY KEY, payload jsonb);

INSERT INTO trusted_payload (name, payload) VALUES (
  'baseline',
  jsonb_build_object(
    'schemaVersion', 'trusted-forecast.v1',
    'policyVersion', 'trusted-policy.v1',
    'buildKey', 'build-baseline',
    'buildAnchorAt', '2026-07-27T12:00:00Z',
    'expectedDecisionCount', 1,
    'expectedApplicationCount', 1,
    'expectedAlertCount', 1,
    'expectedSnapshotCount', 2,
    'decisions', jsonb_build_array(
      jsonb_build_object(
        'beachId', '9a000000-0000-4000-8000-000000000001',
        'localDate', '2026-07-27',
        'localTimezone', 'America/Los_Angeles',
        'status', 'applied',
        'primaryIssueId', '9b000000-0000-4000-8000-000000000001',
        'baselineMaxFaceFt', 1.25,
        'trustedMinFaceFt', 2.0,
        'trustedMaxFaceFt', 3.0,
        'signedGapFt', 0.75,
        'appliedDeltaFt', 0.5
      )
    ),
    'applications', jsonb_build_array(
      jsonb_build_object(
        'beachId', '9a000000-0000-4000-8000-000000000001',
        'localDate', '2026-07-27',
        'forecastAt', '2026-07-27T18:00:00Z',
        'appliedDeltaFt', 0.5,
        'baselineMaxFaceFt', 1.25,
        'adjustedMaxFaceFt', 1.75
      )
    ),
    'alerts', jsonb_build_array(
      jsonb_build_object(
        'beachId', '9a000000-0000-4000-8000-000000000001',
        'localDate', '2026-07-27',
        'alertCode', 'range_separation_exceeded',
        'separationFt', 1.5,
        'primaryIssueId', '9b000000-0000-4000-8000-000000000001',
        'conflictingIssueId', '9b000000-0000-4000-8000-000000000002',
        'evidence', jsonb_build_object('note', 'independent lineages disagree')
      )
    ),
    'snapshots', jsonb_build_array(
      -- Collides with the pre-existing first-write row on
      -- (beach_id, predicted_at, forecast_horizon_bucket, display_source).
      jsonb_build_object(
        'beach_id', '9a000000-0000-4000-8000-000000000001',
        'predicted_at', '2026-07-27T18:00:00Z',
        'forecast_horizon_hours', 6,
        'forecast_horizon_bucket', '0-24h',
        'raw_display_height_m', 9.99,
        'offset_corrected_display_height_m', 9.99,
        'display_source', 'face-Hs-transformer-v1',
        'model_version', 'face-Hs-transformer-v1'
      ),
      jsonb_build_object(
        'beach_id', '9a000000-0000-4000-8000-000000000002',
        'predicted_at', '2026-07-27T18:00:00Z',
        'forecast_horizon_hours', 6,
        'forecast_horizon_bucket', '0-24h',
        'raw_display_height_m', 0.61,
        'offset_corrected_display_height_m', 0.61,
        'display_source', 'face-Hs-transformer-v1',
        'model_version', 'face-Hs-transformer-v1'
      )
    )
  )
);

-- ===========================================================================
-- 1. PRIVACY (MFA-07, D-23) — 17 assertions
-- ===========================================================================

SELECT is(
  (
    SELECT count(*)::integer
    FROM unnest(ARRAY[
      'trusted_forecast_ingest_runs',
      'trusted_forecast_ingest_source_results',
      'trusted_forecast_issues',
      'trusted_forecast_decisions',
      'trusted_forecast_applications',
      'trusted_forecast_alerts',
      'trusted_forecast_build_receipts'
    ]) AS trusted(table_name)
    WHERE has_table_privilege(
      'anon',
      format('public.%I', trusted.table_name),
      'SELECT'
    )
  ),
  0,
  'anonymous clients can read none of the seven trusted tables'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM unnest(ARRAY[
      'trusted_forecast_ingest_runs',
      'trusted_forecast_ingest_source_results',
      'trusted_forecast_issues',
      'trusted_forecast_decisions',
      'trusted_forecast_applications',
      'trusted_forecast_alerts',
      'trusted_forecast_build_receipts'
    ]) AS trusted(table_name)
    WHERE has_table_privilege(
      'authenticated',
      format('public.%I', trusted.table_name),
      'SELECT'
    )
  ),
  0,
  'authenticated clients can read none of the seven trusted tables'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM unnest(ARRAY[
      'trusted_forecast_ingest_runs',
      'trusted_forecast_ingest_source_results',
      'trusted_forecast_issues',
      'trusted_forecast_decisions',
      'trusted_forecast_applications',
      'trusted_forecast_alerts',
      'trusted_forecast_build_receipts'
    ]) AS trusted(table_name)
    WHERE has_table_privilege(
      'authenticated',
      format('public.%I', trusted.table_name),
      'INSERT'
    )
  ),
  0,
  'authenticated clients cannot insert into any trusted table'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname LIKE 'trusted_forecast%'
      AND relkind = 'r'
      AND relrowsecurity = false
  ),
  0,
  'every trusted table has row level security enabled'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.persist_trusted_forecast_build(jsonb)',
    'EXECUTE'
  ),
  'anonymous clients cannot execute the build persistence RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.persist_trusted_forecast_build(jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the build persistence RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_trusted_forecast_build_receipt(text)',
    'EXECUTE'
  ),
  'anonymous clients cannot read build receipts through the RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_trusted_forecast_build_receipt(text)',
    'EXECUTE'
  ),
  'authenticated clients cannot read build receipts through the RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.acknowledge_trusted_forecast_alert(jsonb)',
    'EXECUTE'
  ),
  'anonymous clients cannot acknowledge trusted forecast alerts'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.acknowledge_trusted_forecast_alert(jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot acknowledge trusted forecast alerts'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.trusted_forecast_canonical_build_payload(jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot reach the canonicalizer'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.persist_trusted_forecast_build(jsonb)',
    'EXECUTE'
  ),
  'the forecast builder retains permission to persist a trusted build'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_trusted_forecast_build_receipt(text)',
    'EXECUTE'
  ),
  'the forecast builder retains permission to reconcile a receipt'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.acknowledge_trusted_forecast_alert(jsonb)',
    'EXECUTE'
  ),
  'the operator path retains permission to acknowledge an alert'
);

SELECT ok(
  has_table_privilege(
    'service_role',
    'public.trusted_forecast_issues',
    'INSERT'
  ),
  'Seaside ingestion retains INSERT on normalized issues'
);

SELECT ok(
  NOT has_table_privilege(
    'service_role',
    'public.trusted_forecast_decisions',
    'INSERT'
  ),
  'decisions are writable only through the persistence RPC'
);

SELECT ok(
  NOT has_table_privilege(
    'service_role',
    'public.trusted_forecast_build_receipts',
    'INSERT'
  ),
  'receipts are writable only through the persistence RPC'
);

-- ===========================================================================
-- 2. CARRY-FORWARD COLUMNS FROM 21-01 — 6 assertions
-- ===========================================================================

SELECT has_column(
  'public',
  'trusted_forecast_issues',
  'day_part',
  'issues record the sub-day window facet 21-01 emits'
);

SELECT has_column(
  'public',
  'trusted_forecast_issues',
  'validity_basis',
  'issues record whether the validity window was stated or derived'
);

SELECT has_column(
  'public',
  'trusted_forecast_ingest_source_results',
  'degraded_failure_code',
  'source results record the cause of a partial item loss'
);

SELECT has_column(
  'public',
  'trusted_forecast_ingest_source_results',
  'degraded_item_count',
  'source results record how many items were lost'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    UPDATE public.trusted_forecast_issues
    SET day_part = 'afternoon'
    WHERE issue_id = '9b000000-0000-4000-8000-000000000001'
  $$),
  '55000',
  'day_part cannot drift outside the 21-01 vocabulary (append-only wins first)'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    INSERT INTO public.trusted_forecast_ingest_source_results (
      ingest_run_id, source_key, provider_lineage, parser_key, parser_version,
      status, failure_code, degraded_failure_code, degraded_item_count,
      started_at, finished_at
    ) VALUES (
      '9c000000-0000-4000-8000-000000000009', 'socal', 'wavecast',
      'wavecast_socal_index', 'v1', 'parser_failed', 'missing_surf_range',
      'missing_surf_range', 2, now(), now()
    )
  $$),
  '23514',
  'a degraded item count cannot be recorded on a failed source (mirrors SourceResult)'
);

-- ===========================================================================
-- 3. THE TWO ANTI-CONSTRAINTS — 2 assertions
-- ===========================================================================

SELECT is(
  (
    SELECT region_key
    FROM public.trusted_forecast_issues
    WHERE issue_id = '9b000000-0000-4000-8000-000000000001'
  ),
  'huntington-beach',
  'region_key accepts a WaveCast chart spot slug, not just a region name'
);

SELECT is(
  (
    SELECT count(DISTINCT exposure)::integer
    FROM public.trusted_forecast_issues
  ),
  2,
  'exposure accepts free source text (primary and kauai/NORTH coexist)'
);

-- ===========================================================================
-- 4. IMMUTABILITY (D-18) — 7 assertions
-- ===========================================================================

SELECT is(
  pg_temp.raised_sqlstate($$
    UPDATE public.trusted_forecast_issues SET max_face_ft = 99
  $$),
  '55000',
  'normalized issue revisions cannot be updated'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    DELETE FROM public.trusted_forecast_issues
  $$),
  '55000',
  'normalized issue revisions cannot be deleted'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    UPDATE public.trusted_forecast_ingest_runs SET healthy = false
  $$),
  '55000',
  'ingest run health cannot be rewritten after the fact'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    DELETE FROM public.trusted_forecast_ingest_runs
  $$),
  '55000',
  'ingest run history cannot be deleted'
);

SELECT is(
  pg_temp.raised_message($$
    UPDATE public.trusted_forecast_issues SET exposure = 'NNW'
  $$),
  'trusted forecast history is append-only (public.trusted_forecast_issues)',
  'the append-only refusal names the table it protected'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_trigger
    WHERE tgrelid IN (
        'public.trusted_forecast_ingest_runs'::regclass,
        'public.trusted_forecast_ingest_source_results'::regclass,
        'public.trusted_forecast_issues'::regclass,
        'public.trusted_forecast_decisions'::regclass,
        'public.trusted_forecast_applications'::regclass,
        'public.trusted_forecast_alerts'::regclass,
        'public.trusted_forecast_build_receipts'::regclass
      )
      AND NOT tgisinternal
  ),
  7,
  'all seven trusted tables carry a mutation-rejecting trigger'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    INSERT INTO public.trusted_forecast_issues (
      provider_lineage, source_key, issued_at, valid_local_date, valid_timezone,
      valid_start_at, valid_end_at, validity_basis, scope_type, region_key,
      exposure, day_part, measurement_basis, min_face_ft, max_face_ft,
      parser_version, source_hash, issue_identity_key, revision_hash,
      authority_eligible, evidence_class, fetched_at
    ) VALUES (
      'wavecast', 'socal', now(), current_date, 'America/Los_Angeles',
      now(), now() + interval '1 day', 'stated', 'spot', 'malibu',
      'primary', 'all_day', 'unspecified', NULL, NULL,
      'v1', repeat('9', 64), repeat('8', 64), repeat('b', 64),
      false, 'evidence_only', now()
    )
  $$),
  '23505',
  'a repeated revision hash cannot create a second row for the same revision'
);

-- ===========================================================================
-- 5. STRICT INPUT AND ATOMIC ROLLBACK (D-19) — 8 assertions
-- ===========================================================================

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT payload || jsonb_build_object('payloadSha256', repeat('0', 64))
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '22023',
  'a caller-supplied digest is rejected as an unsupported field'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT payload - 'policyVersion'
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '22023',
  'a missing required field is rejected'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{expectedDecisionCount}', '4'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '22023',
  'an expected count that disagrees with its collection is rejected'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(
                payload,
                '{decisions,0}',
                (payload -> 'decisions' -> 0) || jsonb_build_object('note', 'x')
              )
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '22023',
  'an unknown field inside a decision is rejected'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{applications,0,localDate}', '"2026-07-28"'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23503',
  'an application without a daily decision aborts the build'
);

-- The previous call reached the decision INSERT before the missing-decision
-- lookup aborted it. Nothing from that build may be durable afterwards.
SELECT is(
  (SELECT count(*)::integer FROM public.trusted_forecast_decisions),
  0,
  'a mid-build failure leaves no decision behind'
);

SELECT is(
  (SELECT count(*)::integer FROM public.trusted_forecast_applications),
  0,
  'a mid-build failure leaves no application behind'
);

SELECT is(
  (SELECT count(*)::integer FROM public.trusted_forecast_build_receipts),
  0,
  'a mid-build failure leaves no receipt behind'
);

-- ===========================================================================
-- 6. THE HAPPY PATH AND ITS RECEIPT — 7 assertions
-- ===========================================================================

CREATE TEMPORARY TABLE trusted_receipt AS
SELECT *
FROM public.persist_trusted_forecast_build(
  (SELECT payload FROM trusted_payload WHERE name = 'baseline')
);

SELECT is(
  (SELECT count(*)::integer FROM trusted_receipt),
  1,
  'one build returns exactly one receipt'
);

SELECT is(
  (SELECT payload_sha256 FROM trusted_receipt),
  pg_temp.canonical_sha256(
    (SELECT payload FROM trusted_payload WHERE name = 'baseline')
  ),
  'the stored digest is the database canonicalization of the payload'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'decisions', inserted_decision_count,
      'applications', inserted_application_count,
      'alerts', inserted_alert_count,
      'snapshots', inserted_snapshot_count,
      'reusedSnapshots', reused_snapshot_count,
      'durableAlerts', durable_alert_count
    )
    FROM trusted_receipt
  ),
  jsonb_build_object(
    'decisions', 1,
    'applications', 1,
    'alerts', 1,
    'snapshots', 1,
    'reusedSnapshots', 1,
    'durableAlerts', 1
  ),
  'the receipt decomposes inserted and reused durable counts exactly'
);

SELECT is(
  (
    SELECT to_jsonb(row)
    FROM public.ml_predictions_log AS row
    WHERE row.id = '9d000000-0000-4000-8000-000000000001'
  ),
  (SELECT snapshot FROM trusted_snapshot_before),
  'the pre-existing first-write snapshot is byte-for-byte unchanged'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.ml_predictions_log
    WHERE beach_id = '9a000000-0000-4000-8000-000000000002'
  ),
  1,
  'the missing snapshot was inserted exactly once'
);

SELECT is(
  (
    SELECT prediction_snapshot_id
    FROM public.trusted_forecast_applications
  ),
  '9d000000-0000-4000-8000-000000000001'::uuid,
  'the application resolves the durable prediction snapshot identity'
);

SELECT is(
  (
    SELECT receipt_id
    FROM public.get_trusted_forecast_build_receipt('build-baseline')
  ),
  (SELECT receipt_id FROM trusted_receipt),
  'the reconciliation RPC returns the same receipt by build key'
);

-- ===========================================================================
-- 7. EXACT REPLAY AND COLLISION (D-20) — 9 assertions
-- ===========================================================================

SELECT is(
  (
    SELECT receipt_id
    FROM public.persist_trusted_forecast_build(
      (SELECT payload FROM trusted_payload WHERE name = 'baseline')
    )
  ),
  (SELECT receipt_id FROM trusted_receipt),
  'an identical replay returns the identical receipt'
);

SELECT is(
  (SELECT count(*)::integer FROM public.trusted_forecast_decisions),
  1,
  'an identical replay creates no second decision'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{decisions,0,appliedDeltaFt}', '0.25'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'changed content under the same build key raises an idempotency collision'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(
                payload,
                '{applications,0,forecastAt}',
                '"2026-07-27T21:00:00Z"'::jsonb
              )
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'a changed forecast slot under the same build key raises a collision'
);

-- Each expected count is compared independently. Seed a receipt whose digest
-- is correct but whose count is not, and require the collision anyway. Four
-- separate build keys so the four checks cannot mask one another.
INSERT INTO public.trusted_forecast_build_receipts (
  build_key, payload_sha256, schema_version, policy_version, build_anchor_at,
  expected_decision_count, expected_application_count, expected_alert_count,
  expected_snapshot_count,
  inserted_decision_count, reused_decision_count,
  inserted_application_count, reused_application_count,
  inserted_alert_count, reused_alert_count,
  inserted_snapshot_count, reused_snapshot_count, durable_alert_count
)
SELECT
  variant.build_key,
  pg_temp.canonical_sha256(
    jsonb_set(base.payload, '{buildKey}', to_jsonb(variant.build_key))
  ),
  'trusted-forecast.v1',
  'trusted-policy.v1',
  '2026-07-27T12:00:00Z',
  1 + variant.decision_drift,
  1 + variant.application_drift,
  1 + variant.alert_drift,
  2 + variant.snapshot_drift,
  1 + variant.decision_drift, 0,
  1 + variant.application_drift, 0,
  1 + variant.alert_drift, 0,
  2 + variant.snapshot_drift, 0,
  1
FROM trusted_payload AS base,
LATERAL (
  VALUES
    ('build-drift-decision', 1, 0, 0, 0),
    ('build-drift-application', 0, 1, 0, 0),
    ('build-drift-alert', 0, 0, 1, 0),
    ('build-drift-snapshot', 0, 0, 0, 1)
) AS variant(
  build_key, decision_drift, application_drift, alert_drift, snapshot_drift
)
WHERE base.name = 'baseline';

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{buildKey}', '"build-drift-decision"'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'a matching digest with a drifted decision count still collides'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{buildKey}', '"build-drift-application"'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'a matching digest with a drifted application count still collides'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{buildKey}', '"build-drift-alert"'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'a matching digest with a drifted alert count still collides'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(payload, '{buildKey}', '"build-drift-snapshot"'::jsonb)
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'a matching digest with a drifted snapshot count still collides'
);

-- ===========================================================================
-- 8. UNIQUENESS UNDER A DIFFERENT BUILD (D-13) — 2 assertions
-- ===========================================================================

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT public.persist_trusted_forecast_build(
      (SELECT jsonb_set(
                jsonb_set(payload, '{buildKey}', '"build-second"'::jsonb),
                '{decisions,0,appliedDeltaFt}',
                '-0.25'::jsonb
              )
       FROM trusted_payload WHERE name = 'baseline')
    )
  $$),
  '23505',
  'a second build cannot write a different decision for the same beach and local day'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.trusted_forecast_decisions
    WHERE beach_id = '9a000000-0000-4000-8000-000000000001'
      AND local_date = '2026-07-27'
  ),
  1,
  'exactly one decision exists for the beach and local day'
);

-- ===========================================================================
-- 9. CONSTRAINED ACKNOWLEDGEMENT (D-22) — 5 assertions
-- ===========================================================================

SELECT is(
  pg_temp.raised_sqlstate($$
    UPDATE public.trusted_forecast_alerts SET acknowledged = true
  $$),
  '55000',
  'an alert cannot be acknowledged by direct UPDATE'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    DELETE FROM public.trusted_forecast_alerts
  $$),
  '55000',
  'alert evidence cannot be deleted'
);

SELECT is(
  pg_temp.raised_sqlstate($$
    SELECT set_config('app.trusted_forecast_alert_acknowledgement', 'on', true);
    UPDATE public.trusted_forecast_alerts SET separation_ft = 0.1
  $$),
  '55000',
  'the acknowledgement path cannot be borrowed to rewrite alert evidence'
);

SELECT is(
  (
    SELECT jsonb_build_object(
      'acknowledged', acknowledged,
      'acknowledgedBy', acknowledged_by,
      'hasTimestamp', acknowledged_at IS NOT NULL
    )
    FROM public.acknowledge_trusted_forecast_alert(
      jsonb_build_object(
        'alertId', (SELECT alert_id FROM public.trusted_forecast_alerts LIMIT 1),
        'acknowledgedBy', 'ops@quiversurf.test'
      )
    )
  ),
  jsonb_build_object(
    'acknowledged', true,
    'acknowledgedBy', 'ops@quiversurf.test',
    'hasTimestamp', true
  ),
  'the acknowledgement RPC sets status, actor, and timestamp'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.trusted_forecast_alerts
    WHERE separation_ft = 1.5
      AND alert_code = 'range_separation_exceeded'
      AND primary_issue_id = '9b000000-0000-4000-8000-000000000001'
      AND conflicting_issue_id = '9b000000-0000-4000-8000-000000000002'
      AND evidence = jsonb_build_object('note', 'independent lineages disagree')
  ),
  1,
  'acknowledgement left every evidence column untouched'
);

SELECT * FROM finish();
ROLLBACK;
