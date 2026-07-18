\set ON_ERROR_STOP on

-- Local-only transactional verification for P0-A recommendation holds.
-- Apply the reviewed migration locally before running this file. Every row
-- created here is rolled back.

BEGIN;

CREATE TEMP TABLE fixture_ids (
  label text PRIMARY KEY,
  id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.fixture_uuid(p_label text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM pg_temp.fixture_ids
  WHERE label = p_label;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO pg_temp.fixture_ids (label, id) VALUES (p_label, v_id);
  END IF;

  RETURN v_id;
END;
$$;

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES
  (
    pg_temp.fixture_uuid('f201'),
    'authenticated',
    'authenticated',
    'hold-smoke-operator-' || pg_temp.fixture_uuid('f201')::text
      || '@example.test',
    transaction_timestamp(),
    transaction_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    pg_temp.fixture_uuid('f202'),
    'authenticated',
    'authenticated',
    'hold-smoke-erasure-' || pg_temp.fixture_uuid('f202')::text
      || '@example.test',
    transaction_timestamp(),
    transaction_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    pg_temp.fixture_uuid('f203'),
    'authenticated',
    'authenticated',
    'hold-smoke-hard-delete-' || pg_temp.fixture_uuid('f203')::text
      || '@example.test',
    transaction_timestamp(),
    transaction_timestamp(),
    jsonb_build_object('is_ephemeral_smoke_test', true),
    '{}'::jsonb
  );

INSERT INTO public.beaches (id, name, lat, lon, timezone)
VALUES
  (
    pg_temp.fixture_uuid('b201'),
    'Hold Smoke Valid Beach',
    32.7500,
    -117.2500,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b202'),
    'Hold Smoke Derived Beach',
    32.7510,
    -117.2510,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b203'),
    'Hold Smoke Moderate Beach',
    32.7520,
    -117.2520,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b204'),
    'Hold Smoke Stale Beach',
    32.7530,
    -117.2530,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b205'),
    'Hold Smoke Future Fetch Beach',
    32.7540,
    -117.2540,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b206'),
    'Hold Smoke Past Date Beach',
    32.7550,
    -117.2550,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b207'),
    'Hold Smoke Future Date Beach',
    32.7560,
    -117.2560,
    'America/Los_Angeles'
  ),
  (
    pg_temp.fixture_uuid('b208'),
    'Hold Smoke Missing Timezone Beach',
    32.7570,
    -117.2570,
    NULL
  ),
  (
    pg_temp.fixture_uuid('b209'),
    'Hold Smoke Invalid Timezone Beach',
    32.7580,
    -117.2580,
    'Not/A_Zone'
  ),
  (
    pg_temp.fixture_uuid('b210'),
    'Hold Smoke Valid Alert Beach',
    32.7590,
    -117.2590,
    'America/Los_Angeles'
  );

CREATE OR REPLACE FUNCTION pg_temp.manual_hold_payload(
  p_hold_id uuid,
  p_idempotency_key text,
  p_operator_user_id uuid,
  p_beach_id uuid,
  p_refs jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'holdId', p_hold_id,
    'version', 1,
    'transition', 'activation',
    'regionKeys', '[]'::jsonb,
    'scopeBeachIds', jsonb_build_array(p_beach_id),
    'scopeExposureClasses', '[]'::jsonb,
    'protectedAlternativeBeachIds', '[]'::jsonb,
    'validFrom', transaction_timestamp() - interval '1 hour',
    'validUntil', transaction_timestamp() + interval '2 hours',
    'affectedCohorts',
      jsonb_build_array('beginner', 'intermediate', 'unknown'),
    'action', 'suppress_positive',
    'triggerType', 'manual_operator',
    'supportingEvidenceRefs', p_refs,
    'operatorUserId', p_operator_user_id,
    'authorizingActor', 'admin_api',
    'reasonCode', 'major_swell_manual_safety',
    'effectiveAt', transaction_timestamp(),
    'expiresAt', transaction_timestamp() + interval '2 hours',
    'idempotencyKey', p_idempotency_key,
    'requestId', 'hold_smoke_request'
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.automatic_hold_payload(
  p_hold_id uuid,
  p_idempotency_key text,
  p_reference text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'holdId', p_hold_id,
    'transition', 'activation',
    'triggerType', 'automatic_official',
    'supportingEvidenceRefs', jsonb_build_array(p_reference),
    'idempotencyKey', p_idempotency_key,
    'requestId', 'hold_smoke_automatic'
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_hold_error(
  p_label text,
  p_payload jsonb,
  p_expected_state text,
  p_expected_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_state text;
  v_message text;
BEGIN
  BEGIN
    PERFORM *
    FROM public.append_regional_recommendation_hold_transition(p_payload);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_message = MESSAGE_TEXT;

    IF v_state IS DISTINCT FROM p_expected_state
       OR position(p_expected_message IN v_message) = 0 THEN
      RAISE EXCEPTION
        'fixture_%_wrong_error state=% message=%',
        p_label,
        v_state,
        v_message;
    END IF;
    RETURN;
  END;

  RAISE EXCEPTION 'fixture_%_expected_rejection', p_label;
END;
$$;

-- Service role can execute the append RPC but cannot write policy rows.
SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.regional_recommendation_holds (
      record_id,
      hold_id,
      version,
      transition,
      status,
      scope_beach_ids,
      valid_from,
      valid_until,
      affected_cohorts,
      action,
      trigger_type,
      authorizing_operator_ref,
      authorizing_actor,
      reason_code,
      effective_at,
      expires_at,
      idempotency_key,
      payload_hash
    )
    VALUES (
      gen_random_uuid(),
      gen_random_uuid(),
      1,
      'activation',
      'active',
      ARRAY[gen_random_uuid()]::uuid[],
      transaction_timestamp(),
      transaction_timestamp() + interval '1 hour',
      ARRAY['beginner','intermediate','unknown']::text[],
      'suppress_positive',
      'manual_operator',
      gen_random_uuid(),
      'admin_api',
      'major_swell_manual_safety',
      transaction_timestamp(),
      transaction_timestamp() + interval '1 hour',
      'fixture:direct_write_must_fail',
      repeat('0', 64)
    );

    RAISE EXCEPTION 'fixture_service_role_direct_insert_not_denied';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

-- A future-effective cancellation must not hide the currently effective row.
INSERT INTO public.regional_recommendation_holds (
  record_id,
  hold_id,
  version,
  transition,
  status,
  scope_beach_ids,
  valid_from,
  valid_until,
  affected_cohorts,
  action,
  trigger_type,
  authorizing_operator_ref,
  authorizing_actor,
  reason_code,
  effective_at,
  expires_at,
  idempotency_key,
  payload_hash
)
VALUES (
  pg_temp.fixture_uuid('a210'),
  pg_temp.fixture_uuid('d210'),
  1,
  'activation',
  'active',
  ARRAY[pg_temp.fixture_uuid('b201')]::uuid[],
  transaction_timestamp() - interval '2 hours',
  transaction_timestamp() + interval '4 hours',
  ARRAY['beginner','intermediate','unknown']::text[],
  'suppress_positive',
  'manual_operator',
  pg_temp.fixture_uuid('e210'),
  'admin_api',
  'major_swell_manual_safety',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '3 hours',
  'fixture:resolver_activation',
  repeat('1', 64)
);

INSERT INTO public.regional_recommendation_holds (
  record_id,
  hold_id,
  version,
  transition,
  status,
  scope_beach_ids,
  valid_from,
  valid_until,
  affected_cohorts,
  action,
  trigger_type,
  authorizing_operator_ref,
  authorizing_actor,
  reason_code,
  effective_at,
  expires_at,
  supersedes_record_id,
  idempotency_key,
  payload_hash
)
VALUES (
  pg_temp.fixture_uuid('a211'),
  pg_temp.fixture_uuid('d210'),
  2,
  'cancellation',
  'cancelled',
  ARRAY[pg_temp.fixture_uuid('b201')]::uuid[],
  transaction_timestamp() - interval '2 hours',
  transaction_timestamp() + interval '4 hours',
  ARRAY['beginner','intermediate','unknown']::text[],
  'suppress_positive',
  'manual_operator',
  pg_temp.fixture_uuid('e210'),
  'admin_api',
  'operator_cancelled',
  transaction_timestamp() + interval '1 hour',
  transaction_timestamp() + interval '2 hours',
  pg_temp.fixture_uuid('a210'),
  'fixture:resolver_cancellation',
  repeat('2', 64)
);

SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.regional_recommendation_holds
    SET request_id = 'fixture_service_role_update'
    WHERE idempotency_key = 'fixture:resolver_activation';

    RAISE EXCEPTION 'fixture_service_role_direct_update_not_denied';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.regional_recommendation_holds
    WHERE idempotency_key = 'fixture:resolver_activation';

    RAISE EXCEPTION 'fixture_service_role_direct_delete_not_denied';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

DO $$
DECLARE
  v_now_count integer;
  v_now_version integer;
  v_later_count integer;
BEGIN
  SELECT count(*), max(version)
  INTO v_now_count, v_now_version
  FROM public.resolve_active_regional_recommendation_holds(
    transaction_timestamp(),
    ARRAY[pg_temp.fixture_uuid('b201')]::uuid[],
    transaction_timestamp() - interval '2 hours',
    transaction_timestamp() + interval '4 hours'
  );

  IF v_now_count <> 1 OR v_now_version <> 1 THEN
    RAISE EXCEPTION
      'fixture_resolver_future_version_hid_current count=% version=%',
      v_now_count,
      v_now_version;
  END IF;

  SELECT count(*)
  INTO v_later_count
  FROM public.resolve_active_regional_recommendation_holds(
    transaction_timestamp() + interval '2 hours',
    ARRAY[pg_temp.fixture_uuid('b201')]::uuid[],
    transaction_timestamp() - interval '2 hours',
    transaction_timestamp() + interval '4 hours'
  );

  IF v_later_count <> 0 THEN
    RAISE EXCEPTION
      'fixture_resolver_effective_cancellation_not_applied count=%',
      v_later_count;
  END IF;
END;
$$;

-- Bounded metadata rejection matrix. Each assertion checks the exact failure,
-- so an unrelated exception cannot make the fixture pass.
SELECT pg_temp.expect_hold_error(
  'url_reference',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d220'),
    'fixture:url_reference',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201'),
    '["https://example.test/evidence"]'::jsonb
  ),
  '22023',
  'invalid supporting evidence references'
);

SELECT pg_temp.expect_hold_error(
  'email_reference',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d221'),
    'fixture:email_reference',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201'),
    '["qa:artifact:ops@example"]'::jsonb
  ),
  '22023',
  'invalid supporting evidence references'
);

SELECT pg_temp.expect_hold_error(
  'seventeen_references',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d222'),
    'fixture:seventeen_references',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201'),
    (
      SELECT jsonb_agg('qa:artifact:fixture_' || item)
      FROM generate_series(1, 17) AS items(item)
    )
  ),
  '22023',
  'invalid supporting evidence references'
);

SELECT pg_temp.expect_hold_error(
  'duplicate_reference',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d223'),
    'fixture:duplicate_reference',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201'),
    '["qa:artifact:duplicate","qa:artifact:duplicate"]'::jsonb
  ),
  '22023',
  'invalid supporting evidence references'
);

SELECT pg_temp.expect_hold_error(
  'non_array_reference_not_rejected',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d226'),
    'fixture:non_array_reference',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201')
  ) || jsonb_build_object(
    'supportingEvidenceRefs',
    jsonb_build_object('invalid', 'shape')
  ),
  '22023',
  'invalid supporting evidence references'
);

SELECT pg_temp.expect_hold_error(
  'null_reference_not_rejected',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d227'),
    'fixture:null_reference',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201')
  ) || jsonb_build_object('supportingEvidenceRefs', 'null'::jsonb),
  '22023',
  'invalid supporting evidence references'
);

SELECT pg_temp.expect_hold_error(
  'free_form_reason',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d224'),
    'fixture:free_form_reason',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201')
  ) || jsonb_build_object('reason', 'free form operator text'),
  '22023',
  'unsupported field'
);

SELECT pg_temp.expect_hold_error(
  'unknown_reason_code',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('d225'),
    'fixture:unknown_reason_code',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201')
  ) || jsonb_build_object('reasonCode', 'because_the_operator_said_so'),
  '22023',
  'invalid reason code'
);

-- The transient auth UUID cannot be reused in any field that would be stored
-- or canonicalized into the policy hash.
SELECT pg_temp.expect_hold_error(
  'operator_uuid_reuse_not_rejected',
  pg_temp.manual_hold_payload(
    pg_temp.fixture_uuid('f201'),
    'fixture:operator_uuid_reuse',
    pg_temp.fixture_uuid('f201'),
    pg_temp.fixture_uuid('b201')
  ),
  '22023',
  'manual transition metadata cannot identify operator'
);

INSERT INTO public.rip_current_risks (
  id,
  beach_id,
  valid_date,
  risk_level,
  source,
  fetched_at
)
VALUES
  (
    pg_temp.fixture_uuid('c201'),
    pg_temp.fixture_uuid('b201'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'srf',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c202'),
    pg_temp.fixture_uuid('b202'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'derived',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c203'),
    pg_temp.fixture_uuid('b203'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'moderate',
    'alert',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c204'),
    pg_temp.fixture_uuid('b204'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'srf',
    transaction_timestamp() - interval '12 hours 1 second'
  ),
  (
    pg_temp.fixture_uuid('c205'),
    pg_temp.fixture_uuid('b205'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'alert',
    transaction_timestamp() + interval '5 minutes 1 second'
  ),
  (
    pg_temp.fixture_uuid('c206'),
    pg_temp.fixture_uuid('b206'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date - 1,
    'high',
    'srf',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c207'),
    pg_temp.fixture_uuid('b207'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date + 3,
    'high',
    'srf',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c208'),
    pg_temp.fixture_uuid('b208'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'srf',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c209'),
    pg_temp.fixture_uuid('b209'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'srf',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    pg_temp.fixture_uuid('c210'),
    pg_temp.fixture_uuid('b210'),
    (transaction_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
    'high',
    'alert',
    transaction_timestamp() - interval '1 hour'
  );

DO $$
DECLARE
  v_record public.regional_recommendation_holds%ROWTYPE;
  v_retry public.regional_recommendation_holds%ROWTYPE;
  v_local_date date := (
    transaction_timestamp() AT TIME ZONE 'America/Los_Angeles'
  )::date;
  v_expected_from timestamptz;
  v_expected_until timestamptz;
  v_recomputed_hash text;
BEGIN
  v_expected_from := v_local_date::timestamp
    AT TIME ZONE 'America/Los_Angeles';
  v_expected_until := (v_local_date + 1)::timestamp
    AT TIME ZONE 'America/Los_Angeles';

  SELECT *
  INTO v_record
  FROM public.append_regional_recommendation_hold_transition(
    pg_temp.automatic_hold_payload(
      pg_temp.fixture_uuid('d230'),
      'fixture:automatic_accept',
      'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
    )
  );

  IF NOT FOUND OR v_record.record_id IS NULL THEN
    RAISE EXCEPTION 'fixture_automatic_accept_returned_no_row';
  END IF;

  v_recomputed_hash := encode(
    pg_catalog.sha256(
      convert_to(
        public.regional_recommendation_hold_canonical_payload(v_record)::text,
        'UTF8'
      )
    ),
    'hex'
  );

  IF v_record.version IS DISTINCT FROM 1
     OR v_record.transition IS DISTINCT FROM 'activation'
     OR v_record.status IS DISTINCT FROM 'active'
     OR v_record.scope_beach_ids
       IS DISTINCT FROM ARRAY[pg_temp.fixture_uuid('b201')]::uuid[]
     OR cardinality(v_record.region_keys) IS DISTINCT FROM 0
     OR cardinality(v_record.scope_exposure_classes) IS DISTINCT FROM 0
     OR cardinality(v_record.protected_alternative_beach_ids)
       IS DISTINCT FROM 0
     OR v_record.event_reference
       IS DISTINCT FROM (
         'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
       )
     OR v_record.valid_from IS DISTINCT FROM v_expected_from
     OR v_record.valid_until IS DISTINCT FROM v_expected_until
     OR v_record.affected_cohorts
       IS DISTINCT FROM ARRAY['beginner','intermediate','unknown']::text[]
     OR v_record.action IS DISTINCT FROM 'suppress_positive'
     OR v_record.trigger_type IS DISTINCT FROM 'automatic_official'
     OR v_record.supporting_evidence_refs
       IS DISTINCT FROM jsonb_build_array(
         'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
       )
     OR v_record.automatic_policy_version
       IS DISTINCT FROM 'official-rip-high.v1'
     OR v_record.authorizing_operator_ref IS NOT NULL
     OR v_record.authorizing_actor IS DISTINCT FROM 'official_automation'
     OR v_record.reason_code IS DISTINCT FROM 'official_high_rip_current'
     OR v_record.effective_at IS DISTINCT FROM GREATEST(
       transaction_timestamp(),
       v_expected_from
     )
     OR v_record.expires_at IS DISTINCT FROM v_expected_until
     OR v_record.payload_hash IS DISTINCT FROM v_recomputed_hash THEN
    RAISE EXCEPTION 'fixture_automatic_normalized_tuple_mismatch record=%',
      to_jsonb(v_record);
  END IF;

  SELECT *
  INTO v_retry
  FROM public.append_regional_recommendation_hold_transition(
    pg_temp.automatic_hold_payload(
      pg_temp.fixture_uuid('d230'),
      'fixture:automatic_accept',
      'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
    )
  );

  IF NOT FOUND OR v_retry.record_id IS NULL THEN
    RAISE EXCEPTION
      'fixture_automatic_idempotent_retry_returned_no_row';
  END IF;

  IF v_retry.record_id IS DISTINCT FROM v_record.record_id
     OR v_retry.payload_hash IS DISTINCT FROM v_record.payload_hash THEN
    RAISE EXCEPTION
      'fixture_automatic_idempotent_retry_changed_record first=% retry=%',
      v_record.record_id,
      v_retry.record_id;
  END IF;
END;
$$;

-- A fresh official alert is independently eligible and retries to the same
-- normalized record, just like a fresh SRF row.
DO $$
DECLARE
  v_record public.regional_recommendation_holds%ROWTYPE;
  v_retry public.regional_recommendation_holds%ROWTYPE;
  v_local_date date := (
    transaction_timestamp() AT TIME ZONE 'America/Los_Angeles'
  )::date;
  v_expected_from timestamptz;
  v_expected_until timestamptz;
BEGIN
  v_expected_from := v_local_date::timestamp
    AT TIME ZONE 'America/Los_Angeles';
  v_expected_until := (v_local_date + 1)::timestamp
    AT TIME ZONE 'America/Los_Angeles';

  SELECT *
  INTO v_record
  FROM public.append_regional_recommendation_hold_transition(
    pg_temp.automatic_hold_payload(
      pg_temp.fixture_uuid('d249'),
      'fixture:automatic_alert_accept',
      'official:rip_current_risks:' || pg_temp.fixture_uuid('c210')::text
    )
  );

  IF NOT FOUND
     OR v_record.record_id IS NULL
     OR v_record.scope_beach_ids
       IS DISTINCT FROM ARRAY[pg_temp.fixture_uuid('b210')]::uuid[]
     OR v_record.event_reference
       IS DISTINCT FROM (
         'official:rip_current_risks:' || pg_temp.fixture_uuid('c210')::text
       )
     OR v_record.valid_from IS DISTINCT FROM v_expected_from
     OR v_record.valid_until IS DISTINCT FROM v_expected_until
     OR v_record.action IS DISTINCT FROM 'suppress_positive'
     OR v_record.trigger_type IS DISTINCT FROM 'automatic_official'
     OR v_record.automatic_policy_version
       IS DISTINCT FROM 'official-rip-high.v1'
     OR v_record.authorizing_operator_ref IS NOT NULL
     OR v_record.authorizing_actor IS DISTINCT FROM 'official_automation'
     OR v_record.reason_code IS DISTINCT FROM 'official_high_rip_current' THEN
    RAISE EXCEPTION 'fixture_automatic_alert_not_normalized record=%',
      to_jsonb(v_record);
  END IF;

  SELECT *
  INTO v_retry
  FROM public.append_regional_recommendation_hold_transition(
    pg_temp.automatic_hold_payload(
      pg_temp.fixture_uuid('d249'),
      'fixture:automatic_alert_accept',
      'official:rip_current_risks:' || pg_temp.fixture_uuid('c210')::text
    )
  );

  IF NOT FOUND
     OR v_retry.record_id IS DISTINCT FROM v_record.record_id
     OR v_retry.payload_hash IS DISTINCT FROM v_record.payload_hash THEN
    RAISE EXCEPTION
      'fixture_automatic_alert_idempotent_retry_changed_record first=% retry=%',
      v_record.record_id,
      v_retry.record_id;
  END IF;
END;
$$;

SELECT pg_temp.expect_hold_error(
  'automatic_retry_without_request_id_not_rejected',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d230'),
    'fixture:automatic_accept',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) - 'requestId',
  '23505',
  'hold idempotency collision'
);

DO $$
DECLARE
  v_record public.regional_recommendation_holds%ROWTYPE;
  v_retry public.regional_recommendation_holds%ROWTYPE;
  v_payload jsonb := pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d247'),
    'fixture:automatic_without_request_id',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) - 'requestId';
BEGIN
  SELECT * INTO v_record
  FROM public.append_regional_recommendation_hold_transition(v_payload);

  IF NOT FOUND OR v_record.record_id IS NULL THEN
    RAISE EXCEPTION
      'fixture_automatic_without_request_id_returned_no_row';
  END IF;

  SELECT * INTO v_retry
  FROM public.append_regional_recommendation_hold_transition(v_payload);

  IF NOT FOUND OR v_retry.record_id IS NULL THEN
    RAISE EXCEPTION
      'fixture_automatic_without_request_id_retry_returned_no_row';
  END IF;

  IF v_record.request_id IS NOT NULL
     OR v_retry.record_id IS DISTINCT FROM v_record.record_id
     OR v_retry.payload_hash IS DISTINCT FROM v_record.payload_hash THEN
    RAISE EXCEPTION
      'fixture_automatic_retry_without_request_id_changed_record first=% retry=%',
      v_record.record_id,
      v_retry.record_id;
  END IF;

  PERFORM pg_temp.expect_hold_error(
    'automatic_retry_added_request_id_not_rejected',
    pg_temp.automatic_hold_payload(
      pg_temp.fixture_uuid('d247'),
      'fixture:automatic_without_request_id',
      'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
    ),
    '23505',
    'hold idempotency collision'
  );
END;
$$;

SELECT pg_temp.expect_hold_error(
  'automatic_invalid_time_field',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d248'),
    'fixture:automatic_invalid_time_field',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('validFrom', 'not-a-timestamp'),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_nonexistent_reference',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d231'),
    'fixture:automatic_nonexistent',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c2ff')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_qa_reference',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d232'),
    'fixture:automatic_qa',
    'qa:artifact:forecaster_page_fixture'
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_derived_source',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d233'),
    'fixture:automatic_derived',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c202')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_moderate_risk',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d234'),
    'fixture:automatic_moderate',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c203')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_stale_fetch',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d235'),
    'fixture:automatic_stale',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c204')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_future_fetch',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d236'),
    'fixture:automatic_future_fetch',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c205')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_past_local_date',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d237'),
    'fixture:automatic_past_date',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c206')::text
  ),
  '22023',
  'automatic official reference date is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_future_local_date',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d238'),
    'fixture:automatic_future_date',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c207')::text
  ),
  '22023',
  'automatic official reference date is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_missing_timezone',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d239'),
    'fixture:automatic_missing_timezone',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c208')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_invalid_timezone',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d23a'),
    'fixture:automatic_invalid_timezone',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c209')::text
  ),
  '22023',
  'automatic official reference is not eligible'
);

SELECT pg_temp.expect_hold_error(
  'automatic_mismatched_beach',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d23b'),
    'fixture:automatic_mismatched_beach',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object(
    'scopeBeachIds',
    jsonb_build_array(pg_temp.fixture_uuid('b202')::uuid)
  ),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_action',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d23c'),
    'fixture:automatic_altered_action',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('action', 'protected_alternatives_only'),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_cohorts',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d23d'),
    'fixture:automatic_altered_cohorts',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object(
    'affectedCohorts',
    jsonb_build_array('advanced')
  ),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_policy',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d23e'),
    'fixture:automatic_altered_policy',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('automaticPolicyVersion', 'unapproved.v2'),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_author',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d23f'),
    'fixture:automatic_altered_author',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('authorizingActor', 'admin_api'),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_reason',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d240'),
    'fixture:automatic_altered_reason',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('reasonCode', 'scope_correction'),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_validity',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d241'),
    'fixture:automatic_altered_validity',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object(
    'validFrom',
    transaction_timestamp() - interval '10 days'
  ),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_effectiveness',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d242'),
    'fixture:automatic_altered_effectiveness',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object(
    'effectiveAt',
    transaction_timestamp() + interval '1 hour'
  ),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_altered_expiry',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d243'),
    'fixture:automatic_altered_expiry',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object(
    'expiresAt',
    transaction_timestamp() + interval '6 days'
  ),
  '22023',
  'automatic field conflicts with official evidence'
);

SELECT pg_temp.expect_hold_error(
  'automatic_extension',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d244'),
    'fixture:automatic_extension',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('transition', 'extension'),
  '22023',
  'require one activation reference'
);

SELECT pg_temp.expect_hold_error(
  'automatic_replacement',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d245'),
    'fixture:automatic_replacement',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('transition', 'replacement'),
  '22023',
  'require one activation reference'
);

SELECT pg_temp.expect_hold_error(
  'automatic_cancellation',
  pg_temp.automatic_hold_payload(
    pg_temp.fixture_uuid('d246'),
    'fixture:automatic_cancellation',
    'official:rip_current_risks:' || pg_temp.fixture_uuid('c201')::text
  ) || jsonb_build_object('transition', 'cancellation'),
  '22023',
  'require one activation reference'
);

CREATE OR REPLACE FUNCTION pg_temp.insert_hold_fixture_row(
  p_record_id uuid,
  p_hold_id uuid,
  p_version integer,
  p_transition text,
  p_status text,
  p_effective_at timestamptz,
  p_expires_at timestamptz,
  p_supersedes_record_id uuid,
  p_idempotency_key text,
  p_hash_character text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.regional_recommendation_holds (
    record_id,
    hold_id,
    version,
    transition,
    status,
    scope_beach_ids,
    valid_from,
    valid_until,
    affected_cohorts,
    action,
    trigger_type,
    authorizing_operator_ref,
    authorizing_actor,
    reason_code,
    effective_at,
    expires_at,
    supersedes_record_id,
    idempotency_key,
    payload_hash
  )
  VALUES (
    p_record_id,
    p_hold_id,
    p_version,
    p_transition,
    p_status,
    ARRAY[pg_temp.fixture_uuid('b201')]::uuid[],
    p_effective_at,
    p_expires_at,
    ARRAY['beginner','intermediate','unknown']::text[],
    'suppress_positive',
    'manual_operator',
    pg_temp.fixture_uuid('e300'),
    'admin_api',
    CASE
      WHEN p_transition = 'cancellation' THEN 'operator_cancelled'
      ELSE 'major_swell_manual_safety'
    END,
    p_effective_at,
    p_expires_at,
    p_supersedes_record_id,
    p_idempotency_key,
    repeat(p_hash_character, 64)
  );
END;
$$;

-- One two-row terminal chain is wholly older than 13 months.
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a301'),
  pg_temp.fixture_uuid('d301'),
  1,
  'activation',
  'active',
  transaction_timestamp() - interval '15 months',
  transaction_timestamp() - interval '15 months' + interval '1 day',
  NULL,
  'fixture:retention_old_activation',
  '3'
);
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a302'),
  pg_temp.fixture_uuid('d301'),
  2,
  'cancellation',
  'cancelled',
  transaction_timestamp() - interval '14 months 20 days',
  transaction_timestamp() - interval '14 months 19 days',
  pg_temp.fixture_uuid('a301'),
  'fixture:retention_old_cancellation',
  '4'
);

-- A terminal chain younger than 13 months must remain intact.
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a303'),
  pg_temp.fixture_uuid('d302'),
  1,
  'activation',
  'active',
  transaction_timestamp() - interval '12 months 5 days',
  transaction_timestamp() - interval '12 months 4 days',
  NULL,
  'fixture:retention_young_activation',
  '5'
);
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a304'),
  pg_temp.fixture_uuid('d302'),
  2,
  'cancellation',
  'cancelled',
  transaction_timestamp() - interval '12 months 2 days',
  transaction_timestamp() - interval '12 months 1 day',
  pg_temp.fixture_uuid('a303'),
  'fixture:retention_young_cancellation',
  '6'
);

-- A currently active chain must remain regardless of age policy.
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a305'),
  pg_temp.fixture_uuid('d303'),
  1,
  'activation',
  'active',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '1 day',
  NULL,
  'fixture:retention_active',
  '7'
);

-- A mixed-age terminal chain is retained until every version crosses the
-- retention boundary.
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a306'),
  pg_temp.fixture_uuid('d304'),
  1,
  'activation',
  'active',
  transaction_timestamp() - interval '15 months',
  transaction_timestamp() - interval '15 months' + interval '1 day',
  NULL,
  'fixture:retention_mixed_old_activation',
  '8'
);
SELECT pg_temp.insert_hold_fixture_row(
  pg_temp.fixture_uuid('a307'),
  pg_temp.fixture_uuid('d304'),
  2,
  'cancellation',
  'cancelled',
  transaction_timestamp() - interval '12 months 2 days',
  transaction_timestamp() - interval '12 months 1 day',
  pg_temp.fixture_uuid('a306'),
  'fixture:retention_mixed_young_cancellation',
  '9'
);

DO $$
DECLARE
  v_result record;
  v_old_rows integer;
  v_young_rows integer;
  v_active_rows integer;
  v_mixed_rows integer;
BEGIN
  SELECT *
  INTO v_result
  FROM public.purge_expired_regional_recommendation_holds_v1();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fixture_retention_purge_returned_no_row';
  END IF;

  IF v_result.chains_deleted IS DISTINCT FROM 1
     OR v_result.rows_deleted IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION
      'fixture_retention_wrong_counts chains=% rows=%',
      v_result.chains_deleted,
      v_result.rows_deleted;
  END IF;

  SELECT count(*) INTO v_old_rows
  FROM public.regional_recommendation_holds
  WHERE hold_id = pg_temp.fixture_uuid('d301');

  SELECT count(*) INTO v_young_rows
  FROM public.regional_recommendation_holds
  WHERE hold_id = pg_temp.fixture_uuid('d302');

  SELECT count(*) INTO v_active_rows
  FROM public.regional_recommendation_holds
  WHERE hold_id = pg_temp.fixture_uuid('d303');

  SELECT count(*) INTO v_mixed_rows
  FROM public.regional_recommendation_holds
  WHERE hold_id = pg_temp.fixture_uuid('d304');

  IF v_old_rows <> 0 THEN
    RAISE EXCEPTION 'fixture_retention_old_chain_partially_retained rows=%',
      v_old_rows;
  END IF;
  IF v_young_rows <> 2 THEN
    RAISE EXCEPTION 'fixture_retention_young_chain_deleted rows=%',
      v_young_rows;
  END IF;
  IF v_active_rows <> 1 THEN
    RAISE EXCEPTION 'fixture_retention_active_chain_deleted rows=%',
      v_active_rows;
  END IF;
  IF v_mixed_rows <> 2 THEN
    RAISE EXCEPTION 'fixture_retention_mixed_age_chain_deleted rows=%',
      v_mixed_rows;
  END IF;
END;
$$;

-- Ordinary account erasure removes only the identity mapping. The fixture
-- then performs the edge function's far-future ban step to model the full
-- account-deletion flow while retaining the auth row.
DO $$
DECLARE
  v_policy public.regional_recommendation_holds%ROWTYPE;
  v_auth_count integer;
  v_mapping_count integer;
  v_policy_count integer;
  v_banned_until timestamptz;
BEGIN
  SELECT *
  INTO v_policy
  FROM public.append_regional_recommendation_hold_transition(
    pg_temp.manual_hold_payload(
      pg_temp.fixture_uuid('d401'),
      'fixture:operator_erasure_policy',
      pg_temp.fixture_uuid('f202'),
      pg_temp.fixture_uuid('b201'),
      '["qa:artifact:operator_erasure_fixture"]'::jsonb
    )
  );

  IF v_policy.authorizing_operator_ref IS NULL
     OR position(
       pg_temp.fixture_uuid('f202')::text
       IN to_jsonb(v_policy)::text
     ) > 0 THEN
    RAISE EXCEPTION
      'fixture_operator_identity_leaked_into_policy_before_erasure policy=%',
      to_jsonb(v_policy);
  END IF;

  PERFORM public.delete_user_account(
    pg_temp.fixture_uuid('f202')
  );

  PERFORM pg_temp.expect_hold_error(
    'post_erasure_operator_append_not_rejected',
    pg_temp.manual_hold_payload(
      pg_temp.fixture_uuid('d402'),
      'fixture:post_erasure_operator_append',
      pg_temp.fixture_uuid('f202'),
      pg_temp.fixture_uuid('b201'),
      '["qa:artifact:post_erasure_fixture"]'::jsonb
    ),
    '22023',
    'manual transition operator is unavailable'
  );

  UPDATE auth.users
  SET banned_until = transaction_timestamp() + interval '100 years'
  WHERE id = pg_temp.fixture_uuid('f202');

  SELECT count(*), max(banned_until)
  INTO v_auth_count, v_banned_until
  FROM auth.users
  WHERE id = pg_temp.fixture_uuid('f202');

  SELECT count(*)
  INTO v_mapping_count
  FROM public.regional_recommendation_hold_operator_refs
  WHERE operator_user_id = pg_temp.fixture_uuid('f202')
     OR operator_ref = v_policy.authorizing_operator_ref;

  SELECT count(*)
  INTO v_policy_count
  FROM public.regional_recommendation_holds AS policy
  WHERE policy.record_id = v_policy.record_id
    AND policy.authorizing_operator_ref = v_policy.authorizing_operator_ref
    AND position(
      pg_temp.fixture_uuid('f202')::text
      IN to_jsonb(policy)::text
    ) = 0;

  IF v_auth_count <> 1
     OR v_banned_until IS NULL
     OR v_banned_until <= transaction_timestamp() THEN
    RAISE EXCEPTION
      'fixture_operator_auth_row_not_retained_and_banned count=% banned_until=%',
      v_auth_count,
      v_banned_until;
  END IF;
  IF v_mapping_count <> 0 THEN
    RAISE EXCEPTION 'fixture_operator_mapping_not_erased count=%',
      v_mapping_count;
  END IF;
  IF v_policy_count <> 1 THEN
    RAISE EXCEPTION 'fixture_operator_policy_history_missing_or_linked count=%',
      v_policy_count;
  END IF;
END;
$$;

-- A later hard auth deletion is a backup erasure path through ON DELETE
-- CASCADE and must not touch anonymous policy history.
INSERT INTO public.regional_recommendation_hold_operator_refs (
  operator_ref,
  operator_user_id
)
VALUES (
  pg_temp.fixture_uuid('e403'),
  pg_temp.fixture_uuid('f203')
);

DO $$
DECLARE
  v_policy public.regional_recommendation_holds%ROWTYPE;
  v_mapping_count integer;
  v_policy_count integer;
BEGIN
  SELECT *
  INTO v_policy
  FROM public.append_regional_recommendation_hold_transition(
    pg_temp.manual_hold_payload(
      pg_temp.fixture_uuid('d403'),
      'fixture:hard_delete_operator_policy',
      pg_temp.fixture_uuid('f203'),
      pg_temp.fixture_uuid('b201'),
      '["qa:artifact:hard_delete_fixture"]'::jsonb
    )
  );

  IF NOT FOUND
     OR v_policy.record_id IS NULL
     OR v_policy.authorizing_operator_ref
       IS DISTINCT FROM pg_temp.fixture_uuid('e403')
     OR position(
       pg_temp.fixture_uuid('f203')::text
       IN to_jsonb(v_policy)::text
     ) > 0 THEN
    RAISE EXCEPTION
      'fixture_hard_delete_policy_not_created_or_identity_leaked policy=%',
      to_jsonb(v_policy);
  END IF;

  DELETE FROM auth.users
  WHERE id = pg_temp.fixture_uuid('f203');

  SELECT count(*)
  INTO v_mapping_count
  FROM public.regional_recommendation_hold_operator_refs
  WHERE operator_ref = pg_temp.fixture_uuid('e403');

  SELECT count(*)
  INTO v_policy_count
  FROM public.regional_recommendation_holds AS policy
  WHERE policy.record_id = v_policy.record_id
    AND policy.authorizing_operator_ref = pg_temp.fixture_uuid('e403')
    AND position(
      pg_temp.fixture_uuid('f203')::text
      IN to_jsonb(policy)::text
    ) = 0;

  IF v_mapping_count <> 0 THEN
    RAISE EXCEPTION 'fixture_hard_delete_operator_mapping_not_cascaded count=%',
      v_mapping_count;
  END IF;
  IF v_policy_count <> 1 THEN
    RAISE EXCEPTION
      'fixture_hard_delete_policy_history_missing_or_linked count=%',
      v_policy_count;
  END IF;
END;
$$;

ROLLBACK;
