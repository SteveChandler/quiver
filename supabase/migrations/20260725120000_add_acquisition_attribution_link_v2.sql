BEGIN;

CREATE OR REPLACE FUNCTION public.link_anonymous_events_v2(
  p_session_id uuid,
  p_user_id uuid,
  p_signup_context jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_linked_count integer := 0;
  v_profile_created_at timestamptz;
  v_existing_context jsonb := '{}'::jsonb;
  v_existing_surface text;
  v_candidate_context jsonb;
  v_merged_context jsonb;
  v_evidence_source text := 'none';
  v_attribution_outcome text := 'no_evidence';
  v_signup_surface text := 'unknown';
  v_event_metadata jsonb;
  v_event_created_at timestamptz;
  v_native_platform text;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id cannot be null';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  UPDATE public.user_events
  SET user_id = p_user_id
  WHERE session_id = p_session_id
    AND user_id IS NULL
    AND created_at > now() - interval '30 days';

  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  SELECT
    p.created_at,
    jsonb_strip_nulls(COALESCE(p.signup_context, '{}'::jsonb))
  INTO
    v_profile_created_at,
    v_existing_context
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'linked', v_linked_count,
      'attribution_outcome', 'no_profile',
      'signup_surface', 'unknown',
      'evidence_source', 'none'
    );
  END IF;

  v_existing_surface := NULLIF(v_existing_context->>'signup_surface', '');
  v_signup_surface := COALESCE(v_existing_surface, 'unknown');

  IF v_profile_created_at < now() - interval '24 hours' THEN
    RETURN jsonb_build_object(
      'linked', v_linked_count,
      'attribution_outcome', 'not_recent',
      'signup_surface', v_signup_surface,
      'evidence_source',
        CASE
          WHEN v_existing_context <> '{}'::jsonb
            THEN 'existing_profile_context'
          ELSE 'none'
        END
    );
  END IF;

  -- Evidence precedence 1: request_signup_context.
  IF p_signup_context IS NOT NULL
     AND jsonb_typeof(p_signup_context) = 'object'
     AND p_signup_context->>'schema_version' = '2'
     AND p_signup_context->>'signup_surface' IN (
       'web',
       'native_ios',
       'native_android',
       'unknown'
     )
     AND p_signup_context->>'method' IN (
       'email',
       'google',
       'apple',
       'unknown'
     )
     AND NULLIF(p_signup_context->>'entrypoint', '') IS NOT NULL
     AND p_signup_context->>'source_capture_status' IN ('captured', 'missing')
     AND NULLIF(p_signup_context->>'captured_at', '') IS NOT NULL THEN
    v_candidate_context := jsonb_strip_nulls(p_signup_context);
    v_evidence_source := 'request_signup_context';
  END IF;

  -- Evidence precedence 2: linked_web_signup_event.
  IF v_candidate_context IS NULL THEN
    SELECT
      ue.metadata,
      ue.created_at
    INTO
      v_event_metadata,
      v_event_created_at
    FROM public.user_events ue
    WHERE ue.user_id = p_user_id
      AND ue.event_type = 'signup_success'
      AND ue.created_at >= v_profile_created_at - interval '24 hours'
      AND ue.created_at < v_profile_created_at + interval '24 hours'
      AND COALESCE(ue.bot_flagged, false) = false
      AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
      AND COALESCE(
        ue.metadata->>'platform',
        ue.metadata->>'_platform',
        'web'
      ) NOT IN ('ios', 'android', 'native-ios', 'native-android')
    ORDER BY
      ABS(EXTRACT(EPOCH FROM (ue.created_at - v_profile_created_at))),
      ue.created_at
    LIMIT 1;

    IF FOUND THEN
      v_candidate_context := jsonb_strip_nulls(
        jsonb_build_object(
          'schema_version', 2,
          'signup_surface', 'web',
          'method',
            CASE
              WHEN v_event_metadata->>'method' IN (
                'email',
                'google',
                'apple'
              )
                THEN v_event_metadata->>'method'
              ELSE 'unknown'
            END,
          'entrypoint',
            COALESCE(
              NULLIF(v_event_metadata->>'entrypoint', ''),
              NULLIF(v_event_metadata->>'source', ''),
              'unknown'
            ),
          'landing_path',
            COALESCE(
              NULLIF(v_event_metadata->>'landing_path', ''),
              NULLIF(v_event_metadata->>'landing_page', '')
            ),
          'referrer_domain',
            NULLIF(v_event_metadata->>'referrer_domain', ''),
          'referrer',
            CASE
              WHEN v_event_metadata->>'referrer' = 'direct' THEN 'direct'
              ELSE NULL
            END,
          'utm',
            jsonb_strip_nulls(
              jsonb_build_object(
                'source', NULLIF(v_event_metadata->>'utm_source', ''),
                'medium', NULLIF(v_event_metadata->>'utm_medium', ''),
                'campaign', NULLIF(v_event_metadata->>'utm_campaign', ''),
                'content', NULLIF(v_event_metadata->>'utm_content', ''),
                'term', NULLIF(v_event_metadata->>'utm_term', '')
              )
            ),
          'source_capture_status',
            CASE
              WHEN COALESCE(
                NULLIF(v_event_metadata->>'referrer_domain', ''),
                CASE
                  WHEN v_event_metadata->>'referrer' = 'direct' THEN 'direct'
                  ELSE NULL
                END,
                NULLIF(v_event_metadata->>'utm_source', ''),
                NULLIF(v_event_metadata->>'utm_medium', ''),
                NULLIF(v_event_metadata->>'utm_campaign', ''),
                NULLIF(v_event_metadata->>'partner', ''),
                NULLIF(v_event_metadata->>'referral_code', '')
              ) IS NOT NULL
                THEN 'captured'
              ELSE 'missing'
            END,
          'captured_at', to_char(
            v_event_created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        )
      );
      v_evidence_source := 'linked_web_signup_event';
    END IF;
  END IF;

  -- Evidence precedence 3: linked_native_first_open_event.
  IF v_candidate_context IS NULL THEN
    SELECT
      ue.metadata,
      ue.created_at,
      COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform')
    INTO
      v_event_metadata,
      v_event_created_at,
      v_native_platform
    FROM public.user_events ue
    WHERE ue.user_id = p_user_id
      AND ue.event_type = 'native_app_first_open'
      AND ue.created_at >= v_profile_created_at - interval '24 hours'
      AND ue.created_at < v_profile_created_at + interval '24 hours'
      AND COALESCE(ue.bot_flagged, false) = false
      AND COALESCE(ue.metadata->>'is_emulator', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'is_test', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'_is_test', 'false') NOT IN ('true', '1')
      AND COALESCE(ue.metadata->>'platform', ue.metadata->>'_platform') IN (
        'ios',
        'android',
        'native-ios',
        'native-android'
      )
    ORDER BY
      ABS(EXTRACT(EPOCH FROM (ue.created_at - v_profile_created_at))),
      ue.created_at
    LIMIT 1;

    IF FOUND THEN
      v_candidate_context := jsonb_build_object(
        'schema_version', 2,
        'signup_surface',
          CASE
            WHEN v_native_platform IN ('ios', 'native-ios')
              THEN 'native_ios'
            ELSE 'native_android'
          END,
        'method', 'unknown',
        'entrypoint',
          COALESCE(NULLIF(v_event_metadata->>'source', ''), 'native_app'),
        'source_capture_status', 'missing',
        'captured_at', to_char(
          v_event_created_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      );
      v_evidence_source := 'linked_native_first_open_event';
    END IF;
  END IF;

  IF v_candidate_context IS NULL THEN
    IF v_existing_context <> '{}'::jsonb THEN
      v_attribution_outcome := 'preserved';
      v_evidence_source := 'existing_profile_context';
    END IF;

    RETURN jsonb_build_object(
      'linked', v_linked_count,
      'attribution_outcome', v_attribution_outcome,
      'signup_surface', v_signup_surface,
      'evidence_source', v_evidence_source
    );
  END IF;

  -- Existing values win. Candidate values fill only missing keys.
  v_merged_context := v_candidate_context || v_existing_context;

  IF jsonb_typeof(v_candidate_context->'utm') = 'object'
     OR jsonb_typeof(v_existing_context->'utm') = 'object' THEN
    v_merged_context := jsonb_set(
      v_merged_context,
      '{utm}',
      COALESCE(v_candidate_context->'utm', '{}'::jsonb)
        || COALESCE(v_existing_context->'utm', '{}'::jsonb),
      true
    );
  END IF;

  IF v_merged_context IS DISTINCT FROM v_existing_context THEN
    UPDATE public.profiles
    SET
      signup_context = v_merged_context,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  v_signup_surface := COALESCE(
    NULLIF(v_merged_context->>'signup_surface', ''),
    'unknown'
  );

  IF v_existing_surface IS NOT NULL THEN
    v_attribution_outcome := 'preserved';
  ELSE
    v_attribution_outcome := 'materialized';
  END IF;

  RETURN jsonb_build_object(
    'linked', v_linked_count,
    'attribution_outcome', v_attribution_outcome,
    'signup_surface', v_signup_surface,
    'evidence_source', v_evidence_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.link_anonymous_events_v2(uuid, uuid, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_anonymous_events_v2(uuid, uuid, jsonb)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_anonymous_events_v2(uuid, uuid, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.link_anonymous_events_v2(uuid, uuid, jsonb) IS
  'Links anonymous events from the prior 30 days and fills missing acquisition context for profiles created in the prior 24 hours. Existing first-touch values always win. Service-role only.';

COMMIT;
