\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  u uuid := '77777777-7777-4777-8777-777777777777';
  honolulu_beach uuid := '88888888-8888-4888-8888-888888888888';
  invalid_beach uuid := '99999999-9999-4999-8999-999999999999';
  d jsonb;
  resolved_timezone text;
  local_now timestamp;
  utc_day timestamp;
  los_angeles_now timestamp;
  outside_timezone text;
  inside_timezone text;
  boundary_timezone text;
  next_eligible timestamptz;
BEGIN
  UPDATE public.email_contact_controls
  SET enabled=true,lifecycle_enabled=true,daily_cap=NULL
  WHERE singleton;

  INSERT INTO public.beaches(id,timezone)
  VALUES (honolulu_beach,'Pacific/Honolulu'),(invalid_beach,'not/a_timezone');
  INSERT INTO auth.users(id,email,created_at)
  VALUES (u,'timezone-fallback@example.com',now()-interval '22 days');
  INSERT INTO public.profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone,home_beach_id)
  VALUES (u,'timezone-fallback@example.com',true,true,NULL,NULL);
  INSERT INTO public.email_contact_state(
    user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,
    entitlement_verified_until,entitlement_reference,provider_access_active
  )
  VALUES (u,'startup-lifecycle-v1',now(),'timezone fallback fixture',now(),now()+interval '1 hour','fixture',false);
  INSERT INTO public.user_entitlements(user_id,is_pro,is_trialing)
  VALUES (u,false,false);
  INSERT INTO public.alert_rules(user_id,enabled,notify_email)
  VALUES (u,true,true);

  -- These UTC timestamps are distinct local dates in Los Angeles and one date in Honolulu.
  utc_day := date_trunc('day',now() AT TIME ZONE 'UTC')-interval '1 day';
  INSERT INTO public.user_events(user_id,bot_flagged,event_type,created_at)
  VALUES
    (u,false,'beach_view',(utc_day+time '06:30') AT TIME ZONE 'UTC'),
    (u,false,'forecast_check',(utc_day+time '08:30') AT TIME ZONE 'UTC');

  -- A missing profile and home beach resolves to Los Angeles for active-day counting and quiet hours.
  SELECT public.email_contact_timezone(timezone,home_beach_id)
    INTO resolved_timezone FROM public.profiles WHERE id=u;
  ASSERT resolved_timezone='America/Los_Angeles',resolved_timezone;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='routine' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time >= time '09:00'
    AND ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time < time '17:00',d::text;

  local_now := now() AT TIME ZONE resolved_timezone;
  d := public.claim_requested_email_alert(u,'timezone-la','{"to":"timezone-fallback@example.com","html":"hello"}');
  IF local_now::time NOT BETWEEN time '09:00' AND time '16:59:59' THEN
    ASSERT d->>'reason'='quiet_hours',d::text;
  ELSE
    ASSERT (d->>'allowed')::boolean,d::text;
  END IF;
  DELETE FROM public.email_contact_attempts WHERE user_id=u;

  -- The home beach is used when the profile timezone is missing.
  UPDATE public.profiles SET home_beach_id=honolulu_beach WHERE id=u;
  UPDATE auth.users SET created_at=now()-interval '4 days' WHERE id=u;
  DELETE FROM public.user_events WHERE user_id=u;
  INSERT INTO public.user_events(user_id,bot_flagged,event_type,created_at)
  VALUES (u,false,'beach_view',now()-interval '1 day');
  SELECT public.email_contact_timezone(timezone,home_beach_id)
    INTO resolved_timezone FROM public.profiles WHERE id=u;
  ASSERT resolved_timezone='Pacific/Honolulu',resolved_timezone;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time >= time '09:00'
    AND ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time < time '17:00',d::text;
  local_now := now() AT TIME ZONE resolved_timezone;
  d := public.claim_requested_email_alert(u,'timezone-honolulu','{"to":"timezone-fallback@example.com","html":"hello"}');
  IF local_now::time NOT BETWEEN time '09:00' AND time '16:59:59' THEN
    ASSERT d->>'reason'='quiet_hours',d::text;
  ELSE
    ASSERT (d->>'allowed')::boolean,d::text;
  END IF;
  DELETE FROM public.email_contact_attempts WHERE user_id=u;

  -- Invalid profile and beach timezones reach the Los Angeles fallback.
  UPDATE public.profiles SET timezone='invalid',home_beach_id=invalid_beach WHERE id=u;
  SELECT public.email_contact_timezone(timezone,home_beach_id)
    INTO resolved_timezone FROM public.profiles WHERE id=u;
  ASSERT resolved_timezone='America/Los_Angeles',resolved_timezone;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time >= time '09:00'
    AND ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time < time '17:00',d::text;
  local_now := now() AT TIME ZONE resolved_timezone;
  d := public.claim_requested_email_alert(u,'timezone-invalid','{"to":"timezone-fallback@example.com","html":"hello"}');
  IF local_now::time NOT BETWEEN time '09:00' AND time '16:59:59' THEN
    ASSERT d->>'reason'='quiet_hours',d::text;
  ELSE
    ASSERT (d->>'allowed')::boolean,d::text;
  END IF;
  DELETE FROM public.email_contact_attempts WHERE user_id=u;

  -- A valid profile timezone takes precedence over a different valid home beach timezone.
  UPDATE public.profiles SET timezone='America/Los_Angeles',home_beach_id=honolulu_beach WHERE id=u;
  SELECT public.email_contact_timezone(timezone,home_beach_id)
    INTO resolved_timezone FROM public.profiles WHERE id=u;
  ASSERT resolved_timezone='America/Los_Angeles',resolved_timezone;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time >= time '09:00'
    AND ((d->>'next_eligible_at')::timestamptz AT TIME ZONE resolved_timezone)::time < time '17:00',d::text;
  local_now := now() AT TIME ZONE resolved_timezone;
  d := public.claim_requested_email_alert(u,'timezone-profile-wins','{"to":"timezone-fallback@example.com","html":"hello"}');
  IF local_now::time NOT BETWEEN time '09:00' AND time '16:59:59' THEN
    ASSERT d->>'reason'='quiet_hours',d::text;
  ELSE
    ASSERT (d->>'allowed')::boolean,d::text;
  END IF;
  -- Select zones on each side of quiet hours so alert claims test both outcomes at this instant.
  los_angeles_now := now() AT TIME ZONE 'America/Los_Angeles';
  SELECT name INTO outside_timezone
  FROM pg_catalog.pg_timezone_names
  WHERE (now() AT TIME ZONE name)::time NOT BETWEEN time '09:00' AND time '16:59:59'
  ORDER BY name LIMIT 1;
  SELECT name INTO inside_timezone
  FROM pg_catalog.pg_timezone_names
  WHERE (now() AT TIME ZONE name)::time BETWEEN time '09:00' AND time '16:59:59'
  ORDER BY name LIMIT 1;
  ASSERT outside_timezone IS NOT NULL AND inside_timezone IS NOT NULL;

  UPDATE public.profiles SET timezone=outside_timezone,home_beach_id=honolulu_beach WHERE id=u;
  resolved_timezone := public.email_contact_timezone(outside_timezone,honolulu_beach);
  ASSERT resolved_timezone=outside_timezone,resolved_timezone;
  d := public.claim_requested_email_alert(u,'timezone-dynamic-outside','{"to":"timezone-fallback@example.com","html":"hello"}');
  ASSERT d->>'reason'='quiet_hours',d::text;
  DELETE FROM public.email_contact_attempts WHERE user_id=u;

  UPDATE public.profiles SET timezone=inside_timezone WHERE id=u;
  resolved_timezone := public.email_contact_timezone(inside_timezone,honolulu_beach);
  ASSERT resolved_timezone=inside_timezone,resolved_timezone;
  d := public.claim_requested_email_alert(u,'timezone-dynamic-inside','{"to":"timezone-fallback@example.com","html":"hello"}');
  ASSERT (d->>'allowed')::boolean,d::text;
  DELETE FROM public.email_contact_attempts WHERE user_id=u;

  -- Evaluate at now with a due activation; pick a profile zone opposite Los Angeles.
  IF los_angeles_now::time BETWEEN time '09:00' AND time '16:59:59' THEN
    boundary_timezone := outside_timezone;
  ELSE
    boundary_timezone := inside_timezone;
  END IF;
  UPDATE public.profiles SET timezone=boundary_timezone WHERE id=u;
  d := public.evaluate_email_lifecycle(u);
  next_eligible := (d->>'next_eligible_at')::timestamptz;
  ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT (next_eligible AT TIME ZONE boundary_timezone)::time >= time '09:00'
    AND (next_eligible AT TIME ZONE boundary_timezone)::time < time '17:00',d::text;
  IF (now() AT TIME ZONE boundary_timezone)::time BETWEEN time '09:00' AND time '16:59:59' THEN
    ASSERT next_eligible=now(),d::text;
  ELSE
    ASSERT next_eligible>now(),d::text;
  END IF;

  ASSERT public.email_contact_timezone(NULL::text,NULL::uuid)='America/Los_Angeles';
END $$;
ROLLBACK;
