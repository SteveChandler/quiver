BEGIN;
-- Allow NULL to mean no internal cap; enabled/lifecycle_enabled remains the disabled signal.
ALTER TABLE public.email_contact_controls ALTER COLUMN daily_cap DROP NOT NULL;
ALTER TABLE public.email_contact_controls ALTER COLUMN daily_cap DROP DEFAULT;
ALTER TABLE public.email_contact_controls DROP CONSTRAINT IF EXISTS email_contact_controls_daily_cap_check;
ALTER TABLE public.email_contact_controls ADD CONSTRAINT email_contact_controls_daily_cap_check CHECK (daily_cap IS NULL OR daily_cap > 0);

CREATE OR REPLACE FUNCTION public.claim_requested_email_alert(p_user_id uuid, p_episode text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE p public.profiles%ROWTYPE; a uuid; v_cap integer;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 IF NOT EXISTS (SELECT 1 FROM public.email_contact_controls WHERE singleton AND enabled AND lifecycle_enabled) THEN
  RETURN jsonb_build_object('allowed',false,'reason','disabled');
 END IF;
 SELECT daily_cap INTO v_cap FROM public.email_contact_controls WHERE singleton;
 SELECT * INTO p FROM public.profiles WHERE id=p_user_id;
 IF p.analytics_is_real_user IS DISTINCT FROM true OR p.notif_email_enabled IS DISTINCT FROM true
  OR lower(trim(p.email)) IS DISTINCT FROM lower(trim(p_payload->>'to'))
  OR NOT EXISTS(SELECT 1 FROM public.alert_rules WHERE user_id=p_user_id AND enabled AND notify_email)
  OR EXISTS(SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(p.email)))
  OR EXISTS(SELECT 1 FROM public.email_contact_state WHERE user_id=p_user_id AND paused_at IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.user_email_prefs WHERE user_id=p_user_id AND email_frequency='off')
  OR (SELECT count(*) FROM public.profiles WHERE lower(trim(email))=lower(trim(p.email)))<>1
 THEN RETURN jsonb_build_object('allowed',false,'reason','ineligible_or_suppressed'); END IF;
 IF p.timezone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p.timezone) THEN
  RETURN jsonb_build_object('allowed',false,'reason','timezone_unknown'); END IF;
 IF (now() AT TIME ZONE p.timezone)::time NOT BETWEEN time '09:00' AND time '16:59:59' THEN
  RETURN jsonb_build_object('allowed',false,'reason','quiet_hours'); END IF;
 IF EXISTS(SELECT 1 FROM public.email_contact_attempts WHERE user_id=p_user_id AND state NOT IN ('cancelled','failed')
   AND (provider_id IS NULL OR claimed_at>now()-interval '24 hours' OR (lifecycle_job='conditions_alert' AND episode=p_episode)))
  OR EXISTS(SELECT 1 FROM public.email_send_log WHERE user_id=p_user_id AND sent_at>now()-interval '24 hours')
  OR EXISTS(SELECT 1 FROM public.email_contact_state WHERE user_id=p_user_id AND manual_contact_at>now()-interval '7 days')
 THEN RETURN jsonb_build_object('allowed',false,'reason','contact_cooldown_or_unknown'); END IF;
 IF (SELECT count(*) FROM public.email_contact_attempts WHERE user_id=p_user_id AND state NOT IN ('cancelled','failed') AND email_type='conditions_alert' AND claimed_at>now()-interval '7 days')>=3
  OR (SELECT count(*) FROM (
    SELECT claimed_at AS at FROM public.email_contact_attempts WHERE state NOT IN ('cancelled','failed')
    UNION ALL SELECT sent_at FROM public.email_send_log l WHERE NOT EXISTS
      (SELECT 1 FROM public.email_contact_attempts a WHERE a.provider_id=l.resend_message_id)
   ) history WHERE at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=v_cap AND v_cap IS NOT NULL
 THEN RETURN jsonb_build_object('allowed',false,'reason','contact_cap'); END IF;
 IF nullif(p_episode,'') IS NULL OR length(p_episode)>4000 OR nullif(p_payload->>'html','') IS NULL THEN RAISE EXCEPTION 'Invalid alert payload'; END IF;
 INSERT INTO public.email_contact_attempts(user_id,email_type,lifecycle_job,episode,state,handoff_at,payload)
 VALUES(p_user_id,'conditions_alert','conditions_alert',p_episode,'handoff_started',now(),p_payload) RETURNING id INTO a;
 RETURN jsonb_build_object('allowed',true,'attempt_id',a);
END; $function$
REVOKE ALL ON FUNCTION public.claim_requested_email_alert(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_requested_email_alert(uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.evaluate_email_lifecycle(p_user_id uuid, p_ignore_attempt uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n timestamptz := now(); p public.profiles%ROWTYPE; s public.email_contact_state%ROWTYPE;
  c public.email_campaigns%ROWTYPE; e public.user_entitlements%ROWTYPE;
  t public.revenuecat_provider_events%ROWTYPE; registered timestamptz; feedback_trial jsonb;
  job text; v_episode text := 'onboarding'; reason text; due timestamptz; expiry timestamptz;
  next_at timestamptz; last_use timestamptz; last_completion timestamptz; count_sessions integer;
  offer public.pro_offer_awards%ROWTYPE; audience text;
  active_days integer; contacts timestamptz[]; local_time timestamp; result jsonb; cap integer;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id=p_user_id;
  SELECT * INTO s FROM public.email_contact_state WHERE user_id=p_user_id;
  SELECT * INTO c FROM public.email_campaigns WHERE id=s.approved_campaign;
  SELECT created_at INTO registered FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL
    AND lower(trim(email))=lower(trim(p.email));
  SELECT * INTO e FROM public.user_entitlements WHERE user_id=p_user_id;
  IF p.deleted_at IS NOT NULL OR registered IS NULL OR p.analytics_is_real_user IS DISTINCT FROM true OR p.notif_email_enabled IS DISTINCT FROM true THEN reason := 'ineligible_profile';
  ELSIF (SELECT count(*) FROM public.profiles WHERE lower(trim(email))=lower(trim(p.email))) <> 1 THEN reason := 'ambiguous_identity';
  ELSIF EXISTS (SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(p.email)))
    OR EXISTS (SELECT 1 FROM public.user_email_prefs WHERE user_id=p_user_id AND email_frequency='off') THEN reason := 'suppressed';
  ELSIF s.paused_at IS NOT NULL THEN reason := 'reply_paused';
  ELSIF NOT public.lifecycle_permission_verified(s)
    OR s.history_reviewed_at IS NULL OR s.history_reviewed_at > n THEN reason := 'consent_or_history_unknown';
  ELSIF s.entitlement_verified_until IS NULL OR s.entitlement_verified_until <= n OR s.entitlement_verified_until > n+interval '24 hours'
    OR nullif(trim(s.entitlement_reference),'') IS NULL THEN reason := 'entitlement_review_stale';
  ELSIF c.id IS NULL OR c.status <> 'approved' OR c.approved_at > n OR c.expires_at <= n THEN reason := 'campaign_unapproved';
  ELSIF p.timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p.timezone) THEN reason := 'timezone_unknown';
  END IF;
  IF reason IS NOT NULL THEN RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','held','reason',reason); END IF;

  SELECT count(*), max(email_completed_at) INTO count_sessions,last_completion FROM public.sessions
    WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL;
  SELECT max(at),count(DISTINCT (at AT TIME ZONE p.timezone)::date) FILTER (WHERE at>n-interval '14 days')
    INTO last_use,active_days FROM (
      SELECT created_at AS at FROM public.user_events WHERE user_id=p_user_id AND bot_flagged IS NOT TRUE
        AND event_type IN ('beach_view','forecast_check','home_beach_forecast_viewed','home_hero_forecast_viewed')
        AND created_at BETWEEN n-interval '30 days' AND n
      UNION ALL SELECT email_completed_at FROM public.sessions WHERE user_id=p_user_id
        AND status='completed' AND deleted_at IS NULL AND email_completed_at<=n
    ) activity;

  IF s.provider_access_active IS NULL THEN
    RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','held','reason','entitlement_unknown');
  END IF;
  audience := CASE WHEN e.is_trialing THEN 'trial'
    WHEN e.is_pro OR s.provider_access_active OR EXISTS (
      SELECT 1 FROM public.earned_pro_grants WHERE user_id=p_user_id AND revoked_at IS NULL AND expires_at>n
    ) THEN 'entitled' ELSE 'free' END;

  SELECT a.* INTO offer FROM public.pro_offer_awards a JOIN public.pro_offer_programs program ON program.id=a.program_id
    WHERE audience='free' AND a.user_id=p_user_id AND a.state<>'verified' AND a.claim_requested_at IS NULL AND program.enabled
    ORDER BY CASE WHEN a.program_id='return_three_months' THEN 0 ELSE 1 END,a.earned_at NULLS LAST,a.enrolled_at LIMIT 1;

  IF EXISTS(SELECT 1 FROM public.trial_feedback_controls WHERE singleton AND enabled)
    AND NOT EXISTS(SELECT 1 FROM public.trial_feedback_submissions WHERE user_id=p_user_id) THEN
    feedback_trial:=public.current_feedback_trial(p_user_id);
  END IF;
  IF feedback_trial IS NOT NULL THEN
    job:='trial_feedback'; v_episode:=feedback_trial->>'trial_event_id';
    due:=(feedback_trial->>'cancelled_at')::timestamptz+interval '24 hours';
    expiry:=least((feedback_trial->>'cancelled_at')::timestamptz+interval '7 days',(feedback_trial->>'trial_ends_at')::timestamptz);
  ELSIF e.is_trialing THEN
    SELECT * INTO t FROM public.revenuecat_provider_events WHERE app_user_id=p_user_id
      AND environment='PRODUCTION' AND processed_at IS NOT NULL AND product_id=e.product_id
      AND period_type='TRIAL' AND event_type IN ('INITIAL_PURCHASE','RENEWAL')
      AND purchased_at<=n AND expiration_at=e.trial_ends_at ORDER BY event_timestamp DESC LIMIT 1;
    IF t.provider_event_id IS NULL OR e.trial_ends_at<=n OR e.is_pro IS DISTINCT FROM true OR s.provider_access_active IS DISTINCT FROM true OR s.provider_trial->>'product_id' IS DISTINCT FROM e.product_id OR (s.provider_trial->>'expires_at')::timestamptz IS DISTINCT FROM e.trial_ends_at THEN
      RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','held','reason','trial_unverified');
    END IF;
    IF EXISTS(SELECT 1 FROM public.user_events WHERE user_id=p_user_id AND bot_flagged IS NOT TRUE
      AND event_type IN ('home_surf_call_tap','home_beach_forecast_viewed','home_hero_forecast_viewed')
      AND created_at BETWEEN t.purchased_at AND n) THEN
      RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','trial_target_reached');
    END IF;
    job := 'trial_support'; v_episode := t.provider_event_id; due := t.purchased_at+interval '24 hours';
    expiry := least(t.purchased_at+interval '7 days',e.trial_ends_at-interval '24 hours');
  ELSIF audience='free' AND EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND claim_requested_at IS NOT NULL AND earned_at IS NOT NULL AND state<>'verified') THEN
    RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','offer_claim_pending');
  ELSIF offer.earned_at IS NOT NULL THEN
    job:='offer_ready'; v_episode:=offer.id::text; due:=offer.earned_at; expiry:=offer.earned_at+interval '30 days';
  ELSIF n<registered+interval '48 hours' AND NOT EXISTS (
    SELECT 1 FROM public.email_send_log WHERE user_id=p_user_id AND email_type IN ('welcome','founder_story','trial_started')
  ) THEN job := 'welcome'; due := registered; expiry := registered+interval '48 hours';
  ELSIF n>=registered+interval '7 days' AND n<registered+interval '10 days' AND count_sessions<5
    AND coalesce(last_use,registered)<=n-interval '4 days' AND (last_completion IS NULL OR last_completion<=n-interval '4 days') THEN
    job := 'friction'; due := registered+interval '7 days'; expiry := registered+interval '10 days';
  ELSIF count_sessions=0 AND n<registered+interval '7 days' AND last_use>n-interval '7 days' THEN
    job := 'activation'; due := registered+interval '3 days'; expiry := registered+interval '7 days';
  ELSIF count_sessions BETWEEN 1 AND 4 AND last_completion IS NOT NULL AND n<registered+interval '21 days' AND last_use>n-interval '7 days' THEN
    job := 'progress'; due := last_completion+interval '72 hours'; expiry := registered+interval '21 days';
  ELSIF n>=registered+interval '21 days' AND n<registered+interval '28 days' AND active_days>=2 AND last_use>n-interval '7 days' THEN
    job := 'routine'; due := registered+interval '21 days'; expiry := registered+interval '28 days';
  ELSE RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','no_relevant_job');
  END IF;

  -- Existing unverified log rows count as history, never as proof of delivery.
  IF EXISTS (SELECT 1 FROM public.email_send_log WHERE user_id=p_user_id AND email_type = CASE job
    WHEN 'welcome' THEN 'welcome' WHEN 'activation' THEN 'first_session_nudge' WHEN 'progress' THEN 'session_prompt'
    WHEN 'trial_support' THEN 'trial_started' ELSE '__new_stage__' END)
    OR EXISTS (SELECT 1 FROM public.email_contact_attempts WHERE user_id=p_user_id AND lifecycle_job=job AND episode=v_episode
      AND id IS DISTINCT FROM p_ignore_attempt AND state NOT IN ('cancelled','failed')) THEN reason := 'already_attempted'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_contact_attempts WHERE user_id=p_user_id AND provider_id IS NULL
    AND id IS DISTINCT FROM p_ignore_attempt AND state NOT IN ('cancelled','failed')) THEN reason := 'unresolved_handoff'; END IF;

  SELECT array_agg(at ORDER BY at DESC) INTO contacts FROM (
    SELECT coalesce(sent_at,claimed_at) AS at FROM public.email_contact_attempts WHERE user_id=p_user_id
      AND id IS DISTINCT FROM p_ignore_attempt AND state NOT IN ('cancelled','failed')
    UNION ALL SELECT sent_at FROM public.email_send_log l WHERE user_id=p_user_id
      AND NOT EXISTS (SELECT 1 FROM public.email_contact_attempts a WHERE a.provider_id=l.resend_message_id)
  ) history WHERE at>n-interval '30 days';
  next_at := greatest(due,contacts[1]+interval '72 hours',s.manual_contact_at+interval '7 days');
  IF (SELECT count(*) FROM unnest(contacts) at WHERE at>n-interval '7 days')>=2 THEN next_at:=greatest(next_at,contacts[2]+interval '7 days'); END IF;
  IF cardinality(contacts)>=4 THEN next_at:=greatest(next_at,contacts[4]+interval '30 days'); END IF;
  SELECT daily_cap INTO cap FROM public.email_contact_controls WHERE singleton;
  IF cap IS NOT NULL AND (SELECT count(*) FROM (
      SELECT claimed_at AS at FROM public.email_contact_attempts WHERE state NOT IN ('cancelled','failed') AND id IS DISTINCT FROM p_ignore_attempt
      UNION ALL SELECT sent_at FROM public.email_send_log l WHERE NOT EXISTS
        (SELECT 1 FROM public.email_contact_attempts a WHERE a.provider_id=l.resend_message_id)
    ) history WHERE at>=date_trunc('day',n AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') >= cap THEN
    next_at:=greatest(next_at,(date_trunc('day',n AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC');
  END IF;
  next_at:=greatest(next_at,n);
  local_time:=next_at AT TIME ZONE p.timezone;
  IF local_time::time < time '09:00' THEN next_at:=(local_time::date+time '09:00') AT TIME ZONE p.timezone;
  ELSIF local_time::time >= time '17:00' THEN next_at:=((local_time::date+1)+time '09:00') AT TIME ZONE p.timezone; END IF;
  result:=jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'campaign_version',c.version,'content_hash',c.content_hash,
    'job',job,'episode',v_episode,'due_at',due,'next_eligible_at',next_at,'expires_at',expiry,
    'status',CASE WHEN reason IS NOT NULL THEN 'held' WHEN next_at>=expiry THEN 'expired' WHEN next_at>n THEN 'deferred' ELSE 'due' END,
    'reason',coalesce(reason,CASE WHEN next_at>=expiry THEN 'expired_no_safe_slot' WHEN next_at>n THEN 'cadence_or_quiet_hours' ELSE 'eligible' END),
    'source',jsonb_build_object('audience',audience,'email',lower(trim(p.email)),'name',p.display_name,'home_beach_id',p.home_beach_id,
      'sessions',count_sessions,'last_completion',last_completion,'trial_end',e.trial_ends_at,'offer_id',offer.id,'offer_months',CASE WHEN offer.program_id='five_sessions_month' THEN 1 WHEN offer.program_id='return_three_months' THEN 3 END));
  RETURN result;
END; $function$
REVOKE ALL ON FUNCTION public.evaluate_email_lifecycle(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_email_lifecycle(uuid,uuid) TO service_role;
COMMIT;
