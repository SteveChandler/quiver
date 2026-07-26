BEGIN;

CREATE TABLE public.apple_recovery_dependency_registry (
  source_schema text NOT NULL,
  source_table text NOT NULL,
  constraint_name text NOT NULL,
  target_schema text NOT NULL,
  target_table text NOT NULL,
  source_columns text[] NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (source_schema, source_table, constraint_name)
);

COMMENT ON TABLE public.apple_recovery_dependency_registry IS
'Frozen inventory of public foreign keys into auth.users or public.profiles. Recovery fails closed when pg_catalog contains an unregistered dependency.';

INSERT INTO public.apple_recovery_dependency_registry (
  source_schema,
  source_table,
  constraint_name,
  target_schema,
  target_table,
  source_columns
)
SELECT
  source_ns.nspname,
  source_table.relname,
  constraint_row.conname,
  target_ns.nspname,
  target_table.relname,
  ARRAY(
    SELECT source_attribute.attname
    FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
    JOIN pg_attribute source_attribute
      ON source_attribute.attrelid = constraint_row.conrelid
     AND source_attribute.attnum = key_column.attnum
    ORDER BY key_column.ordinal
  )
FROM pg_constraint constraint_row
JOIN pg_class source_table ON source_table.oid = constraint_row.conrelid
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
JOIN pg_class target_table ON target_table.oid = constraint_row.confrelid
JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
WHERE constraint_row.contype = 'f'
  AND source_ns.nspname = 'public'
  AND constraint_row.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass);

CREATE TABLE public.apple_identity_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  secondary_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  apple_identity_id uuid NOT NULL,
  apple_sub_sha256 text NOT NULL,
  apple_token_sha256 text NOT NULL UNIQUE,
  assessment_idempotency_key text NOT NULL,
  confirmation_idempotency_key text,
  status text NOT NULL CHECK (
    status IN (
      'eligible',
      'support_required',
      'operator_pending',
      'completed',
      'rolled_back',
      'expired'
    )
  ),
  eligibility_snapshot jsonb NOT NULL,
  support_reference text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  completed_at timestamptz,
  rollback_until timestamptz,
  notification_status text NOT NULL DEFAULT 'not_applicable' CHECK (
    notification_status IN ('not_applicable', 'pending', 'sent', 'failed')
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (canonical_user_id, assessment_idempotency_key),
  UNIQUE (canonical_user_id, confirmation_idempotency_key)
);

CREATE TABLE public.apple_identity_recovery_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recovery_id uuid REFERENCES public.apple_identity_recovery_requests(id) ON DELETE RESTRICT,
  canonical_user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Capture the recovery request table's own auth.users FKs. The initial
-- catalog snapshot ran before this table existed; without this second pass the
-- first assessment would correctly (but unhelpfully) detect this migration's
-- own new constraints as uncovered schema growth.
INSERT INTO public.apple_recovery_dependency_registry (
  source_schema,
  source_table,
  constraint_name,
  target_schema,
  target_table,
  source_columns
)
SELECT
  source_ns.nspname,
  source_table.relname,
  constraint_row.conname,
  target_ns.nspname,
  target_table.relname,
  ARRAY(
    SELECT source_attribute.attname
    FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
    JOIN pg_attribute source_attribute
      ON source_attribute.attrelid = constraint_row.conrelid
     AND source_attribute.attnum = key_column.attnum
    ORDER BY key_column.ordinal
  )
FROM pg_constraint constraint_row
JOIN pg_class source_table ON source_table.oid = constraint_row.conrelid
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
JOIN pg_class target_table ON target_table.oid = constraint_row.confrelid
JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
WHERE constraint_row.contype = 'f'
  AND source_ns.nspname = 'public'
  AND constraint_row.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
ON CONFLICT (source_schema, source_table, constraint_name) DO NOTHING;

ALTER TABLE public.apple_recovery_dependency_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apple_identity_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apple_identity_recovery_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.apple_recovery_dependency_registry FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.apple_identity_recovery_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.apple_identity_recovery_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.apple_identity_recovery_requests TO service_role;
GRANT SELECT, INSERT ON public.apple_identity_recovery_audit TO service_role;
GRANT SELECT ON public.apple_recovery_dependency_registry TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.apple_identity_recovery_audit_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.assess_apple_identity_recovery(
  p_canonical_user_id uuid,
  p_apple_sub text,
  p_apple_token_sha256 text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_identity auth.identities%ROWTYPE;
  v_existing public.apple_identity_recovery_requests%ROWTYPE;
  v_dependency record;
  v_dependency_count bigint;
  v_data_counts jsonb := '{}'::jsonb;
  v_has_product_data boolean := false;
  v_recovery_id uuid;
  v_support_reference text;
  v_secondary_created_at timestamptz;
  v_expires_at timestamptz := clock_timestamp() + interval '10 minutes';
BEGIN
  IF p_canonical_user_id IS NULL
     OR length(p_apple_sub) = 0
     OR p_apple_token_sha256 !~ '^[0-9a-f]{64}$'
     OR length(p_idempotency_key) < 8
     OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid apple recovery assessment input';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint current_constraint
    JOIN pg_class source_table ON source_table.oid = current_constraint.conrelid
    JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
    JOIN pg_class target_table ON target_table.oid = current_constraint.confrelid
    JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
    WHERE current_constraint.contype = 'f'
      AND source_ns.nspname = 'public'
      AND current_constraint.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
      AND NOT EXISTS (
        SELECT 1
        FROM public.apple_recovery_dependency_registry registry
        WHERE registry.source_schema = source_ns.nspname
          AND registry.source_table = source_table.relname
          AND registry.constraint_name = current_constraint.conname
          AND registry.target_schema = target_ns.nspname
          AND registry.target_table = target_table.relname
      )
  ) THEN
    INSERT INTO public.apple_identity_recovery_audit (
      canonical_user_id,
      event_type
    ) VALUES (
      p_canonical_user_id,
      'schema_coverage_incomplete'
    );
    RETURN jsonb_build_object('status', 'schema_coverage_incomplete');
  END IF;

  SELECT *
  INTO v_identity
  FROM auth.identities
  WHERE provider = 'apple'
    AND (
      provider_id = p_apple_sub
      OR identity_data->>'sub' = p_apple_sub
    )
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.apple_identity_recovery_audit (
      canonical_user_id,
      event_type
    ) VALUES (
      p_canonical_user_id,
      'apple_identity_unclaimed'
    );
    RETURN jsonb_build_object('status', 'unclaimed');
  END IF;

  IF v_identity.user_id = p_canonical_user_id THEN
    INSERT INTO public.apple_identity_recovery_audit (
      canonical_user_id,
      event_type
    ) VALUES (
      p_canonical_user_id,
      'apple_identity_already_linked'
    );
    RETURN jsonb_build_object('status', 'already_linked');
  END IF;

  SELECT *
  INTO v_existing
  FROM public.apple_identity_recovery_requests
  WHERE apple_token_sha256 = p_apple_token_sha256
     OR (
       canonical_user_id = p_canonical_user_id
       AND assessment_idempotency_key = p_idempotency_key
     )
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.canonical_user_id <> p_canonical_user_id
       OR v_existing.assessment_idempotency_key <> p_idempotency_key THEN
      RETURN jsonb_build_object('status', 'replayed');
    END IF;

    RETURN jsonb_build_object(
      'status', v_existing.status,
      'recovery_id', v_existing.id,
      'expires_at', v_existing.expires_at,
      'support_reference', v_existing.support_reference,
      'secondary_created_at', (
        SELECT created_at FROM auth.users WHERE id = v_existing.secondary_user_id
      )
    );
  END IF;

  SELECT created_at
  INTO v_secondary_created_at
  FROM auth.users
  WHERE id = v_identity.user_id;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_identity.user_id) THEN
    v_has_product_data := true;
    v_data_counts := v_data_counts || jsonb_build_object('public.profiles', 1);
  END IF;

  FOR v_dependency IN
    SELECT *
    FROM public.apple_recovery_dependency_registry
    WHERE NOT (
      source_schema = 'public'
      AND source_table IN (
        'profiles',
        'apple_identity_recovery_requests',
        'apple_identity_recovery_audit'
      )
    )
  LOOP
    IF cardinality(v_dependency.source_columns) <> 1 THEN
      v_has_product_data := true;
      v_data_counts := v_data_counts || jsonb_build_object(
        format('%I.%I', v_dependency.source_schema, v_dependency.source_table),
        'unsupported_composite_fk'
      );
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      v_dependency.source_schema,
      v_dependency.source_table,
      v_dependency.source_columns[1]
    )
    INTO v_dependency_count
    USING v_identity.user_id;

    IF v_dependency_count > 0 THEN
      v_has_product_data := true;
      v_data_counts := v_data_counts || jsonb_build_object(
        format('%I.%I', v_dependency.source_schema, v_dependency.source_table),
        v_dependency_count
      );
    END IF;
  END LOOP;

  v_recovery_id := gen_random_uuid();
  v_support_reference := 'AR-' || upper(substr(replace(v_recovery_id::text, '-', ''), 1, 8));

  INSERT INTO public.apple_identity_recovery_requests (
    id,
    canonical_user_id,
    secondary_user_id,
    apple_identity_id,
    apple_sub_sha256,
    apple_token_sha256,
    assessment_idempotency_key,
    status,
    eligibility_snapshot,
    support_reference,
    expires_at
  ) VALUES (
    v_recovery_id,
    p_canonical_user_id,
    v_identity.user_id,
    v_identity.id,
    encode(extensions.digest(p_apple_sub, 'sha256'), 'hex'),
    p_apple_token_sha256,
    p_idempotency_key,
    CASE WHEN v_has_product_data THEN 'support_required' ELSE 'eligible' END,
    jsonb_build_object(
      'schema_coverage_complete', true,
      'data_counts', v_data_counts,
      'assessed_at', clock_timestamp()
    ),
    v_support_reference,
    v_expires_at
  );

  INSERT INTO public.apple_identity_recovery_audit (
    recovery_id,
    canonical_user_id,
    event_type,
    event_details
  ) VALUES (
    v_recovery_id,
    p_canonical_user_id,
    CASE WHEN v_has_product_data THEN 'support_required' ELSE 'eligible' END,
    jsonb_build_object(
      'dependency_count',
      (SELECT count(*) FROM jsonb_object_keys(v_data_counts))
    )
  );

  IF v_has_product_data THEN
    RETURN jsonb_build_object(
      'status', 'support_required',
      'support_reference', v_support_reference
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'eligible',
    'recovery_id', v_recovery_id,
    'expires_at', v_expires_at,
    'secondary_created_at', v_secondary_created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_apple_identity_recovery(
  p_canonical_user_id uuid,
  p_recovery_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_request public.apple_identity_recovery_requests%ROWTYPE;
BEGIN
  IF p_canonical_user_id IS NULL
     OR p_recovery_id IS NULL
     OR length(p_idempotency_key) < 8
     OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid apple recovery confirmation input';
  END IF;

  SELECT *
  INTO v_request
  FROM public.apple_identity_recovery_requests
  WHERE id = p_recovery_id
    AND canonical_user_id = p_canonical_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_request.status = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'already_recovered',
      'rollback_until', v_request.rollback_until
    );
  END IF;

  IF v_request.status = 'support_required' THEN
    RETURN jsonb_build_object(
      'status', 'support_required',
      'support_reference', v_request.support_reference
    );
  END IF;

  IF v_request.expires_at <= clock_timestamp() THEN
    UPDATE public.apple_identity_recovery_requests
    SET status = 'expired', updated_at = clock_timestamp()
    WHERE id = v_request.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_request.confirmation_idempotency_key IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'identity_transfer_not_supported',
      'support_reference', v_request.support_reference
    );
  END IF;

  UPDATE public.apple_identity_recovery_requests
  SET
    confirmation_idempotency_key = p_idempotency_key,
    confirmed_at = clock_timestamp(),
    status = 'operator_pending',
    updated_at = clock_timestamp()
  WHERE id = v_request.id;

  INSERT INTO public.apple_identity_recovery_audit (
    recovery_id,
    canonical_user_id,
    event_type
  ) VALUES (
    v_request.id,
    p_canonical_user_id,
    'canonical_account_confirmed'
  );

  -- Supabase Auth exposes no supported API for transactionally reassigning an
  -- auth.identities row. This function deliberately stops after durable
  -- confirmation rather than writing GoTrue-owned tables directly.
  RETURN jsonb_build_object(
    'status', 'identity_transfer_not_supported',
    'support_reference', v_request.support_reference
  );
END;
$$;

COMMENT ON FUNCTION public.assess_apple_identity_recovery(uuid, text, text, text) IS
'Service-only Apple recovery assessment. Uses a verified stable Apple sub supplied by the API, inventories every registered public FK dependency, and fails closed on schema growth.';
COMMENT ON FUNCTION public.confirm_apple_identity_recovery(uuid, uuid, text) IS
'Service-only explicit canonical-account confirmation. Records operator-pending state and intentionally does not mutate GoTrue-owned auth tables.';

REVOKE ALL ON FUNCTION public.assess_apple_identity_recovery(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_apple_identity_recovery(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assess_apple_identity_recovery(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_apple_identity_recovery(uuid, uuid, text) TO service_role;

COMMIT;
