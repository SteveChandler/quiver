BEGIN;
ALTER TABLE public.pro_offer_programs ADD COLUMN automatic_enrollment boolean NOT NULL DEFAULT false,
 ADD COLUMN inactivity_days integer CHECK(inactivity_days BETWEEN 14 AND 180);
ALTER TABLE public.pro_offer_programs ADD CONSTRAINT return_rule_required CHECK(NOT automatic_enrollment OR id<>'return_three_months' OR inactivity_days IS NOT NULL);
CREATE OR REPLACE FUNCTION public.freeze_pro_offer_program() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.approved_at IS NOT NULL AND (to_jsonb(NEW)-'enabled') IS DISTINCT FROM (to_jsonb(OLD)-'enabled') THEN
  RAISE EXCEPTION 'Approved offer terms and budget are frozen';
 END IF;
 RETURN NEW;
END; $$;
ALTER TABLE public.pro_offer_awards ADD COLUMN claim_requested_at timestamptz,
 ADD COLUMN next_attempt_at timestamptz, ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
 ADD COLUMN last_reconciled_at timestamptz;
ALTER TABLE public.email_contact_state ADD COLUMN provider_access_active boolean,
 ADD COLUMN entitlement_checked_at timestamptz, ADD COLUMN provider_trial jsonb;
ALTER TABLE public.email_contact_controls ADD COLUMN automation_campaign text REFERENCES public.email_campaigns(id),
 ADD COLUMN history_cutover_at timestamptz, ADD COLUMN history_cutover_reference text;

-- A user's affirmative opt-in is separate from defaults and from a paused reply.
CREATE FUNCTION public.set_lifecycle_consent(p_user_id uuid,p_consent boolean) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 INSERT INTO public.email_contact_state(user_id,lifecycle_consent_at,consent_reference)
 VALUES(p_user_id,CASE WHEN p_consent THEN now() END,CASE WHEN p_consent THEN 'self_service:lifecycle-v1' END)
 ON CONFLICT(user_id) DO UPDATE SET lifecycle_consent_at=excluded.lifecycle_consent_at,consent_reference=excluded.consent_reference;
 UPDATE public.profiles SET notif_email_enabled=p_consent WHERE id=p_user_id;
 -- Opt-in never clears suppression, reply pauses, or an existing off preference.
END; $$;
CREATE FUNCTION public.refresh_lifecycle_enrollment() RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE affected integer;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 UPDATE public.email_contact_state s SET approved_campaign=c.automation_campaign,
 history_reviewed_at=coalesce(s.history_reviewed_at,c.history_cutover_at)
 FROM public.email_contact_controls c,auth.users u,public.email_campaigns campaign
 WHERE c.singleton AND campaign.id=c.automation_campaign AND campaign.status='approved' AND campaign.expires_at>now()
 AND c.history_cutover_at<=now() AND nullif(trim(c.history_cutover_reference),'') IS NOT NULL
 AND s.user_id=u.id AND s.lifecycle_consent_at<=now() AND s.consent_reference IS NOT NULL
 -- Old contacts require the one-time reviewed import; post-cutover accounts have no earlier outreach.
 AND (s.history_reviewed_at IS NOT NULL OR u.created_at>=c.history_cutover_at)
 AND s.approved_campaign IS DISTINCT FROM c.automation_campaign
 AND s.user_id IN (SELECT candidate.user_id FROM public.email_contact_state candidate JOIN auth.users account ON account.id=candidate.user_id
 WHERE candidate.approved_campaign IS NULL AND candidate.lifecycle_consent_at<=now() AND (candidate.history_reviewed_at IS NOT NULL OR account.created_at>=c.history_cutover_at)
 ORDER BY account.created_at,candidate.user_id LIMIT greatest(0,50-(SELECT count(*)::integer FROM public.email_contact_state WHERE approved_campaign=c.automation_campaign)));
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected;
END; $$;
CREATE FUNCTION public.record_lifecycle_entitlement_check(p_user_id uuid,p_active boolean) RETURNS void
LANGUAGE sql SET search_path=public,pg_temp AS $$
 UPDATE public.email_contact_state SET provider_access_active=p_active,entitlement_checked_at=now(),
 entitlement_verified_until=now()+interval '6 hours',entitlement_reference='revenuecat:verified_customer_read'
 WHERE user_id=p_user_id;
$$;
CREATE FUNCTION public.lifecycle_entitlement_queue() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(user_id),'[]') FROM (SELECT user_id FROM public.email_contact_state
 WHERE approved_campaign IS NOT NULL AND lifecycle_consent_at IS NOT NULL AND paused_at IS NULL
 AND (entitlement_verified_until IS NULL OR entitlement_verified_until<now()+interval '15 minutes')
 ORDER BY entitlement_checked_at NULLS FIRST,user_id LIMIT 6) q;
$$;
CREATE FUNCTION public.enroll_automatic_pro_offers() RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE candidate record; p public.pro_offer_programs%ROWTYPE; enrolled integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 FOR p IN SELECT * FROM public.pro_offer_programs WHERE enabled AND automatic_enrollment AND approved_at<=now() AND expires_at>now() ORDER BY months DESC LOOP
  FOR candidate IN SELECT s.user_id FROM public.email_contact_state s JOIN public.profiles profile ON profile.id=s.user_id JOIN auth.users u ON u.id=s.user_id
   WHERE s.lifecycle_consent_at<=now() AND s.consent_reference IS NOT NULL AND s.history_reviewed_at<=now()
   AND s.entitlement_verified_until>now() AND s.provider_access_active=false AND s.paused_at IS NULL
   AND profile.analytics_is_real_user=true AND profile.notif_email_enabled=true AND u.email_confirmed_at IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(profile.email)))
   AND NOT EXISTS(SELECT 1 FROM public.user_email_prefs WHERE user_id=s.user_id AND email_frequency='off')
   AND NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=s.user_id AND (program_id=p.id OR state IN ('reserved','handoff_started','unknown') OR expires_at>now() OR (state<>'verified' AND (p.id='five_sessions_month' OR earned_at IS NOT NULL OR claim_requested_at IS NOT NULL))))
   AND (p.id='five_sessions_month' OR (
     coalesce((SELECT max(created_at) FROM public.user_events WHERE user_id=s.user_id AND bot_flagged IS NOT TRUE
       AND event_type IN ('beach_view','forecast_check','home_beach_forecast_viewed','home_hero_forecast_viewed')),u.created_at)<=now()-make_interval(days=>p.inactivity_days)
     AND NOT EXISTS(SELECT 1 FROM public.sessions WHERE user_id=s.user_id AND status='completed' AND deleted_at IS NULL AND email_completed_at>now()-make_interval(days=>p.inactivity_days))))
   ORDER BY u.created_at,s.user_id LIMIT 50 LOOP
    EXIT WHEN (SELECT count(*) FROM public.pro_offer_awards WHERE program_id=p.id)>=p.max_awards;
    PERFORM public.issue_pro_offer(candidate.user_id,p.id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'automation:'||p.approval_reference,p.terms_version);
    enrolled:=enrolled+1;
  END LOOP;
 END LOOP;
 RETURN enrolled;
END; $$;
CREATE FUNCTION public.enroll_self_service_pro_offer(p_user_id uuid,p_terms_version text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE award uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT id INTO award FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='five_sessions_month';
 IF award IS NOT NULL THEN RETURN award; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pro_offer_programs WHERE id='five_sessions_month' AND automatic_enrollment) THEN RAISE EXCEPTION 'Enrollment unavailable'; END IF;
 RETURN public.issue_pro_offer(p_user_id,'five_sessions_month',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'self_service:five-sessions-v1',p_terms_version);
END; $$;
REVOKE ALL ON FUNCTION public.enroll_self_service_pro_offer(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_self_service_pro_offer(uuid,text) TO service_role;
CREATE FUNCTION public.owned_pro_offer_key(p_user_id uuid,p_award_id uuid) RETURNS text
LANGUAGE sql SET search_path=public,pg_temp AS $$ SELECT code_hash FROM public.pro_offer_awards WHERE user_id=p_user_id AND id=p_award_id; $$;
CREATE FUNCTION public.list_owned_pro_offers(p_user_id uuid) RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('contract_version',1,'user_id',p_user_id,'enrollment', (SELECT jsonb_build_object('terms_version',terms_version) FROM public.pro_offer_programs WHERE id='five_sessions_month' AND enabled AND automatic_enrollment AND approved_at<=now() AND expires_at>now() AND (SELECT count(*) FROM public.pro_offer_awards WHERE program_id='five_sessions_month')<max_awards AND NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='return_three_months' AND (state<>'verified' OR expires_at>now()))), 'offers',coalesce(jsonb_agg(jsonb_build_object(
 'award_id',a.id,'program_id',a.program_id,'months',p.months,'terms_version',a.terms_version,'state',a.state,
 'earned',a.earned_at IS NOT NULL,'claim_requested',a.claim_requested_at IS NOT NULL,
 'completed_sessions',(SELECT count(*) FROM public.sessions WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL),
 'expires_at',CASE WHEN a.state='verified' THEN a.expires_at END,'mirror_verified',a.mirror_verified_at IS NOT NULL) ORDER BY a.enrolled_at),'[]'))
 FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id WHERE a.user_id=p_user_id
 AND (a.program_id='return_three_months' OR NOT EXISTS(SELECT 1 FROM public.pro_offer_awards other WHERE other.user_id=p_user_id AND other.program_id='return_three_months' AND (other.state<>'verified' OR other.expires_at>now())));
$$;
CREATE FUNCTION public.request_pro_offer_claim(p_user_id uuid,p_code_hash text) RETURNS void
LANGUAGE sql SET search_path=public,pg_temp AS $$
 UPDATE public.pro_offer_awards SET claim_requested_at=coalesce(claim_requested_at,now()),next_attempt_at=coalesce(next_attempt_at,now())
 WHERE user_id=p_user_id AND code_hash=p_code_hash;
$$;
CREATE FUNCTION public.pro_offer_fulfillment_queue() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM (SELECT a.id AS award_id,a.user_id FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id
 WHERE p.enabled AND a.claim_requested_at IS NOT NULL AND a.earned_at IS NOT NULL AND a.next_attempt_at<=now()
 AND (a.state IN ('enrolled','held') OR (a.state='reserved' AND a.reserved_at<now()-interval '2 minutes'))
 ORDER BY a.next_attempt_at,a.id LIMIT 2) q;
$$;
CREATE FUNCTION public.defer_pro_offer_retry(p_award_id uuid) RETURNS void
LANGUAGE sql SET search_path=public,pg_temp AS $$
 UPDATE public.pro_offer_awards SET retry_count=retry_count+1,next_attempt_at=now()+make_interval(mins=>least(1440,15*(2^least(retry_count,7))::integer))
 WHERE id=p_award_id AND state NOT IN ('verified','handoff_started','unknown');
$$;
REVOKE ALL ON FUNCTION public.set_lifecycle_consent(uuid,boolean),public.refresh_lifecycle_enrollment(),public.record_lifecycle_entitlement_check(uuid,boolean),public.lifecycle_entitlement_queue(),public.enroll_automatic_pro_offers(),public.owned_pro_offer_key(uuid,uuid),public.list_owned_pro_offers(uuid),public.request_pro_offer_claim(uuid,text),public.pro_offer_fulfillment_queue(),public.defer_pro_offer_retry(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_lifecycle_consent(uuid,boolean),public.refresh_lifecycle_enrollment(),public.record_lifecycle_entitlement_check(uuid,boolean),public.lifecycle_entitlement_queue(),public.enroll_automatic_pro_offers(),public.owned_pro_offer_key(uuid,uuid),public.list_owned_pro_offers(uuid),public.request_pro_offer_claim(uuid,text),public.pro_offer_fulfillment_queue(),public.defer_pro_offer_retry(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.evaluate_email_lifecycle(p_user_id uuid, p_ignore_attempt uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  n timestamptz := now(); p public.profiles%ROWTYPE; s public.email_contact_state%ROWTYPE;
  c public.email_campaigns%ROWTYPE; e public.user_entitlements%ROWTYPE;
  t public.revenuecat_provider_events%ROWTYPE; registered timestamptz;
  job text; v_episode text := 'onboarding'; reason text; due timestamptz; expiry timestamptz;
  next_at timestamptz; last_use timestamptz; last_completion timestamptz; count_sessions integer;
  offer public.pro_offer_awards%ROWTYPE;
  active_days integer; contacts timestamptz[]; local_time timestamp; result jsonb; cap integer;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id=p_user_id;
  SELECT * INTO s FROM public.email_contact_state WHERE user_id=p_user_id;
  SELECT * INTO c FROM public.email_campaigns WHERE id=s.approved_campaign;
  SELECT created_at INTO registered FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL
    AND lower(trim(email))=lower(trim(p.email));
  SELECT * INTO e FROM public.user_entitlements WHERE user_id=p_user_id;
  IF registered IS NULL OR p.analytics_is_real_user IS DISTINCT FROM true OR p.notif_email_enabled IS DISTINCT FROM true THEN reason := 'ineligible_profile';
  ELSIF (SELECT count(*) FROM public.profiles WHERE lower(trim(email))=lower(trim(p.email))) <> 1 THEN reason := 'ambiguous_identity';
  ELSIF EXISTS (SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(p.email)))
    OR EXISTS (SELECT 1 FROM public.user_email_prefs WHERE user_id=p_user_id AND email_frequency='off') THEN reason := 'suppressed';
  ELSIF s.paused_at IS NOT NULL THEN reason := 'reply_paused';
  ELSIF s.lifecycle_consent_at IS NULL OR s.lifecycle_consent_at > n OR nullif(trim(s.consent_reference),'') IS NULL
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

  SELECT a.* INTO offer FROM public.pro_offer_awards a JOIN public.pro_offer_programs program ON program.id=a.program_id
    WHERE a.user_id=p_user_id AND a.state<>'verified' AND a.claim_requested_at IS NULL AND program.enabled
    ORDER BY CASE WHEN a.program_id='return_three_months' THEN 0 ELSE 1 END,a.earned_at NULLS LAST,a.enrolled_at LIMIT 1;

  IF e.is_trialing THEN
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
  ELSIF e.is_pro OR s.provider_access_active THEN
    RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','entitled_no_growth');
  ELSIF EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND claim_requested_at IS NOT NULL AND earned_at IS NOT NULL AND state<>'verified') THEN
    RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','offer_claim_pending');
  ELSIF offer.earned_at IS NOT NULL THEN
    job:='offer_ready'; v_episode:=offer.id::text; due:=offer.earned_at; expiry:=offer.earned_at+interval '30 days';
  ELSIF n<registered+interval '48 hours' AND NOT EXISTS (
    SELECT 1 FROM public.email_send_log WHERE user_id=p_user_id AND email_type IN ('welcome','founder_story','trial_started')
  ) THEN job := 'welcome'; due := registered; expiry := registered+interval '48 hours';
  ELSIF n>=registered+interval '7 days' AND n<registered+interval '10 days' AND count_sessions<5
    AND last_use<=n-interval '4 days' AND (last_completion IS NULL OR last_completion<=n-interval '4 days') THEN
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
  IF (SELECT count(*) FROM (
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
    'source',jsonb_build_object('email',lower(trim(p.email)),'name',p.display_name,'home_beach_id',p.home_beach_id,
      'sessions',count_sessions,'last_completion',last_completion,'trial_end',e.trial_ends_at,'offer_id',offer.id,'offer_months',CASE WHEN offer.program_id='five_sessions_month' THEN 1 WHEN offer.program_id='return_three_months' THEN 3 END));
  RETURN result;
END; $$;



-- Automatic retries retain the same cursor; gaps/ambiguous parsing still require recovery.
CREATE FUNCTION public.retryable_gmail_reply_failure(p_lease_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.email_reply_sync SET status='pending',lease_id=NULL,lease_expires_at=NULL WHERE singleton AND lease_id=p_lease_id;
 IF FOUND THEN UPDATE public.email_reply_sync_runs SET status='error',finished_at=now() WHERE id=p_lease_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.retryable_gmail_reply_failure(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retryable_gmail_reply_failure(uuid) TO service_role;
CREATE VIEW public.email_automation_attention WITH(security_invoker=true) AS
 SELECT 'contact'::text AS kind,s.user_id::text AS record_id,
 CASE WHEN s.approved_campaign IS NULL THEN 'enrollment_pending' WHEN s.entitlement_verified_until IS NULL OR s.entitlement_verified_until<=now() THEN 'entitlement_stale' END AS reason
 FROM public.email_contact_state s WHERE s.lifecycle_consent_at IS NOT NULL AND s.paused_at IS NULL
 AND (s.approved_campaign IS NULL OR s.entitlement_verified_until IS NULL OR s.entitlement_verified_until<=now())
 UNION ALL SELECT 'offer',id::text,CASE WHEN claim_requested_at IS NULL THEN 'awaiting_user_acceptance' ELSE 'claim_due' END
 FROM public.pro_offer_awards WHERE earned_at IS NOT NULL AND state IN ('enrolled','held') AND (claim_requested_at IS NULL OR next_attempt_at<now()-interval '30 minutes');
REVOKE ALL ON public.email_automation_attention FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_automation_attention TO service_role;
CREATE FUNCTION public.email_automation_dashboard() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
 'due',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT user_id,job,status,reason,next_eligible_at,due_age,attempt_state,provider_id FROM public.email_lifecycle_due ORDER BY evaluated_at LIMIT 50) q),'[]'),
 'attention',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.email_automation_attention LIMIT 100) q),'[]'),
 'offers',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,user_id,program_id,state,attention,verified_at,mirror_verified_at FROM public.pro_offer_attention LIMIT 100) q),'[]'),
 'runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT route,status,started_at,finished_at FROM public.cron_runs WHERE route IN ('/api/cron/email-lifecycle','/api/cron/pro-offer-reconcile','/api/cron/email-replies') ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'reply_sync', (SELECT jsonb_build_object('status',status,'last_synced_at',last_synced_at,'lease_expires_at',lease_expires_at) FROM public.email_reply_sync WHERE singleton));
$$;
REVOKE ALL ON FUNCTION public.email_automation_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_automation_dashboard() TO service_role;

-- A fresh, independently read provider receipt can repair a missing web mirror.
-- Never replace another active entitlement or fabricate a webhook event.
CREATE FUNCTION public.apply_verified_pro_offer_mirror(p_award_id uuid,p_receipt jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.pro_offer_awards%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT * INTO a FROM public.pro_offer_awards WHERE id=p_award_id AND state='verified' FOR UPDATE;
 IF a.id IS NULL OR a.expires_at<=now() OR p_receipt->>'user_id' IS DISTINCT FROM a.user_id::text
 OR p_receipt->>'store' IS DISTINCT FROM 'promotional' OR p_receipt->>'product_id' IS DISTINCT FROM a.provider_receipt->>'product_id'
 OR p_receipt->>'entitlement_id' IS DISTINCT FROM a.entitlement_id OR (p_receipt->>'expires_at')::timestamptz IS DISTINCT FROM a.expires_at
 OR (p_receipt->>'observed_at')::timestamptz IS NULL OR (p_receipt->>'observed_at')::timestamptz NOT BETWEEN now()-interval '1 minute' AND now()+interval '5 seconds'
 THEN RAISE EXCEPTION 'Fresh provider proof required for mirror repair'; END IF;
 INSERT INTO public.user_entitlements(user_id,is_pro,is_trialing,trial_ends_at,expires_at,product_id)
 VALUES(a.user_id,true,false,NULL,a.expires_at,p_receipt->>'product_id')
 ON CONFLICT(user_id) DO UPDATE SET is_pro=true,is_trialing=false,trial_ends_at=NULL,expires_at=excluded.expires_at,product_id=excluded.product_id
 WHERE NOT (user_entitlements.is_pro OR user_entitlements.is_trialing) OR user_entitlements.expires_at<=now();
END; $$;
REVOKE ALL ON FUNCTION public.apply_verified_pro_offer_mirror(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_pro_offer_mirror(uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.pro_offer_reconciliation_queue() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM (SELECT id AS award_id,reservation_id,user_id,entitlement_id,expires_at
 FROM public.pro_offer_awards a WHERE state='unknown' OR (state='handoff_started' AND handoff_at<now()-interval '2 minutes')
 OR (state='verified' AND a.expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.user_entitlements e WHERE e.user_id=a.user_id AND e.is_pro AND (e.expires_at IS NULL OR e.expires_at>=a.expires_at)))
 ORDER BY last_reconciled_at NULLS FIRST,handoff_at,id LIMIT 2) q;
$$;
CREATE FUNCTION public.record_pro_offer_reconciliation(p_award_id uuid) RETURNS void
LANGUAGE sql SET search_path=public,pg_temp AS $$ UPDATE public.pro_offer_awards SET last_reconciled_at=now() WHERE id=p_award_id; $$;
REVOKE ALL ON FUNCTION public.record_pro_offer_reconciliation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pro_offer_reconciliation(uuid) TO service_role;
CREATE FUNCTION public.gmail_reply_ingestion_ready() RETURNS boolean
LANGUAGE sql SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.email_reply_sync WHERE singleton AND status='healthy' AND last_synced_at>now()-interval '90 seconds'); $$;
REVOKE ALL ON FUNCTION public.gmail_reply_ingestion_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gmail_reply_ingestion_ready() TO service_role;
CREATE FUNCTION public.record_lifecycle_provider_snapshot(p_user_id uuid,p_active boolean,p_trial jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.record_lifecycle_entitlement_check(p_user_id,p_active);
 UPDATE public.email_contact_state SET provider_trial=p_trial WHERE user_id=p_user_id;
END; $$;
REVOKE ALL ON FUNCTION public.record_lifecycle_provider_snapshot(uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_lifecycle_provider_snapshot(uuid,boolean,jsonb) TO service_role;
ALTER TABLE public.pro_offer_awards ADD COLUMN claim_message_instance_id uuid REFERENCES public.email_contact_attempts(id);
CREATE FUNCTION public.attribute_pro_offer_claim(p_user_id uuid,p_award_id uuid,p_message_instance_id uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.pro_offer_awards offer SET claim_message_instance_id=coalesce(offer.claim_message_instance_id,p_message_instance_id)
 WHERE offer.id=p_award_id AND offer.user_id=p_user_id AND EXISTS(SELECT 1 FROM public.email_contact_attempts message
 WHERE message.id=p_message_instance_id AND message.user_id=p_user_id AND message.state='accepted'
 AND message.lifecycle_job='offer_ready' AND message.episode=offer.id::text);
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.attribute_pro_offer_claim(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_pro_offer_claim(uuid,uuid,uuid) TO service_role;
CREATE VIEW public.email_offer_outcomes WITH(security_invoker=true) AS
 SELECT a.id AS award_id,a.user_id,a.program_id,a.earned_at,a.claim_requested_at,a.verified_at,a.mirror_verified_at,
 a.claim_message_instance_id,message.provider_id,message.campaign_id,message.campaign_version,message.handoff_at
 FROM public.pro_offer_awards a LEFT JOIN public.email_contact_attempts message ON message.id=a.claim_message_instance_id;
REVOKE ALL ON public.email_offer_outcomes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_offer_outcomes TO service_role;

ALTER TABLE public.email_lifecycle_recipients ADD COLUMN first_due_at timestamptz;
CREATE FUNCTION public.track_email_due_age() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status<>'due' THEN NEW.first_due_at:=NULL;
 ELSIF TG_OP='UPDATE' AND OLD.status='due' AND (OLD.job,OLD.episode) IS NOT DISTINCT FROM (NEW.job,NEW.episode) THEN NEW.first_due_at:=coalesce(OLD.first_due_at,now());
 ELSE NEW.first_due_at:=now(); END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER track_email_due_age BEFORE INSERT OR UPDATE ON public.email_lifecycle_recipients FOR EACH ROW EXECUTE FUNCTION public.track_email_due_age();
REVOKE ALL ON FUNCTION public.track_email_due_age() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.track_email_due_age() TO service_role;
CREATE FUNCTION public.email_automation_health() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('due_unsent',(SELECT count(*) FROM public.email_lifecycle_recipients r WHERE r.status='due' AND r.first_due_at<now()-interval '30 minutes'
 AND NOT EXISTS(SELECT 1 FROM public.email_contact_attempts a WHERE a.user_id=r.user_id AND a.lifecycle_job=r.job AND a.episode=r.episode AND a.state NOT IN ('cancelled','failed'))),
 'enrollment_pending',(SELECT count(*) FROM public.email_contact_state WHERE lifecycle_consent_at<now()-interval '24 hours' AND approved_campaign IS NULL AND paused_at IS NULL));
$$;
REVOKE ALL ON FUNCTION public.email_automation_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_automation_health() TO service_role;

-- Existing web/native Email updates toggles can record an affirmative opt-in.
-- Defaults on INSERT and service-role re-enablement never manufacture consent.
CREATE FUNCTION public.capture_lifecycle_email_preference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.notif_email_enabled IS NOT DISTINCT FROM OLD.notif_email_enabled THEN RETURN NEW; END IF;
 IF NEW.notif_email_enabled=false THEN
  UPDATE public.email_contact_state SET lifecycle_consent_at=NULL,marketing_consent_at=NULL WHERE user_id=NEW.id;
 ELSIF auth.uid()=NEW.id THEN
  INSERT INTO public.email_contact_state(user_id,lifecycle_consent_at,consent_reference)
  VALUES(NEW.id,now(),'authenticated_email_preference:lifecycle-v1')
  ON CONFLICT(user_id) DO UPDATE SET lifecycle_consent_at=excluded.lifecycle_consent_at,consent_reference=excluded.consent_reference;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER capture_lifecycle_email_preference AFTER UPDATE OF notif_email_enabled ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.capture_lifecycle_email_preference();
REVOKE ALL ON FUNCTION public.capture_lifecycle_email_preference() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_lifecycle_email_preference() TO service_role;
COMMIT;
