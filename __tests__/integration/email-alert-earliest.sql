\set ON_ERROR_STOP on
-- Idea 7: a condition alert email may start at profiles.alert_email_earliest; lifecycle email keeps 09:00.
BEGIN;
DO $$
DECLARE
  u uuid := '55555555-5555-4555-8555-555555555555';
  d jsonb;
  dawn_zone text;
  night_zone text;
BEGIN
  UPDATE public.email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=NULL WHERE singleton;
  -- A zone where it is 05:00-08:59 now, and one where it is 03:00-04:59 now.
  SELECT name INTO dawn_zone FROM pg_catalog.pg_timezone_names
    WHERE (now() AT TIME ZONE name)::time BETWEEN time '05:00' AND time '08:59:59' ORDER BY name LIMIT 1;
  SELECT name INTO night_zone FROM pg_catalog.pg_timezone_names
    WHERE (now() AT TIME ZONE name)::time BETWEEN time '03:00' AND time '04:59:59' ORDER BY name LIMIT 1;
  ASSERT dawn_zone IS NOT NULL AND night_zone IS NOT NULL;

  INSERT INTO auth.users(id,email,created_at,email_confirmed_at) VALUES (u,'alert-earliest@example.com',now()-interval '22 days',now()-interval '22 days');
  INSERT INTO public.profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone,home_beach_id)
  VALUES (u,'alert-earliest@example.com',true,true,dawn_zone,NULL);
  INSERT INTO public.email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,
    entitlement_verified_until,entitlement_reference,provider_access_active)
  VALUES (u,'startup-lifecycle-v1',now(),'alert earliest fixture',now(),now()+interval '1 hour','fixture',false);
  INSERT INTO public.user_entitlements(user_id,is_pro,is_trialing) VALUES (u,false,false);
  INSERT INTO public.alert_rules(user_id,enabled,notify_email) VALUES (u,true,true);

  -- Never set: today's rule, so a dawn alert waits for 09:00.
  ASSERT (SELECT alert_email_earliest FROM public.profiles WHERE id=u)='09:00';
  d := public.claim_requested_email_alert(u,'earliest-default','{"to":"alert-earliest@example.com","html":"hello"}');
  ASSERT d->>'reason'='quiet_hours',d::text;

  -- 05:00 lets the same dawn alert through.
  UPDATE public.profiles SET alert_email_earliest='05:00' WHERE id=u;
  d := public.claim_requested_email_alert(u,'earliest-dawn','{"to":"alert-earliest@example.com","html":"hello"}');
  ASSERT (d->>'allowed')::boolean,d::text;
  DELETE FROM public.email_contact_attempts WHERE user_id=u;

  -- Before 05:00 is still quiet.
  UPDATE public.profiles SET timezone=night_zone WHERE id=u;
  d := public.claim_requested_email_alert(u,'earliest-night','{"to":"alert-earliest@example.com","html":"hello"}');
  ASSERT d->>'reason'='quiet_hours',d::text;

  -- Lifecycle email still waits for 09:00 local, whatever the alert setting.
  UPDATE public.profiles SET timezone=dawn_zone WHERE id=u;
  INSERT INTO public.user_events(user_id,bot_flagged,event_type,created_at) VALUES
    (u,false,'beach_view',now()-interval '1 day'),(u,false,'beach_view',now()-interval '3 days');
  d := public.evaluate_email_lifecycle(u);
  ASSERT d ? 'next_eligible_at',d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE dawn_zone)::time >= time '09:00',d::text;

  -- Only the four values exist.
  BEGIN
    UPDATE public.profiles SET alert_email_earliest='08:00' WHERE id=u;
    RAISE EXCEPTION 'check constraint accepted 08:00';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET alert_email_earliest=NULL WHERE id=u;
    RAISE EXCEPTION 'column accepted NULL';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;

  ASSERT has_column_privilege('authenticated','public.profiles','alert_email_earliest','SELECT');
  ASSERT has_column_privilege('authenticated','public.profiles','alert_email_earliest','UPDATE');
END $$;
ROLLBACK;
