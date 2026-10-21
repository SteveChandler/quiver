-- SECURITY DEFINER RPCs that take a user id were executable by every signed-in user and
-- never checked auth.uid(), so any account could write activities, invites and wave
-- observations as another user, claim another email's pending alert captures, or read
-- another user's storage usage and private-session totals.
--
-- Signed-in self calls (web server actions and /auth/callback with the user's cookie
-- session) now must match auth.uid(). None of these have a service-role caller.
-- notify_session_invite has no caller anywhere; sync_session_wave_observation_candidate is
-- only called by the postgres-owned SECURITY DEFINER triggers
-- create_session_forecast_snapshot and apply_submit_wave_height_source_to_session, which
-- run as postgres. Both lose client EXECUTE. Later migrations that CREATE OR REPLACE
-- sync_session_wave_observation_candidate must not grant it back to authenticated.
--
-- get_profile_stats stays callable for other users (native UserProfileScreen shows another
-- surfer's totals) but becomes SECURITY INVOKER, so sessions RLS limits other viewers to
-- public sessions, the same count web's getUserMetadata already shows. Owners still see
-- every session.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_activity(p_user_id uuid, p_activity_type character varying, p_entity_type character varying, p_entity_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  activity_id uuid;
begin
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'create_activity requires the authenticated owner'
      USING ERRCODE = '42501';
  END IF;

  insert into public.user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  values (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  returning id into activity_id;

  return activity_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_anon_alert_capture(p_user_id uuid, p_email text)
 RETURNS TABLE(capture_id uuid, beach_id uuid, preset_type text, return_path text, captured_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'finalize_anon_alert_capture requires the authenticated owner'
      USING ERRCODE = '42501';
  END IF;

  -- Captures are keyed by email, so the email must also be the caller's own.
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'finalize_anon_alert_capture email must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH claimed_captures AS (
    UPDATE public.pending_alert_captures AS pac
    SET
      consumed_at = NOW(),
      consumed_user_id = p_user_id
    WHERE pac.email = lower(p_email)
      AND pac.consumed_at IS NULL
      AND pac.expires_at > NOW()
    RETURNING
      pac.id AS capture_id,
      pac.beach_id,
      pac.preset_type,
      pac.return_path,
      pac.captured_at
  ),
  inserted_rules AS (
    INSERT INTO public.alert_rules (
      user_id,
      beach_id,
      name,
      preset_type,
      conditions,
      notify_email,
      notify_push,
      enabled
    )
    SELECT
      p_user_id,
      cc.beach_id,
      public.preset_default_name(cc.preset_type, cc.beach_id),
      cc.preset_type,
      public.preset_default_conditions(cc.preset_type, cc.beach_id),
      true,
      false,
      true
    FROM claimed_captures cc
    RETURNING public.alert_rules.id
  ),
  first_claim AS (
    SELECT cc.beach_id
    FROM claimed_captures cc
    ORDER BY cc.captured_at ASC
    LIMIT 1
  ),
  updated_profile AS (
    UPDATE public.profiles p
    SET
      home_beach_id = COALESCE(p.home_beach_id, fc.beach_id),
      signup_context = jsonb_set(
        COALESCE(p.signup_context, '{}'::jsonb),
        '{entrypoint}',
        '"anon_alert_capture"'::jsonb
      )
    FROM first_claim fc
    WHERE p.id = p_user_id
    RETURNING p.id
  )
  SELECT
    cc.capture_id,
    cc.beach_id,
    cc.preset_type,
    cc.return_path,
    cc.captured_at
  FROM claimed_captures cc
  ORDER BY cc.captured_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_storage_stats(p_user_id uuid)
 RETURNS TABLE(total_bytes bigint, image_count integer, remaining_bytes bigint, usage_percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  user_limit CONSTANT BIGINT := 104857600; -- 100MB per user
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'get_user_storage_stats requires the authenticated owner'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(su.total_bytes, 0) as total_bytes,
    COALESCE(su.image_count, 0) as image_count,
    GREATEST(0, user_limit - COALESCE(su.total_bytes, 0)) as remaining_bytes,
    ROUND((COALESCE(su.total_bytes, 0)::NUMERIC / user_limit::NUMERIC) * 100, 2) as usage_percentage
  FROM public.storage_usage su
  WHERE su.user_id = p_user_id
  UNION ALL
  SELECT 0::BIGINT, 0::INTEGER, user_limit, 0.00::NUMERIC
  WHERE NOT EXISTS (SELECT 1 FROM public.storage_usage WHERE user_id = p_user_id)
  LIMIT 1;
END;
$function$;

ALTER FUNCTION public.get_profile_stats(uuid) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.notify_session_invite(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.notify_session_invite(uuid, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) TO service_role;

COMMIT;
