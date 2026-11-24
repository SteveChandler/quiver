\set ON_ERROR_STOP on
-- Idea 3: a verified trial that opened a forecast gets the normal stage rules, not silence.
BEGIN;
DO $$
DECLARE
  u uuid := '66666666-6666-4666-8666-666666666666';
  d jsonb;
  tz text := 'America/Los_Angeles';
BEGIN
  UPDATE public.email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=NULL WHERE singleton;
  INSERT INTO auth.users(id,email,created_at,email_confirmed_at)
  VALUES (u,'trial-fall-through@example.com',now()-interval '1 day',now()-interval '1 day');
  INSERT INTO public.profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone,home_beach_id)
  VALUES (u,'trial-fall-through@example.com',true,true,tz,NULL);
  INSERT INTO public.email_contact_state(
    user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,
    entitlement_verified_until,entitlement_reference,provider_access_active,provider_trial
  )
  VALUES (u,'startup-lifecycle-v1',now(),'trial fall-through fixture',now(),now()+interval '1 hour','fixture',true,
    jsonb_build_object('product_id','pro','expires_at',now()+interval '13 days'));
  INSERT INTO public.user_entitlements(user_id,is_pro,is_trialing,product_id,trial_ends_at)
  VALUES (u,true,true,'pro',(SELECT (provider_trial->>'expires_at')::timestamptz FROM public.email_contact_state WHERE user_id=u));
  INSERT INTO public.revenuecat_provider_events(app_user_id_status,provider_event_id,app_user_id,environment,processed_at,product_id,period_type,event_type,purchased_at,expiration_at,event_timestamp)
  VALUES ('uuid','trial-fall-through',u,'PRODUCTION',now(),'pro','TRIAL','INITIAL_PURCHASE',now()-interval '20 hours',
    (SELECT trial_ends_at FROM public.user_entitlements WHERE user_id=u),now()-interval '20 hours');

  -- Not opened a forecast since purchase: trial_support stays, as before.
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='trial_support',d::text;

  -- Opened one: the trial user falls through to welcome (new account, nothing sent yet).
  INSERT INTO public.user_events(user_id,bot_flagged,event_type,created_at)
  VALUES (u,false,'home_hero_forecast_viewed',now()-interval '2 hours');
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'reason' IS DISTINCT FROM 'trial_target_reached',d::text;
  ASSERT d->>'job'='welcome' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT d->'source'->>'audience'='trial',d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE tz)::time >= time '09:00'
    AND ((d->>'next_eligible_at')::timestamptz AT TIME ZONE tz)::time < time '17:00',d::text;

  -- Day 3 with no sessions and recent use: activation is due for the trial user.
  UPDATE auth.users SET created_at=now()-interval '4 days' WHERE id=u;
  UPDATE public.revenuecat_provider_events SET purchased_at=now()-interval '3 days',event_timestamp=now()-interval '3 days'
  WHERE provider_event_id='trial-fall-through';
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='activation' AND d->>'status' IN ('due','deferred'),d::text;
  ASSERT ((d->>'next_eligible_at')::timestamptz AT TIME ZONE tz)::time >= time '09:00'
    AND ((d->>'next_eligible_at')::timestamptz AT TIME ZONE tz)::time < time '17:00',d::text;

  -- The 72 h cadence still applies to the trial user.
  INSERT INTO public.email_send_log(user_id,email_type,resend_message_id,sent_at,subject,local_date,meta)
  VALUES (u,'trial_started','trial-fall-through-log',now()-interval '1 hour','fixture',current_date,'{}');
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='activation' AND d->>'status' IN ('deferred','expired'),d::text;
  ASSERT (d->>'next_eligible_at')::timestamptz >= now()+interval '70 hours',d::text;
  DELETE FROM public.email_send_log WHERE user_id=u;

  -- A forecast view from before the purchase does not count, so trial_support returns.
  UPDATE public.user_events SET created_at=now()-interval '4 days' WHERE user_id=u;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='trial_support',d::text;
  UPDATE public.user_events SET created_at=now()-interval '2 hours' WHERE user_id=u;

  -- An unverified trial is still held, whether or not it opened a forecast.
  UPDATE public.email_contact_state SET provider_trial=jsonb_build_object('product_id','other','expires_at',now()+interval '13 days') WHERE user_id=u;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'status'='held' AND d->>'reason'='trial_unverified',d::text;

  -- Opt-out holds still win.
  UPDATE public.email_contact_state SET provider_trial=jsonb_build_object('product_id','pro','expires_at',(SELECT trial_ends_at FROM public.user_entitlements WHERE user_id=u)),paused_at=now() WHERE user_id=u;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'reason'='reply_paused',d::text;
END $$;
ROLLBACK;

-- A trial user who never opens a forecast: after trial_support was attempted, the stage rules apply (friction on day 7-10).
BEGIN;
DO $$
DECLARE
  u uuid := '66666666-6666-4666-8666-666666666667';
  d jsonb;
  a uuid;
BEGIN
  UPDATE public.email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=NULL WHERE singleton;
  INSERT INTO auth.users(id,email,created_at,email_confirmed_at)
  VALUES (u,'trial-friction@example.com',now()-interval '8 days',now()-interval '8 days');
  INSERT INTO public.profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone,home_beach_id)
  VALUES (u,'trial-friction@example.com',true,true,'America/Los_Angeles',NULL);
  INSERT INTO public.email_contact_state(
    user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,
    entitlement_verified_until,entitlement_reference,provider_access_active,provider_trial
  )
  VALUES (u,'startup-lifecycle-v1',now(),'trial friction fixture',now(),now()+interval '1 hour','fixture',true,
    jsonb_build_object('product_id','pro','expires_at',date_trunc('second',now())+interval '9 days'));
  INSERT INTO public.user_entitlements(user_id,is_pro,is_trialing,product_id,trial_ends_at)
  VALUES (u,true,true,'pro',date_trunc('second',now())+interval '9 days');
  INSERT INTO public.revenuecat_provider_events(app_user_id_status,provider_event_id,app_user_id,environment,processed_at,product_id,period_type,event_type,purchased_at,expiration_at,event_timestamp)
  VALUES ('uuid','trial-friction',u,'PRODUCTION',now(),'pro','TRIAL','INITIAL_PURCHASE',now()-interval '5 days',
    date_trunc('second',now())+interval '9 days',now()-interval '5 days');

  -- Day 5 of the trial, no attempt yet: trial_support is still the job.
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='trial_support',d::text;

  -- trial_support was sent 4 days ago: the user is no longer held on it; friction (day 8, away 4+ days) is the job.
  INSERT INTO public.email_contact_attempts(user_id,email_type,campaign_id,campaign_version,lifecycle_job,episode,state,claimed_at,sent_at,provider_id)
  VALUES (u,'trial_started','startup-lifecycle-v1',1,'trial_support','trial-friction','accepted',now()-interval '4 days',now()-interval '4 days','trial-friction-provider')
  RETURNING id INTO a;
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='friction' AND d->>'status' IN ('due','deferred'),d::text;

  -- The claim's own re-check ignores its attempt, so trial_support still verifies itself.
  d := public.evaluate_email_lifecycle(u,a);
  ASSERT d->>'job'='trial_support',d::text;

  -- An expired trial_support slot (day 7+ of the trial) also falls through, with no attempt.
  DELETE FROM public.email_contact_attempts WHERE id=a;
  UPDATE public.revenuecat_provider_events SET purchased_at=now()-interval '7 days 1 hour',event_timestamp=now()-interval '7 days 1 hour'
  WHERE provider_event_id='trial-friction';
  d := public.evaluate_email_lifecycle(u);
  ASSERT d->>'job'='friction',d::text;
END $$;
ROLLBACK;
