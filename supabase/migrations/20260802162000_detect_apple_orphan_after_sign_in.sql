BEGIN;

CREATE INDEX IF NOT EXISTS idx_user_events_native_install_id
  ON public.user_events ((metadata->>'native_install_id'))
  WHERE metadata ? 'native_install_id';

CREATE OR REPLACE FUNCTION public.detect_apple_orphan_after_sign_in(
  p_current_user_id uuid,
  p_apple_sub text,
  p_native_install_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_current_created_at timestamptz;
  v_current_name text;
  v_candidate_user_id uuid;
  v_candidate_count integer;
  v_pair_key text;
BEGIN
  IF p_current_user_id IS NULL
     OR length(p_apple_sub) = 0
     OR p_native_install_id IS NULL
     OR length(p_idempotency_key) < 8
     OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid apple orphan detection input';
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
  ) THEN
    RETURN jsonb_build_object('status', 'schema_coverage_incomplete');
  END IF;

  SELECT
    signed_in_user.created_at,
    lower(
      regexp_replace(
        trim(
          coalesce(
            nullif(current_profile.full_name, ''),
            nullif(current_profile.display_name, ''),
            nullif(signed_in_user.raw_user_meta_data->>'full_name', ''),
            nullif(signed_in_user.raw_user_meta_data->>'name', ''),
            nullif(
              concat_ws(
                ' ',
                signed_in_user.raw_user_meta_data->>'given_name',
                signed_in_user.raw_user_meta_data->>'family_name'
              ),
              ''
            )
          )
        ),
        '[^[:alnum:]]+',
        '',
        'g'
      )
    )
  INTO v_current_created_at, v_current_name
  FROM auth.users signed_in_user
  LEFT JOIN public.profiles current_profile
    ON current_profile.id = signed_in_user.id
   AND current_profile.deleted_at IS NULL
  WHERE signed_in_user.id = p_current_user_id
    AND signed_in_user.deleted_at IS NULL;

  IF NOT FOUND
     OR v_current_name IS NULL
     OR v_current_name = ''
     OR v_current_created_at < clock_timestamp() - interval '15 minutes'
     OR v_current_created_at > clock_timestamp() + interval '30 seconds' THEN
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities identity_row
    WHERE identity_row.user_id = p_current_user_id
      AND identity_row.provider = 'apple'
      AND (
        identity_row.provider_id = p_apple_sub
        OR identity_row.identity_data->>'sub' = p_apple_sub
      )
  ) THEN
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  WITH candidate_users AS MATERIALIZED (
    SELECT DISTINCT event_row.user_id
    FROM public.user_events event_row
    WHERE event_row.user_id IS NOT NULL
      AND event_row.user_id <> p_current_user_id
      AND event_row.metadata->>'native_install_id' = p_native_install_id::text
  ),
  named_candidates AS (
    SELECT candidate_user.id
    FROM candidate_users candidate
    JOIN auth.users candidate_user ON candidate_user.id = candidate.user_id
    LEFT JOIN public.profiles candidate_profile
      ON candidate_profile.id = candidate_user.id
     AND candidate_profile.deleted_at IS NULL
    WHERE candidate_user.deleted_at IS NULL
      AND candidate_user.created_at < v_current_created_at
      AND lower(
        regexp_replace(
          trim(
            coalesce(
              nullif(candidate_profile.full_name, ''),
              nullif(candidate_profile.display_name, ''),
              nullif(candidate_user.raw_user_meta_data->>'full_name', ''),
              nullif(candidate_user.raw_user_meta_data->>'name', ''),
              nullif(
                concat_ws(
                  ' ',
                  candidate_user.raw_user_meta_data->>'given_name',
                  candidate_user.raw_user_meta_data->>'family_name'
                ),
                ''
              )
            )
          ),
          '[^[:alnum:]]+',
          '',
          'g'
        )
      ) = v_current_name
  )
  SELECT count(*), (array_agg(id ORDER BY id))[1]
  INTO v_candidate_count, v_candidate_user_id
  FROM named_candidates;

  IF v_candidate_count <> 1 OR v_candidate_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_match');
  END IF;

  v_pair_key := v_candidate_user_id::text || ':' || p_current_user_id::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pair_key, 0));

  IF EXISTS (
    SELECT 1
    FROM public.apple_identity_recovery_audit audit_row
    WHERE audit_row.canonical_user_id = v_candidate_user_id
      AND audit_row.event_type = 'post_sign_in_orphan_flagged'
      AND audit_row.event_details->>'secondary_user_id' = p_current_user_id::text
  ) THEN
    RETURN jsonb_build_object('status', 'flagged');
  END IF;

  INSERT INTO public.apple_identity_recovery_audit (
    canonical_user_id,
    event_type,
    event_details
  ) VALUES (
    v_candidate_user_id,
    'post_sign_in_orphan_flagged',
    jsonb_build_object(
      'secondary_user_id', p_current_user_id,
      'evidence', jsonb_build_array('native_install_id', 'normalized_name'),
      'idempotency_key_sha256',
        encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex')
    )
  );

  INSERT INTO public.user_events (
    user_id,
    event_type,
    metadata
  ) VALUES (
    p_current_user_id,
    'apple_orphan_recovery_flagged',
    jsonb_build_object(
      'detection_surface', 'apple_sign_in',
      'evidence', jsonb_build_array('native_install_id', 'normalized_name'),
      'probable_canonical_user_id', v_candidate_user_id,
      'event_id', 'apple-orphan:' || v_pair_key
    )
  );

  RETURN jsonb_build_object('status', 'flagged');
END;
$$;

COMMENT ON FUNCTION public.detect_apple_orphan_after_sign_in(uuid, text, uuid, text) IS
'Service-only post-sign-in detector. Flags one older same-install, exact-name account pair without blocking authentication or mutating auth identities.';

REVOKE ALL ON FUNCTION public.detect_apple_orphan_after_sign_in(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_apple_orphan_after_sign_in(uuid, text, uuid, text)
  TO service_role;

COMMIT;
