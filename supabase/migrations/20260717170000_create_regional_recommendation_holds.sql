BEGIN;

-- P0-A safety policy history. This migration is additive; operational rollback
-- appends cancellations and disables evaluation rather than deleting history.
-- Expected volume is low: one row per audited transition, not per forecast.

CREATE OR REPLACE FUNCTION public.regional_recommendation_hold_refs_are_safe(
  p_refs jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_ref text;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF p_refs IS NULL THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(p_refs) <> 'array' THEN
    RETURN false;
  END IF;

  IF jsonb_array_length(p_refs) > 16 THEN
    RETURN false;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_refs) AS refs(value)
  LOOP
    IF jsonb_typeof(v_item) <> 'string' THEN
      RETURN false;
    END IF;

    v_ref := v_item #>> '{}';
    IF char_length(v_ref) NOT BETWEEN 1 AND 128
       OR v_ref !~ '^(official:rip_current_risks:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|qa:artifact:[A-Za-z0-9_-]{1,64})$'
       OR v_ref = ANY(v_seen) THEN
      RETURN false;
    END IF;

    v_seen := array_append(v_seen, v_ref);
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.regional_recommendation_hold_region_keys_are_safe(
  p_region_keys text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF p_region_keys IS NULL OR cardinality(p_region_keys) > 64 THEN
    RETURN false;
  END IF;

  FOREACH v_key IN ARRAY p_region_keys
  LOOP
    IF v_key IS NULL
       OR v_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
       OR v_key = ANY(v_seen) THEN
      RETURN false;
    END IF;

    v_seen := array_append(v_seen, v_key);
  END LOOP;

  RETURN true;
END;
$$;

CREATE TABLE public.regional_recommendation_hold_operator_refs (
  operator_ref uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (operator_ref <> operator_user_id)
);

CREATE TABLE public.regional_recommendation_holds (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  transition text NOT NULL CHECK (
    transition IN ('activation','extension','replacement','cancellation')
  ),
  status text NOT NULL CHECK (status IN ('active','cancelled')),
  region_keys text[] NOT NULL DEFAULT '{}' CHECK (
    public.regional_recommendation_hold_region_keys_are_safe(region_keys)
  ),
  scope_beach_ids uuid[] NOT NULL CHECK (
    cardinality(scope_beach_ids) BETWEEN 1 AND 2000
  ),
  scope_exposure_classes text[] NOT NULL DEFAULT '{}' CHECK (
    scope_exposure_classes <@ ARRAY[
      'fully_exposed','partially_protected','protected','unknown'
    ]::text[]
  ),
  protected_alternative_beach_ids uuid[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(protected_alternative_beach_ids) <= 2000
  ),
  event_reference text CHECK (
    event_reference IS NULL
    OR event_reference ~ '^(event|official|qa):[a-z0-9_]+:[A-Za-z0-9_-]{1,64}$'
  ),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > valid_from),
  affected_cohorts text[] NOT NULL CHECK (
    cardinality(affected_cohorts) > 0
    AND affected_cohorts <@ ARRAY[
      'beginner','intermediate','advanced','expert','unknown'
    ]::text[]
  ),
  action text NOT NULL CHECK (
    action IN ('suppress_positive','protected_alternatives_only')
  ),
  trigger_type text NOT NULL CHECK (
    trigger_type IN ('automatic_official','manual_operator')
  ),
  supporting_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(supporting_evidence_refs) = 'array'
    AND public.regional_recommendation_hold_refs_are_safe(supporting_evidence_refs)
  ),
  automatic_policy_version text CHECK (
    automatic_policy_version IS NULL
    OR automatic_policy_version ~ '^[a-z0-9._-]{1,64}$'
  ),
  authorizing_operator_ref uuid,
  authorizing_actor text NOT NULL CHECK (
    authorizing_actor IN ('admin_api','official_automation')
  ),
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'major_swell_manual_safety',
      'official_high_rip_current',
      'scope_correction',
      'event_expired',
      'operator_cancelled',
      'policy_rollback'
    )
  ),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (
    expires_at > effective_at
    AND expires_at <= effective_at + interval '7 days'
  ),
  supersedes_record_id uuid
    REFERENCES public.regional_recommendation_holds(record_id),
  idempotency_key text NOT NULL UNIQUE CHECK (
    idempotency_key ~ '^[A-Za-z0-9:_-]{1,160}$'
  ),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  request_id text CHECK (
    request_id IS NULL OR request_id ~ '^[A-Za-z0-9:_-]{1,96}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hold_id, version),
  UNIQUE (supersedes_record_id),
  CHECK (
    (transition='activation' AND version=1 AND supersedes_record_id IS NULL)
    OR
    (transition<>'activation' AND version>1 AND supersedes_record_id IS NOT NULL)
  ),
  CHECK (
    (transition='cancellation' AND status='cancelled')
    OR
    (transition<>'cancellation' AND status='active')
  ),
  CHECK (
    (trigger_type='manual_operator'
      AND authorizing_operator_ref IS NOT NULL
      AND automatic_policy_version IS NULL)
    OR
    (trigger_type='automatic_official'
      AND authorizing_operator_ref IS NULL
      AND automatic_policy_version IS NOT NULL
      AND jsonb_array_length(supporting_evidence_refs) > 0)
  ),
  CHECK (
    action<>'protected_alternatives_only'
    OR cardinality(protected_alternative_beach_ids)>0
  ),
  CHECK (
    trigger_type<>'automatic_official'
    OR (
      transition='activation'
      AND action='suppress_positive'
      AND affected_cohorts=ARRAY['beginner','intermediate','unknown']::text[]
      AND cardinality(scope_beach_ids)=1
      AND cardinality(region_keys)=0
      AND cardinality(scope_exposure_classes)=0
      AND cardinality(protected_alternative_beach_ids)=0
      AND automatic_policy_version='official-rip-high.v1'
      AND authorizing_actor='official_automation'
      AND reason_code='official_high_rip_current'
      AND jsonb_array_length(supporting_evidence_refs)=1
    )
  )
);

CREATE INDEX regional_recommendation_holds_beaches_gin_idx
  ON public.regional_recommendation_holds USING gin (scope_beach_ids);
CREATE INDEX regional_recommendation_holds_regions_gin_idx
  ON public.regional_recommendation_holds USING gin (region_keys);
CREATE INDEX regional_recommendation_holds_cohorts_gin_idx
  ON public.regional_recommendation_holds USING gin (affected_cohorts);
CREATE INDEX regional_recommendation_holds_window_idx
  ON public.regional_recommendation_holds (valid_from, valid_until);
CREATE INDEX regional_recommendation_holds_effective_idx
  ON public.regional_recommendation_holds (effective_at, expires_at);
CREATE INDEX regional_recommendation_holds_latest_idx
  ON public.regional_recommendation_holds (hold_id, version DESC);

ALTER TABLE public.regional_recommendation_hold_operator_refs
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_recommendation_holds
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reject_regional_recommendation_hold_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting(
       'app.regional_recommendation_hold_retention_purge',
       true
     ) = 'on'
     AND current_user = pg_get_userbyid((
       SELECT table_class.relowner
       FROM pg_catalog.pg_class AS table_class
       WHERE table_class.oid = TG_RELID
     )) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'regional recommendation hold history is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER regional_recommendation_holds_append_only
  BEFORE UPDATE OR DELETE ON public.regional_recommendation_holds
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_regional_recommendation_hold_mutation();

CREATE OR REPLACE FUNCTION public.regional_recommendation_hold_canonical_payload(
  p_row public.regional_recommendation_holds
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'hold_id', p_row.hold_id,
    'version', p_row.version,
    'transition', p_row.transition,
    'status', p_row.status,
    'region_keys', to_jsonb(p_row.region_keys),
    'scope_beach_ids', to_jsonb(p_row.scope_beach_ids),
    'scope_exposure_classes', to_jsonb(p_row.scope_exposure_classes),
    'protected_alternative_beach_ids',
      to_jsonb(p_row.protected_alternative_beach_ids),
    'event_reference', p_row.event_reference,
    'valid_from', to_char(
      p_row.valid_from AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'valid_until', to_char(
      p_row.valid_until AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'affected_cohorts', to_jsonb(p_row.affected_cohorts),
    'action', p_row.action,
    'trigger_type', p_row.trigger_type,
    'supporting_evidence_refs', p_row.supporting_evidence_refs,
    'automatic_policy_version', p_row.automatic_policy_version,
    'authorizing_operator_ref', p_row.authorizing_operator_ref,
    'authorizing_actor', p_row.authorizing_actor,
    'reason_code', p_row.reason_code,
    'effective_at', to_char(
      p_row.effective_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'expires_at', to_char(
      p_row.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'supersedes_record_id', p_row.supersedes_record_id,
    'idempotency_key', p_row.idempotency_key,
    'request_id', p_row.request_id
  );
$$;

CREATE OR REPLACE FUNCTION public.append_regional_recommendation_hold_transition(
  p_transition jsonb
)
RETURNS SETOF public.regional_recommendation_holds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := transaction_timestamp();
  v_hold_id uuid;
  v_hold_id_text text;
  v_transition text;
  v_status text;
  v_trigger_type text;
  v_version integer;
  v_supersedes_record_id uuid;
  v_region_keys text[] := ARRAY[]::text[];
  v_scope_beach_ids uuid[] := ARRAY[]::uuid[];
  v_scope_exposure_classes text[] := ARRAY[]::text[];
  v_protected_alternative_beach_ids uuid[] := ARRAY[]::uuid[];
  v_event_reference text;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
  v_affected_cohorts text[] := ARRAY[]::text[];
  v_action text;
  v_supporting_evidence_refs jsonb;
  v_automatic_policy_version text;
  v_authorizing_operator_ref uuid;
  v_authorizing_actor text;
  v_reason_code text;
  v_effective_at timestamptz;
  v_expires_at timestamptz;
  v_idempotency_key text;
  v_request_id text;
  v_operator_user_id uuid;
  v_operator_user_id_text text;
  v_operator_free_transition_text text;
  v_official_ref text;
  v_official_id uuid;
  v_risk_beach_id uuid;
  v_risk_valid_date date;
  v_risk_level text;
  v_risk_source text;
  v_risk_fetched_at timestamptz;
  v_beach_timezone text;
  v_local_today date;
  v_input_valid_from timestamptz;
  v_input_valid_until timestamptz;
  v_input_effective_at timestamptz;
  v_input_expires_at timestamptz;
  v_payload jsonb;
  v_payload_hash text;
  v_expected_input jsonb;
  v_key text;
  v_existing public.regional_recommendation_holds%ROWTYPE;
  v_previous public.regional_recommendation_holds%ROWTYPE;
  v_new public.regional_recommendation_holds%ROWTYPE;
BEGIN
  IF p_transition IS NULL OR jsonb_typeof(p_transition) <> 'object' THEN
    RAISE EXCEPTION 'hold transition must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_transition) AS supplied(key)
    WHERE supplied.key <> ALL (ARRAY[
      'holdId',
      'version',
      'transition',
      'regionKeys',
      'scopeBeachIds',
      'scopeExposureClasses',
      'protectedAlternativeBeachIds',
      'eventReference',
      'validFrom',
      'validUntil',
      'affectedCohorts',
      'action',
      'triggerType',
      'supportingEvidenceRefs',
      'automaticPolicyVersion',
      'operatorUserId',
      'authorizingActor',
      'reasonCode',
      'effectiveAt',
      'expiresAt',
      'supersedesRecordId',
      'idempotencyKey',
      'requestId'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'hold transition contains an unsupported field'
      USING ERRCODE = '22023';
  END IF;

  v_hold_id_text := p_transition ->> 'holdId';
  IF v_hold_id_text IS NULL
     OR v_hold_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invalid hold id' USING ERRCODE = '22023';
  END IF;
  v_hold_id := v_hold_id_text::uuid;

  v_transition := p_transition ->> 'transition';
  IF v_transition IS NULL
     OR v_transition NOT IN (
       'activation','extension','replacement','cancellation'
     ) THEN
    RAISE EXCEPTION 'invalid hold transition' USING ERRCODE = '22023';
  END IF;

  v_trigger_type := p_transition ->> 'triggerType';
  IF v_trigger_type IS NULL
     OR v_trigger_type NOT IN ('automatic_official','manual_operator') THEN
    RAISE EXCEPTION 'invalid hold trigger type' USING ERRCODE = '22023';
  END IF;

  v_idempotency_key := p_transition ->> 'idempotencyKey';
  IF v_idempotency_key IS NULL
     OR v_idempotency_key !~ '^[A-Za-z0-9:_-]{1,160}$' THEN
    RAISE EXCEPTION 'invalid idempotency key' USING ERRCODE = '22023';
  END IF;

  v_request_id := p_transition ->> 'requestId';
  IF v_request_id IS NOT NULL
     AND v_request_id !~ '^[A-Za-z0-9:_-]{1,96}$' THEN
    RAISE EXCEPTION 'invalid request id' USING ERRCODE = '22023';
  END IF;

  v_supporting_evidence_refs := COALESCE(
    p_transition -> 'supportingEvidenceRefs',
    '[]'::jsonb
  );
  IF NOT public.regional_recommendation_hold_refs_are_safe(
    v_supporting_evidence_refs
  ) THEN
    RAISE EXCEPTION 'invalid supporting evidence references'
      USING ERRCODE = '22023';
  END IF;

  -- The idempotency-key lock is acquired before the hold lock everywhere.
  -- That fixed order prevents cross-hold retries from deadlocking.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('regional-hold-idempotency:' || v_idempotency_key, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('regional-hold:' || v_hold_id::text, 0)
  );

  SELECT *
  INTO v_existing
  FROM public.regional_recommendation_holds
  WHERE idempotency_key = v_idempotency_key;

  IF v_trigger_type = 'automatic_official' THEN
    IF v_transition <> 'activation'
       OR jsonb_array_length(v_supporting_evidence_refs) <> 1 THEN
      RAISE EXCEPTION 'automatic official holds require one activation reference'
        USING ERRCODE = '22023';
    END IF;

    v_official_ref := v_supporting_evidence_refs ->> 0;
    IF v_official_ref !~ '^official:rip_current_risks:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'automatic official reference is not eligible'
        USING ERRCODE = '22023';
    END IF;
    v_official_id := split_part(v_official_ref, ':', 3)::uuid;

    BEGIN
      IF p_transition ? 'validFrom' THEN
        v_input_valid_from := (p_transition ->> 'validFrom')::timestamptz;
      END IF;
      IF p_transition ? 'validUntil' THEN
        v_input_valid_until := (p_transition ->> 'validUntil')::timestamptz;
      END IF;
      IF p_transition ? 'effectiveAt' THEN
        v_input_effective_at := (p_transition ->> 'effectiveAt')::timestamptz;
      END IF;
      IF p_transition ? 'expiresAt' THEN
        v_input_expires_at := (p_transition ->> 'expiresAt')::timestamptz;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'automatic field conflicts with official evidence'
        USING ERRCODE = '22023';
    END;

    -- Exact retries return before clock-dependent normalization. Integrity is
    -- checked against the canonical stored tuple, not caller metadata.
    IF v_existing.record_id IS NOT NULL THEN
      v_new := v_existing;
      v_new.request_id := v_request_id;
      v_payload := public.regional_recommendation_hold_canonical_payload(
        v_new
      );
      v_payload_hash := encode(
        pg_catalog.sha256(convert_to(v_payload::text, 'UTF8')),
        'hex'
      );

      v_expected_input := jsonb_build_object(
        'holdId', v_existing.hold_id::text,
        'version', v_existing.version,
        'transition', v_existing.transition,
        'regionKeys', to_jsonb(v_existing.region_keys),
        'scopeBeachIds', to_jsonb(v_existing.scope_beach_ids),
        'scopeExposureClasses', to_jsonb(v_existing.scope_exposure_classes),
        'protectedAlternativeBeachIds',
          to_jsonb(v_existing.protected_alternative_beach_ids),
        'eventReference', v_existing.event_reference,
        'validFrom', v_existing.valid_from,
        'validUntil', v_existing.valid_until,
        'affectedCohorts', to_jsonb(v_existing.affected_cohorts),
        'action', v_existing.action,
        'triggerType', v_existing.trigger_type,
        'supportingEvidenceRefs', v_existing.supporting_evidence_refs,
        'automaticPolicyVersion', v_existing.automatic_policy_version,
        'authorizingActor', v_existing.authorizing_actor,
        'reasonCode', v_existing.reason_code,
        'effectiveAt', v_existing.effective_at,
        'expiresAt', v_existing.expires_at,
        'supersedesRecordId', v_existing.supersedes_record_id,
        'idempotencyKey', v_existing.idempotency_key,
        'requestId', v_existing.request_id
      );

      FOR v_key IN SELECT jsonb_object_keys(p_transition)
      LOOP
        IF v_key IN ('validFrom','validUntil','effectiveAt','expiresAt') THEN
          CONTINUE;
        END IF;

        IF (p_transition -> v_key) IS DISTINCT FROM (v_expected_input -> v_key) THEN
          RAISE EXCEPTION 'hold idempotency collision'
            USING ERRCODE = '23505';
        END IF;
      END LOOP;

      IF (p_transition ? 'validFrom'
          AND v_input_valid_from IS DISTINCT FROM v_existing.valid_from)
         OR (p_transition ? 'validUntil'
          AND v_input_valid_until IS DISTINCT FROM v_existing.valid_until)
         OR (p_transition ? 'effectiveAt'
          AND v_input_effective_at IS DISTINCT FROM v_existing.effective_at)
         OR (p_transition ? 'expiresAt'
          AND v_input_expires_at IS DISTINCT FROM v_existing.expires_at)
         OR v_request_id IS DISTINCT FROM v_existing.request_id
         OR v_existing.payload_hash <> v_payload_hash THEN
        RAISE EXCEPTION 'hold idempotency collision'
          USING ERRCODE = '23505';
      END IF;

      RETURN NEXT v_existing;
      RETURN;
    END IF;

    IF p_transition ? 'operatorUserId' THEN
      RAISE EXCEPTION 'automatic official holds cannot identify an operator'
        USING ERRCODE = '22023';
    END IF;

    SELECT
      r.beach_id,
      r.valid_date,
      r.risk_level,
      r.source,
      r.fetched_at,
      b.timezone
    INTO
      v_risk_beach_id,
      v_risk_valid_date,
      v_risk_level,
      v_risk_source,
      v_risk_fetched_at,
      v_beach_timezone
    FROM public.rip_current_risks AS r
    JOIN public.beaches AS b ON b.id = r.beach_id
    WHERE r.id = v_official_id
    FOR UPDATE OF r, b;

    IF NOT FOUND
       OR v_risk_level IS DISTINCT FROM 'high'
       OR (
         v_risk_source IS DISTINCT FROM 'srf'
         AND v_risk_source IS DISTINCT FROM 'alert'
       )
       OR v_risk_fetched_at IS NULL
       OR v_risk_fetched_at < transaction_timestamp() - interval '12 hours'
       OR v_risk_fetched_at > transaction_timestamp() + interval '5 minutes'
       OR v_beach_timezone IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM pg_catalog.pg_timezone_names AS zones
         WHERE zones.name = v_beach_timezone
       ) THEN
      RAISE EXCEPTION 'automatic official reference is not eligible'
        USING ERRCODE = '22023';
    END IF;

    v_local_today := (v_now AT TIME ZONE v_beach_timezone)::date;
    IF v_risk_valid_date IS NULL
       OR v_risk_valid_date < v_local_today
       OR v_risk_valid_date > v_local_today + 2 THEN
      RAISE EXCEPTION 'automatic official reference date is not eligible'
        USING ERRCODE = '22023';
    END IF;

    v_version := 1;
    v_status := 'active';
    v_region_keys := ARRAY[]::text[];
    v_scope_beach_ids := ARRAY[v_risk_beach_id];
    v_scope_exposure_classes := ARRAY[]::text[];
    v_protected_alternative_beach_ids := ARRAY[]::uuid[];
    v_event_reference := v_official_ref;
    v_valid_from := v_risk_valid_date::timestamp AT TIME ZONE v_beach_timezone;
    v_valid_until := (v_risk_valid_date + 1)::timestamp
      AT TIME ZONE v_beach_timezone;
    v_affected_cohorts := ARRAY[
      'beginner','intermediate','unknown'
    ]::text[];
    v_action := 'suppress_positive';
    v_automatic_policy_version := 'official-rip-high.v1';
    v_authorizing_operator_ref := NULL;
    v_authorizing_actor := 'official_automation';
    v_reason_code := 'official_high_rip_current';
    v_effective_at := GREATEST(v_now, v_valid_from);
    v_expires_at := v_valid_until;
    v_supersedes_record_id := NULL;

    v_expected_input := jsonb_build_object(
      'holdId', v_hold_id::text,
      'version', v_version,
      'transition', v_transition,
      'regionKeys', to_jsonb(v_region_keys),
      'scopeBeachIds', to_jsonb(v_scope_beach_ids),
      'scopeExposureClasses', to_jsonb(v_scope_exposure_classes),
      'protectedAlternativeBeachIds',
        to_jsonb(v_protected_alternative_beach_ids),
      'eventReference', v_event_reference,
      'validFrom', v_valid_from,
      'validUntil', v_valid_until,
      'affectedCohorts', to_jsonb(v_affected_cohorts),
      'action', v_action,
      'triggerType', v_trigger_type,
      'supportingEvidenceRefs', v_supporting_evidence_refs,
      'automaticPolicyVersion', v_automatic_policy_version,
      'authorizingActor', v_authorizing_actor,
      'reasonCode', v_reason_code,
      'effectiveAt', v_effective_at,
      'expiresAt', v_expires_at,
      'supersedesRecordId', v_supersedes_record_id,
      'idempotencyKey', v_idempotency_key,
      'requestId', v_request_id
    );

    FOR v_key IN SELECT jsonb_object_keys(p_transition)
    LOOP
      IF v_key IN ('validFrom','validUntil','effectiveAt','expiresAt') THEN
        CONTINUE;
      END IF;

      IF (p_transition -> v_key) IS DISTINCT FROM (v_expected_input -> v_key) THEN
        RAISE EXCEPTION 'automatic field conflicts with official evidence'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;

    IF (p_transition ? 'validFrom'
        AND v_input_valid_from IS DISTINCT FROM v_valid_from)
       OR (p_transition ? 'validUntil'
        AND v_input_valid_until IS DISTINCT FROM v_valid_until)
       OR (p_transition ? 'effectiveAt'
        AND v_input_effective_at IS DISTINCT FROM v_effective_at)
       OR (p_transition ? 'expiresAt'
        AND v_input_expires_at IS DISTINCT FROM v_expires_at) THEN
      RAISE EXCEPTION 'automatic field conflicts with official evidence'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF (p_transition ->> 'authorizingActor') IS NOT NULL
       AND (p_transition ->> 'authorizingActor') <> 'admin_api' THEN
      RAISE EXCEPTION 'manual transition author is invalid'
        USING ERRCODE = '22023';
    END IF;
    IF p_transition ? 'automaticPolicyVersion'
       AND p_transition -> 'automaticPolicyVersion' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'manual transition cannot set automatic policy'
        USING ERRCODE = '22023';
    END IF;

    v_operator_user_id_text := p_transition ->> 'operatorUserId';
    IF v_operator_user_id_text IS NULL
       OR v_operator_user_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'manual transition requires an operator'
        USING ERRCODE = '22023';
    END IF;
    v_operator_user_id := v_operator_user_id_text::uuid;

    -- The auth UUID is transient authorization input. Reject it anywhere in
    -- the remaining body so it cannot be stored or enter the payload hash.
    v_operator_free_transition_text := lower(
      (p_transition - 'operatorUserId')::text
    );
    IF position(
         lower(v_operator_user_id::text)
         IN v_operator_free_transition_text
       ) > 0
       OR position(
         replace(lower(v_operator_user_id::text), '-', '')
         IN replace(v_operator_free_transition_text, '-', '')
       ) > 0 THEN
      RAISE EXCEPTION 'manual transition metadata cannot identify operator'
        USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'regional-hold-operator:' || v_operator_user_id::text,
        0
      )
    );

    IF EXISTS (
      SELECT 1
      FROM public.account_deletions
      WHERE user_id = v_operator_user_id
    ) THEN
      RAISE EXCEPTION 'manual transition operator is unavailable'
        USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM auth.users AS operator_user
    JOIN public.profiles AS operator_profile
      ON operator_profile.id = operator_user.id
    WHERE operator_user.id = v_operator_user_id
      AND operator_profile.deleted_at IS NULL
      AND (
        operator_user.banned_until IS NULL
        OR operator_user.banned_until <= v_now
      )
    FOR KEY SHARE OF operator_user, operator_profile;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'manual transition operator is unavailable'
        USING ERRCODE = '22023';
    END IF;

    SELECT operator_ref
    INTO v_authorizing_operator_ref
    FROM public.regional_recommendation_hold_operator_refs
    WHERE operator_user_id = v_operator_user_id;

    IF v_authorizing_operator_ref IS NULL
       AND v_existing.record_id IS NOT NULL THEN
      RAISE EXCEPTION 'hold idempotency collision'
        USING ERRCODE = '23505';
    END IF;

    IF v_authorizing_operator_ref IS NULL THEN
      INSERT INTO public.regional_recommendation_hold_operator_refs (
        operator_user_id
      )
      VALUES (v_operator_user_id)
      ON CONFLICT (operator_user_id) DO NOTHING;

      SELECT operator_ref
      INTO v_authorizing_operator_ref
      FROM public.regional_recommendation_hold_operator_refs
      WHERE operator_user_id = v_operator_user_id;
    END IF;

    IF v_authorizing_operator_ref IS NOT DISTINCT FROM v_operator_user_id THEN
      RAISE EXCEPTION 'manual transition operator reference is unavailable'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_version := (p_transition ->> 'version')::integer;
      v_valid_from := (p_transition ->> 'validFrom')::timestamptz;
      v_valid_until := (p_transition ->> 'validUntil')::timestamptz;
      v_effective_at := (p_transition ->> 'effectiveAt')::timestamptz;
      v_expires_at := (p_transition ->> 'expiresAt')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'manual transition has invalid version or time fields'
        USING ERRCODE = '22023';
    END;

    IF v_version IS NULL
       OR v_valid_from IS NULL
       OR v_valid_until IS NULL
       OR v_effective_at IS NULL
       OR v_expires_at IS NULL
       OR v_valid_until <= v_valid_from
       OR v_expires_at <= v_effective_at
       OR v_expires_at > v_effective_at + interval '7 days' THEN
      RAISE EXCEPTION 'manual transition has invalid time bounds'
        USING ERRCODE = '22023';
    END IF;

    IF p_transition ->> 'supersedesRecordId' IS NOT NULL THEN
      IF (p_transition ->> 'supersedesRecordId')
           !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'invalid superseded record id'
          USING ERRCODE = '22023';
      END IF;
      v_supersedes_record_id := (
        p_transition ->> 'supersedesRecordId'
      )::uuid;
    END IF;

    IF jsonb_typeof(COALESCE(p_transition -> 'regionKeys', '[]'::jsonb))
         <> 'array'
       OR jsonb_typeof(p_transition -> 'scopeBeachIds') <> 'array'
       OR jsonb_typeof(
         COALESCE(p_transition -> 'scopeExposureClasses', '[]'::jsonb)
       ) <> 'array'
       OR jsonb_typeof(
         COALESCE(
           p_transition -> 'protectedAlternativeBeachIds',
           '[]'::jsonb
         )
       ) <> 'array'
       OR jsonb_typeof(p_transition -> 'affectedCohorts') <> 'array' THEN
      RAISE EXCEPTION 'manual transition has invalid array fields'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      SELECT COALESCE(
        array_agg(item.value ORDER BY item.ordinality),
        ARRAY[]::text[]
      )
      INTO v_region_keys
      FROM jsonb_array_elements_text(
        COALESCE(p_transition -> 'regionKeys', '[]'::jsonb)
      ) WITH ORDINALITY AS item(value, ordinality);

      SELECT COALESCE(
        array_agg(item.value::uuid ORDER BY item.ordinality),
        ARRAY[]::uuid[]
      )
      INTO v_scope_beach_ids
      FROM jsonb_array_elements_text(
        p_transition -> 'scopeBeachIds'
      ) WITH ORDINALITY AS item(value, ordinality);

      SELECT COALESCE(
        array_agg(item.value ORDER BY item.ordinality),
        ARRAY[]::text[]
      )
      INTO v_scope_exposure_classes
      FROM jsonb_array_elements_text(
        COALESCE(p_transition -> 'scopeExposureClasses', '[]'::jsonb)
      ) WITH ORDINALITY AS item(value, ordinality);

      SELECT COALESCE(
        array_agg(item.value::uuid ORDER BY item.ordinality),
        ARRAY[]::uuid[]
      )
      INTO v_protected_alternative_beach_ids
      FROM jsonb_array_elements_text(
        COALESCE(
          p_transition -> 'protectedAlternativeBeachIds',
          '[]'::jsonb
        )
      ) WITH ORDINALITY AS item(value, ordinality);

      SELECT COALESCE(
        array_agg(item.value ORDER BY item.ordinality),
        ARRAY[]::text[]
      )
      INTO v_affected_cohorts
      FROM jsonb_array_elements_text(
        p_transition -> 'affectedCohorts'
      ) WITH ORDINALITY AS item(value, ordinality);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'manual transition has invalid array values'
        USING ERRCODE = '22023';
    END;

    IF NOT public.regional_recommendation_hold_region_keys_are_safe(
      v_region_keys
    )
       OR cardinality(v_scope_beach_ids) NOT BETWEEN 1 AND 2000
       OR cardinality(v_scope_exposure_classes) > 4
       OR NOT v_scope_exposure_classes <@ ARRAY[
         'fully_exposed','partially_protected','protected','unknown'
       ]::text[]
       OR cardinality(v_protected_alternative_beach_ids) > 2000
       OR cardinality(v_affected_cohorts) = 0
       OR NOT v_affected_cohorts <@ ARRAY[
         'beginner','intermediate','advanced','expert','unknown'
       ]::text[]
       OR cardinality(v_scope_beach_ids) <> (
         SELECT count(DISTINCT beach_id)
         FROM unnest(v_scope_beach_ids) AS beaches(beach_id)
       )
       OR cardinality(v_scope_exposure_classes) <> (
         SELECT count(DISTINCT exposure_class)
         FROM unnest(v_scope_exposure_classes) AS exposures(exposure_class)
       )
       OR cardinality(v_protected_alternative_beach_ids) <> (
         SELECT count(DISTINCT beach_id)
         FROM unnest(v_protected_alternative_beach_ids) AS beaches(beach_id)
       )
       OR cardinality(v_affected_cohorts) <> (
         SELECT count(DISTINCT cohort)
         FROM unnest(v_affected_cohorts) AS cohorts(cohort)
       ) THEN
      RAISE EXCEPTION 'manual transition has invalid scope or cohort fields'
        USING ERRCODE = '22023';
    END IF;

    v_event_reference := p_transition ->> 'eventReference';
    IF v_event_reference IS NOT NULL
       AND v_event_reference
         !~ '^(event|official|qa):[a-z0-9_]+:[A-Za-z0-9_-]{1,64}$' THEN
      RAISE EXCEPTION 'manual transition has invalid event reference'
        USING ERRCODE = '22023';
    END IF;

    v_action := p_transition ->> 'action';
    IF v_action IS NULL
       OR v_action NOT IN (
         'suppress_positive','protected_alternatives_only'
       )
       OR (
         v_action = 'protected_alternatives_only'
         AND cardinality(v_protected_alternative_beach_ids) = 0
       ) THEN
      RAISE EXCEPTION 'manual transition has invalid action'
        USING ERRCODE = '22023';
    END IF;

    v_reason_code := p_transition ->> 'reasonCode';
    IF v_reason_code IS NULL
       OR v_reason_code NOT IN (
         'major_swell_manual_safety',
         'official_high_rip_current',
         'scope_correction',
         'event_expired',
         'operator_cancelled',
         'policy_rollback'
       ) THEN
      RAISE EXCEPTION 'manual transition has invalid reason code'
        USING ERRCODE = '22023';
    END IF;

    v_status := CASE
      WHEN v_transition = 'cancellation' THEN 'cancelled'
      ELSE 'active'
    END;
    v_automatic_policy_version := NULL;
    v_authorizing_actor := 'admin_api';
  END IF;

  v_new.hold_id := v_hold_id;
  v_new.version := v_version;
  v_new.transition := v_transition;
  v_new.status := v_status;
  v_new.region_keys := v_region_keys;
  v_new.scope_beach_ids := v_scope_beach_ids;
  v_new.scope_exposure_classes := v_scope_exposure_classes;
  v_new.protected_alternative_beach_ids :=
    v_protected_alternative_beach_ids;
  v_new.event_reference := v_event_reference;
  v_new.valid_from := v_valid_from;
  v_new.valid_until := v_valid_until;
  v_new.affected_cohorts := v_affected_cohorts;
  v_new.action := v_action;
  v_new.trigger_type := v_trigger_type;
  v_new.supporting_evidence_refs := v_supporting_evidence_refs;
  v_new.automatic_policy_version := v_automatic_policy_version;
  v_new.authorizing_operator_ref := v_authorizing_operator_ref;
  v_new.authorizing_actor := v_authorizing_actor;
  v_new.reason_code := v_reason_code;
  v_new.effective_at := v_effective_at;
  v_new.expires_at := v_expires_at;
  v_new.supersedes_record_id := v_supersedes_record_id;
  v_new.idempotency_key := v_idempotency_key;
  v_new.request_id := v_request_id;

  v_payload := public.regional_recommendation_hold_canonical_payload(v_new);
  v_payload_hash := encode(
    pg_catalog.sha256(convert_to(v_payload::text, 'UTF8')),
    'hex'
  );
  v_new.payload_hash := v_payload_hash;

  IF v_existing.record_id IS NOT NULL THEN
    IF v_existing.payload_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'hold idempotency collision'
        USING ERRCODE = '23505';
    END IF;

    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT *
  INTO v_previous
  FROM public.regional_recommendation_holds
  WHERE hold_id = v_hold_id
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF v_transition = 'activation' THEN
    IF v_version <> 1
       OR v_supersedes_record_id IS NOT NULL
       OR v_previous.record_id IS NOT NULL THEN
      RAISE EXCEPTION 'activation must start a new hold chain'
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_previous.record_id IS NULL
        OR v_version <> v_previous.version + 1
        OR v_supersedes_record_id IS DISTINCT FROM v_previous.record_id THEN
    RAISE EXCEPTION 'transition must supersede the latest hold version'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.regional_recommendation_holds (
    hold_id,
    version,
    transition,
    status,
    region_keys,
    scope_beach_ids,
    scope_exposure_classes,
    protected_alternative_beach_ids,
    event_reference,
    valid_from,
    valid_until,
    affected_cohorts,
    action,
    trigger_type,
    supporting_evidence_refs,
    automatic_policy_version,
    authorizing_operator_ref,
    authorizing_actor,
    reason_code,
    effective_at,
    expires_at,
    supersedes_record_id,
    idempotency_key,
    payload_hash,
    request_id
  )
  VALUES (
    v_new.hold_id,
    v_new.version,
    v_new.transition,
    v_new.status,
    v_new.region_keys,
    v_new.scope_beach_ids,
    v_new.scope_exposure_classes,
    v_new.protected_alternative_beach_ids,
    v_new.event_reference,
    v_new.valid_from,
    v_new.valid_until,
    v_new.affected_cohorts,
    v_new.action,
    v_new.trigger_type,
    v_new.supporting_evidence_refs,
    v_new.automatic_policy_version,
    v_new.authorizing_operator_ref,
    v_new.authorizing_actor,
    v_new.reason_code,
    v_new.effective_at,
    v_new.expires_at,
    v_new.supersedes_record_id,
    v_new.idempotency_key,
    v_new.payload_hash,
    v_new.request_id
  )
  RETURNING * INTO v_new;

  RETURN NEXT v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_active_regional_recommendation_holds(
  p_as_of timestamptz,
  p_beach_ids uuid[],
  p_window_start timestamptz,
  p_window_end timestamptz
)
RETURNS SETOF public.regional_recommendation_holds
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH effective_versions AS (
    SELECT *
    FROM public.regional_recommendation_holds
    WHERE effective_at <= p_as_of
  ), latest AS (
    SELECT DISTINCT ON (hold_id) *
    FROM effective_versions
    ORDER BY hold_id, version DESC
  )
  SELECT latest.*
  FROM latest
  WHERE status = 'active'
    AND expires_at > p_as_of
    AND valid_from < p_window_end
    AND valid_until > p_window_start
    AND scope_beach_ids && p_beach_ids;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_regional_recommendation_holds_v1()
RETURNS TABLE(chains_deleted bigint, rows_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := transaction_timestamp();
  v_candidate_hold_ids uuid[] := ARRAY[]::uuid[];
  v_candidate_hold_id uuid;
  v_hold_ids uuid[] := ARRAY[]::uuid[];
  v_chain_count bigint := 0;
  v_row_count bigint := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('regional-recommendation-hold-retention-v1', 0)
  );

  WITH latest AS (
    SELECT DISTINCT ON (hold_id)
      hold_id,
      status,
      expires_at
    FROM public.regional_recommendation_holds
    ORDER BY hold_id, version DESC
  )
  SELECT COALESCE(
    array_agg(latest.hold_id ORDER BY latest.hold_id),
    ARRAY[]::uuid[]
  )
  INTO v_candidate_hold_ids
  FROM latest
  WHERE (latest.status = 'cancelled' OR latest.expires_at <= v_now)
    AND NOT EXISTS (
      SELECT 1
      FROM public.regional_recommendation_holds AS future_version
      WHERE future_version.hold_id = latest.hold_id
        AND future_version.effective_at > v_now
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.regional_recommendation_holds AS retained_version
      WHERE retained_version.hold_id = latest.hold_id
        AND retained_version.expires_at >= v_now - interval '13 months'
    );

  IF cardinality(v_candidate_hold_ids) = 0 THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint;
    RETURN;
  END IF;

  -- Append takes this same per-hold lock. Lock candidates in UUID order, then
  -- re-evaluate them under lock so a row committed while purge was waiting can
  -- never be swept into the whole-chain DELETE.
  FOREACH v_candidate_hold_id IN ARRAY v_candidate_hold_ids
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'regional-hold:' || v_candidate_hold_id::text,
        0
      )
    );
  END LOOP;

  WITH latest AS (
    SELECT DISTINCT ON (hold_id)
      hold_id,
      status,
      expires_at
    FROM public.regional_recommendation_holds
    ORDER BY hold_id, version DESC
  )
  SELECT COALESCE(
    array_agg(latest.hold_id ORDER BY latest.hold_id),
    ARRAY[]::uuid[]
  )
  INTO v_hold_ids
  FROM latest
  WHERE latest.hold_id = ANY(v_candidate_hold_ids)
    AND (latest.status = 'cancelled' OR latest.expires_at <= v_now)
    AND NOT EXISTS (
      SELECT 1
      FROM public.regional_recommendation_holds AS future_version
      WHERE future_version.hold_id = latest.hold_id
        AND future_version.effective_at > v_now
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.regional_recommendation_holds AS retained_version
      WHERE retained_version.hold_id = latest.hold_id
        AND retained_version.expires_at >= v_now - interval '13 months'
    );

  v_chain_count := cardinality(v_hold_ids);
  IF v_chain_count = 0 THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint;
    RETURN;
  END IF;

  PERFORM set_config(
    'app.regional_recommendation_hold_retention_purge',
    'on',
    true
  );

  DELETE FROM public.regional_recommendation_holds
  WHERE hold_id = ANY(v_hold_ids);
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  PERFORM set_config(
    'app.regional_recommendation_hold_retention_purge',
    'off',
    true
  );

  RETURN QUERY SELECT v_chain_count, v_row_count;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config(
    'app.regional_recommendation_hold_retention_purge',
    'off',
    true
  );
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.erase_regional_recommendation_hold_operator_v1(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'operator erasure requires a user id'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('regional-hold-operator:' || p_user_id::text, 0)
  );

  DELETE FROM public.regional_recommendation_hold_operator_refs
  WHERE operator_user_id = p_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('mapping_deleted', v_deleted > 0);
END;
$$;

-- Preserve the canonical account-erasure behavior while removing the sole
-- auth-user-to-operator-reference link in the same transaction.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_sessions_soft_deleted int := 0;
  v_comments_anonymized int := 0;
  v_personal_rows_deleted int := 0;
  v_count int;
BEGIN
  INSERT INTO account_deletions (user_id)
  VALUES (p_user_id)
  RETURNING id INTO v_audit_id;

  UPDATE sessions
  SET deleted_at = now(),
      notes = NULL,
      description = NULL,
      image_url = NULL,
      board_snapshot = NULL,
      muted = true
  WHERE user_id = p_user_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sessions_soft_deleted = ROW_COUNT;

  UPDATE comments
  SET content = '[deleted]',
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_comments_anonymized = ROW_COUNT;

  UPDATE beach_reviews
  SET title = '[deleted]',
      content = '[deleted]',
      deleted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  UPDATE intel_posts
  SET is_active = false,
      title = '[deleted]',
      description = '[deleted]',
      photo_url = NULL,
      photo_storage_path = NULL,
      vibe = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  DELETE FROM intel_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_email_prefs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_surf_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_implicit_preferences WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_beach_affinity WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM favorite_beaches WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_devices WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_badges WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_xp WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM xp_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM personalization_milestones WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM saved_windows WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_invitations
  WHERE inviter_id = p_user_id OR invitee_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM boards WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  UPDATE session_media
  SET deleted_at = now(),
      caption = NULL
  WHERE user_id = p_user_id AND deleted_at IS NULL;

  DELETE FROM session_forecast_snapshots WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM spot_feedback WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM notifications WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_alert_deliveries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM user_follows
  WHERE follower_id = p_user_id OR following_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM beach_review_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_likes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM session_shares WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM forecast_accuracy_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_votes WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  DELETE FROM intel_post_confirmations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_personal_rows_deleted := v_personal_rows_deleted + v_count;

  PERFORM public.erase_regional_recommendation_hold_operator_v1(p_user_id);

  UPDATE profiles
  SET deleted_at = now(),
      full_name = 'Deleted surfer',
      avatar_url = NULL,
      bio = NULL,
      location = NULL,
      instagram = NULL,
      home_beach_id = NULL,
      experience_level = NULL,
      preferred_session_time = NULL,
      surf_styles = NULL,
      followers_count = 0,
      following_count = 0,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE account_deletions
  SET completed_at = now(),
      sessions_soft_deleted = v_sessions_soft_deleted,
      comments_anonymized = v_comments_anonymized,
      personal_rows_deleted = v_personal_rows_deleted
  WHERE id = v_audit_id;

  RETURN jsonb_build_object(
    'audit_id', v_audit_id,
    'sessions_soft_deleted', v_sessions_soft_deleted,
    'comments_anonymized', v_comments_anonymized,
    'personal_rows_deleted', v_personal_rows_deleted
  );
EXCEPTION WHEN OTHERS THEN
  UPDATE account_deletions
  SET error = SQLERRM
  WHERE id = v_audit_id;
  RAISE;
END;
$$;

REVOKE ALL ON public.regional_recommendation_hold_operator_refs
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON public.regional_recommendation_holds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.regional_recommendation_holds FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.regional_recommendation_holds FROM service_role;
GRANT SELECT ON public.regional_recommendation_holds TO service_role;

REVOKE ALL ON FUNCTION public.regional_recommendation_hold_refs_are_safe(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.regional_recommendation_hold_region_keys_are_safe(text[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_regional_recommendation_hold_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.regional_recommendation_hold_canonical_payload(
  public.regional_recommendation_holds
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.append_regional_recommendation_hold_transition(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_active_regional_recommendation_holds(
  timestamptz,
  uuid[],
  timestamptz,
  timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_regional_recommendation_holds_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erase_regional_recommendation_hold_operator_v1(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.append_regional_recommendation_hold_transition(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_active_regional_recommendation_holds(
  timestamptz,
  uuid[],
  timestamptz,
  timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_regional_recommendation_holds_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.erase_regional_recommendation_hold_operator_v1(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

COMMENT ON TABLE public.regional_recommendation_holds IS
  'Append-only P0-A recommendation safety policy transitions. One row per audited transition.';
COMMENT ON TABLE public.regional_recommendation_hold_operator_refs IS
  'Access-denied mapping from auth users to opaque hold operator references; erased independently of policy history.';
COMMENT ON FUNCTION public.append_regional_recommendation_hold_transition(jsonb) IS
  'Only application write boundary for manual and database-verified official recommendation hold transitions.';
COMMENT ON FUNCTION public.purge_expired_regional_recommendation_holds_v1() IS
  'Deletes only complete terminal hold chains after every row is older than 13 months.';

COMMIT;
