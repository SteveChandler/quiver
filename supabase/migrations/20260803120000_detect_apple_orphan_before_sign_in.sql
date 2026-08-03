BEGIN;

CREATE OR REPLACE FUNCTION public.detect_apple_orphan_before_sign_in(
  p_apple_sub text,
  p_native_install_id uuid,
  p_full_name text,
  p_token_issued_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_normalized_name text;
  v_candidate_user_id uuid;
  v_candidate_count integer;
  v_apple_sub_sha256 text;
  v_audit_key text;
BEGIN
  IF p_apple_sub IS NULL
     OR length(p_apple_sub) = 0
     OR p_native_install_id IS NULL
     OR p_token_issued_at IS NULL
     OR p_token_issued_at < clock_timestamp() - interval '5 minutes'
     OR p_token_issued_at > clock_timestamp() + interval '30 seconds' THEN
    RAISE EXCEPTION 'invalid apple orphan precheck input';
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

  IF EXISTS (
    SELECT 1
    FROM auth.identities identity_row
    JOIN auth.users identity_user ON identity_user.id = identity_row.user_id
    WHERE identity_row.provider = 'apple'
      AND identity_user.deleted_at IS NULL
      AND (
        identity_row.provider_id = p_apple_sub
        OR identity_row.identity_data->>'sub' = p_apple_sub
      )
  ) THEN
    RETURN jsonb_build_object('status', 'apple_sub_claimed');
  END IF;

  v_normalized_name := lower(
    regexp_replace(trim(coalesce(p_full_name, '')), '[^[:alnum:]]+', '', 'g')
  );
  IF v_normalized_name = '' THEN
    RETURN jsonb_build_object('status', 'unclaimed_no_match');
  END IF;

  WITH candidate_users AS MATERIALIZED (
    SELECT DISTINCT event_row.user_id
    FROM public.user_events event_row
    WHERE event_row.user_id IS NOT NULL
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
      AND candidate_user.created_at < p_token_issued_at
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
      ) = v_normalized_name
  )
  SELECT count(*), (array_agg(id ORDER BY id))[1]
  INTO v_candidate_count, v_candidate_user_id
  FROM named_candidates;

  IF v_candidate_count <> 1 OR v_candidate_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unclaimed_no_match');
  END IF;

  v_apple_sub_sha256 := encode(
    extensions.digest(p_apple_sub, 'sha256'),
    'hex'
  );
  v_audit_key := v_candidate_user_id::text || ':' || v_apple_sub_sha256;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_audit_key, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.apple_identity_recovery_audit audit_row
    WHERE audit_row.canonical_user_id = v_candidate_user_id
      AND audit_row.event_type = 'pre_sign_in_orphan_prevented'
      AND audit_row.event_details->>'apple_sub_sha256' = v_apple_sub_sha256
  ) THEN
    INSERT INTO public.apple_identity_recovery_audit (
      canonical_user_id,
      event_type,
      event_details
    ) VALUES (
      v_candidate_user_id,
      'pre_sign_in_orphan_prevented',
      jsonb_build_object(
        'apple_sub_sha256', v_apple_sub_sha256,
        'evidence', jsonb_build_array('native_install_id', 'normalized_name')
      )
    );
  END IF;

  RETURN jsonb_build_object('status', 'prevent');
END;
$$;

COMMENT ON FUNCTION public.detect_apple_orphan_before_sign_in(text, uuid, text, timestamptz) IS
'Service-only pre-sign-in detector. A stable native install ID is expected to survive app updates and relaunches but may reset on uninstall/reinstall, which weakens prevention to the post-sign-in backstop.';

REVOKE ALL ON FUNCTION public.detect_apple_orphan_before_sign_in(text, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_apple_orphan_before_sign_in(text, uuid, text, timestamptz)
  TO service_role;

COMMIT;
