BEGIN;
-- Per-run limits bound work; they must not become lifetime audience ceilings.
ALTER TABLE public.pro_offer_programs ALTER COLUMN max_awards DROP NOT NULL;
ALTER TABLE public.pro_offer_programs DROP CONSTRAINT pro_offer_programs_max_awards_check;
ALTER TABLE public.pro_offer_programs ADD CONSTRAINT pro_offer_programs_max_awards_check CHECK(max_awards IS NULL OR max_awards>0);
COMMENT ON COLUMN public.pro_offer_programs.max_awards IS 'NULL is an explicitly approved unlimited program budget; positive values remain lifetime award limits.';
ALTER TABLE public.pro_offer_programs ADD CONSTRAINT three_month_gift_manual_only CHECK(id<>'return_three_months' OR NOT automatic_enrollment);
ALTER TABLE public.email_contact_state ADD COLUMN account_permission_reviewed_at timestamptz,
 ADD COLUMN account_permission_reference text, ADD COLUMN entitlement_attempted_at timestamptz;
ALTER TABLE public.email_contact_controls ADD COLUMN account_policy_reference text;
COMMENT ON COLUMN public.email_contact_state.account_permission_reviewed_at IS 'Review of account-based email permission, not an affirmative user opt-in timestamp.';
CREATE FUNCTION public.lifecycle_permission_verified(p_state public.email_contact_state) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce((p_state.lifecycle_consent_at<=now() AND nullif(trim(p_state.consent_reference),'') IS NOT NULL)
 OR (p_state.account_permission_reviewed_at<=now() AND nullif(trim(p_state.account_permission_reference),'') IS NOT NULL),false);
$$;
REVOKE ALL ON FUNCTION public.lifecycle_permission_verified(public.email_contact_state) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_permission_verified(public.email_contact_state) TO service_role;


CREATE OR REPLACE FUNCTION public.refresh_lifecycle_enrollment() RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE affected integer;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 -- An approved account policy covers future signups only. Historical imports need reviewed evidence.
 INSERT INTO public.email_contact_state(user_id,account_permission_reviewed_at,account_permission_reference,history_reviewed_at)
 SELECT u.id,now(),c.account_policy_reference,c.history_cutover_at
 FROM auth.users u JOIN public.profiles p ON p.id=u.id CROSS JOIN public.email_contact_controls c
 JOIN public.email_campaigns campaign ON campaign.id=c.automation_campaign
 WHERE c.singleton AND campaign.status='approved' AND campaign.approved_at<=now() AND campaign.expires_at>now()
 AND c.history_cutover_at<=now() AND u.created_at>=c.history_cutover_at AND nullif(trim(c.history_cutover_reference),'') IS NOT NULL
 AND nullif(trim(c.account_policy_reference),'') IS NOT NULL AND u.email_confirmed_at IS NOT NULL
 AND lower(trim(u.email))=lower(trim(p.email)) AND p.analytics_is_real_user=true AND p.deleted_at IS NULL AND p.notif_email_enabled=true
 AND NOT EXISTS(SELECT 1 FROM public.email_contact_state s WHERE s.user_id=u.id)
 AND NOT EXISTS(SELECT 1 FROM public.user_email_prefs WHERE user_id=u.id AND email_frequency='off')
 AND NOT EXISTS(SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(u.email)))
 ORDER BY u.created_at,u.id LIMIT 50 ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.email_contact_state s SET approved_campaign=c.automation_campaign,
 history_reviewed_at=coalesce(s.history_reviewed_at,c.history_cutover_at)
 FROM public.email_contact_controls c
 WHERE c.singleton AND s.user_id IN (
  SELECT candidate.user_id FROM public.email_contact_state candidate
  JOIN auth.users u ON u.id=candidate.user_id JOIN public.profiles p ON p.id=u.id
  JOIN public.email_campaigns campaign ON campaign.id=c.automation_campaign
  WHERE campaign.status='approved' AND campaign.approved_at<=now() AND campaign.expires_at>now()
  AND c.history_cutover_at<=now() AND nullif(trim(c.history_cutover_reference),'') IS NOT NULL
  AND public.lifecycle_permission_verified(candidate) AND candidate.paused_at IS NULL
  AND (candidate.history_reviewed_at<=now() OR u.created_at>=c.history_cutover_at)
  AND candidate.approved_campaign IS DISTINCT FROM c.automation_campaign
  AND p.analytics_is_real_user=true AND p.deleted_at IS NULL AND p.notif_email_enabled=true AND u.email_confirmed_at IS NOT NULL
  AND lower(trim(u.email))=lower(trim(p.email))
  AND NOT EXISTS(SELECT 1 FROM public.user_email_prefs WHERE user_id=u.id AND email_frequency='off')
  AND NOT EXISTS(SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(u.email)))
  ORDER BY u.created_at,u.id LIMIT 50);
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected;
END; $$;

CREATE OR REPLACE FUNCTION public.email_lifecycle_cohort() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(user_id),'[]'::jsonb) FROM (
  SELECT s.user_id FROM public.email_contact_state s
  LEFT JOIN public.email_lifecycle_recipients r ON r.user_id=s.user_id
  WHERE s.approved_campaign='startup-lifecycle-v1'
  ORDER BY r.evaluated_at NULLS FIRST,s.user_id LIMIT 50
 ) cohort;
$$;

CREATE OR REPLACE FUNCTION public.issue_pro_offer(p_user_id uuid,p_program_id text,p_code_hash text,p_reference text,p_terms_version text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE p public.pro_offer_programs%ROWTYPE; award_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT * INTO p FROM public.pro_offer_programs WHERE id=p_program_id;
 IF p_terms_version IS DISTINCT FROM p.terms_version THEN RAISE EXCEPTION 'Offer terms not approved'; END IF;
 IF p.id IS NULL OR NOT p.enabled OR p.approved_at>now() OR p.expires_at<=now() THEN RAISE EXCEPTION 'Offer program not approved'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id=p_program_id) THEN RAISE EXCEPTION 'Offer already issued'; END IF;
 IF p.max_awards IS NOT NULL AND (SELECT count(*) FROM public.pro_offer_awards WHERE program_id=p_program_id)>=p.max_awards THEN RAISE EXCEPTION 'Offer budget exhausted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles profile JOIN auth.users u ON u.id=profile.id WHERE profile.id=p_user_id AND profile.analytics_is_real_user=true AND profile.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Unverified offer recipient'; END IF;
 INSERT INTO public.pro_offer_awards(user_id,program_id,code_hash,eligibility_reference,terms_version,earned_at)
 VALUES(p_user_id,p_program_id,p_code_hash,p_reference,p_terms_version,CASE WHEN p_program_id='return_three_months' THEN now() END) RETURNING id INTO award_id;
 PERFORM public.earn_five_session_offer(p_user_id);
 RETURN award_id;
END; $$;

CREATE OR REPLACE FUNCTION public.enroll_automatic_pro_offers() RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE candidate record; p public.pro_offer_programs%ROWTYPE; enrolled integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 FOR p IN SELECT * FROM public.pro_offer_programs WHERE enabled AND automatic_enrollment AND approved_at<=now() AND expires_at>now() ORDER BY months DESC LOOP
  FOR candidate IN SELECT s.user_id FROM public.email_contact_state s JOIN public.profiles profile ON profile.id=s.user_id JOIN auth.users u ON u.id=s.user_id
   WHERE public.lifecycle_permission_verified(s) AND s.history_reviewed_at<=now()
   AND s.entitlement_verified_until>now() AND s.provider_access_active=false AND s.paused_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.user_entitlements WHERE user_id=s.user_id AND (is_pro OR is_trialing) AND (expires_at IS NULL OR expires_at>now()))
   AND NOT EXISTS(SELECT 1 FROM public.earned_pro_grants WHERE user_id=s.user_id AND revoked_at IS NULL AND expires_at>now())
   AND profile.deleted_at IS NULL AND profile.analytics_is_real_user=true AND profile.notif_email_enabled=true AND u.email_confirmed_at IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(profile.email)))
   AND NOT EXISTS(SELECT 1 FROM public.user_email_prefs WHERE user_id=s.user_id AND email_frequency='off')
   AND NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=s.user_id AND (program_id=p.id OR state IN ('reserved','handoff_started','unknown') OR expires_at>now() OR (state<>'verified' AND (p.id='five_sessions_month' OR earned_at IS NOT NULL OR claim_requested_at IS NOT NULL))))
   AND (p.id='five_sessions_month' OR (
     coalesce((SELECT max(created_at) FROM public.user_events WHERE user_id=s.user_id AND bot_flagged IS NOT TRUE
       AND event_type IN ('beach_view','forecast_check','home_beach_forecast_viewed','home_hero_forecast_viewed')),u.created_at)<=now()-make_interval(days=>p.inactivity_days)
     AND NOT EXISTS(SELECT 1 FROM public.sessions WHERE user_id=s.user_id AND status='completed' AND deleted_at IS NULL AND email_completed_at>now()-make_interval(days=>p.inactivity_days))))
   ORDER BY u.created_at,s.user_id LIMIT 50 LOOP
    EXIT WHEN p.max_awards IS NOT NULL AND (SELECT count(*) FROM public.pro_offer_awards WHERE program_id=p.id)>=p.max_awards;
    PERFORM public.issue_pro_offer(candidate.user_id,p.id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'automation:'||p.approval_reference,p.terms_version);
    enrolled:=enrolled+1;
  END LOOP;
 END LOOP;
 RETURN enrolled;
END; $$;

CREATE OR REPLACE FUNCTION public.list_owned_pro_offers(p_user_id uuid) RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('contract_version',1,'user_id',p_user_id,'enrollment', (SELECT jsonb_build_object('terms_version',terms_version) FROM public.pro_offer_programs WHERE id='five_sessions_month' AND enabled AND automatic_enrollment AND approved_at<=now() AND expires_at>now() AND (max_awards IS NULL OR (SELECT count(*) FROM public.pro_offer_awards WHERE program_id='five_sessions_month')<max_awards) AND NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='return_three_months' AND (state<>'verified' OR expires_at>now()))), 'offers',coalesce(jsonb_agg(jsonb_build_object(
 'award_id',a.id,'program_id',a.program_id,'months',p.months,'terms_version',a.terms_version,'state',a.state,
 'earned',a.earned_at IS NOT NULL,'claim_requested',a.claim_requested_at IS NOT NULL,
 'completed_sessions',(SELECT count(*) FROM public.sessions WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL),
 'expires_at',CASE WHEN a.state='verified' THEN a.expires_at END,'mirror_verified',a.mirror_verified_at IS NOT NULL) ORDER BY a.enrolled_at),'[]'))
 FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id WHERE a.user_id=p_user_id
 AND (a.program_id='return_three_months' OR NOT EXISTS(SELECT 1 FROM public.pro_offer_awards other WHERE other.user_id=p_user_id AND other.program_id='return_three_months' AND (other.state<>'verified' OR other.expires_at>now())));
$$;

CREATE OR REPLACE FUNCTION public.evaluate_email_lifecycle(p_user_id uuid, p_ignore_attempt uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  n timestamptz := now(); p public.profiles%ROWTYPE; s public.email_contact_state%ROWTYPE;
  c public.email_campaigns%ROWTYPE; e public.user_entitlements%ROWTYPE;
  t public.revenuecat_provider_events%ROWTYPE; registered timestamptz;
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
    'source',jsonb_build_object('audience',audience,'email',lower(trim(p.email)),'name',p.display_name,'home_beach_id',p.home_beach_id,
      'sessions',count_sessions,'last_completion',last_completion,'trial_end',e.trial_ends_at,'offer_id',offer.id,'offer_months',CASE WHEN offer.program_id='five_sessions_month' THEN 1 WHEN offer.program_id='return_three_months' THEN 3 END));
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.lifecycle_entitlement_queue() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(user_id),'[]') FROM (
 SELECT s.user_id FROM public.email_contact_state s JOIN public.profiles p ON p.id=s.user_id
 WHERE s.approved_campaign IS NOT NULL AND public.lifecycle_permission_verified(s) AND s.paused_at IS NULL
 AND p.notif_email_enabled=true AND p.analytics_is_real_user=true AND p.deleted_at IS NULL
 AND (s.entitlement_verified_until IS NULL OR s.entitlement_verified_until<now()+interval '15 minutes')
 ORDER BY s.entitlement_attempted_at NULLS FIRST,s.user_id LIMIT 24) q;
$$;
CREATE FUNCTION public.record_lifecycle_entitlement_attempt(p_user_id uuid) RETURNS void
LANGUAGE sql SET search_path=public,pg_temp AS $$
 UPDATE public.email_contact_state SET entitlement_attempted_at=now() WHERE user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.record_lifecycle_entitlement_attempt(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_lifecycle_entitlement_attempt(uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.capture_lifecycle_email_preference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.notif_email_enabled IS NOT DISTINCT FROM OLD.notif_email_enabled THEN RETURN NEW; END IF;
 IF NEW.notif_email_enabled=false THEN
  UPDATE public.email_contact_state SET lifecycle_consent_at=NULL,marketing_consent_at=NULL,account_permission_reviewed_at=NULL,account_permission_reference=NULL WHERE user_id=NEW.id;
 ELSIF auth.uid()=NEW.id THEN
  INSERT INTO public.email_contact_state(user_id,lifecycle_consent_at,consent_reference)
  VALUES(NEW.id,now(),'authenticated_email_preference:lifecycle-v1')
  ON CONFLICT(user_id) DO UPDATE SET lifecycle_consent_at=excluded.lifecycle_consent_at,consent_reference=excluded.consent_reference;
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_lifecycle_consent(p_user_id uuid,p_consent boolean) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 INSERT INTO public.email_contact_state(user_id,lifecycle_consent_at,consent_reference)
 VALUES(p_user_id,CASE WHEN p_consent THEN now() END,CASE WHEN p_consent THEN 'self_service:lifecycle-v1' END)
 ON CONFLICT(user_id) DO UPDATE SET lifecycle_consent_at=excluded.lifecycle_consent_at,consent_reference=excluded.consent_reference;
 IF NOT p_consent THEN UPDATE public.email_contact_state SET account_permission_reviewed_at=NULL,account_permission_reference=NULL WHERE user_id=p_user_id; END IF;
 UPDATE public.profiles SET notif_email_enabled=p_consent WHERE id=p_user_id;
 -- Opt-in never clears suppression, reply pauses, or an existing off preference.
END; $$;

CREATE OR REPLACE FUNCTION public.unsubscribe_email_lifecycle(p_user_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 UPDATE public.email_contact_state SET lifecycle_consent_at=NULL,marketing_consent_at=NULL,account_permission_reviewed_at=NULL,account_permission_reference=NULL,paused_at=now() WHERE user_id=p_user_id;
 UPDATE public.email_contact_attempts SET state='cancelled',error_code='unsubscribed' WHERE user_id=p_user_id AND state='reserved';
 UPDATE public.email_lifecycle_recipients SET status='held',reason='unsubscribed',next_eligible_at=NULL WHERE user_id=p_user_id;
END; $$;

CREATE OR REPLACE VIEW public.email_automation_attention WITH(security_invoker=true) AS
 SELECT 'contact'::text AS kind,s.user_id::text AS record_id,
 CASE WHEN s.approved_campaign IS NULL THEN 'enrollment_pending' WHEN s.entitlement_verified_until IS NULL OR s.entitlement_verified_until<=now() THEN 'entitlement_stale' END AS reason
 FROM public.email_contact_state s WHERE public.lifecycle_permission_verified(s) AND s.paused_at IS NULL
 AND (s.approved_campaign IS NULL OR s.entitlement_verified_until IS NULL OR s.entitlement_verified_until<=now())
 UNION ALL SELECT 'offer',id::text,CASE WHEN claim_requested_at IS NULL THEN 'awaiting_user_acceptance' ELSE 'claim_due' END
 FROM public.pro_offer_awards WHERE earned_at IS NOT NULL AND state IN ('enrolled','held') AND (claim_requested_at IS NULL OR next_attempt_at<now()-interval '30 minutes');


CREATE OR REPLACE FUNCTION public.email_automation_health() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('due_unsent',(SELECT count(*) FROM public.email_lifecycle_recipients r WHERE r.status='due' AND r.first_due_at<now()-interval '30 minutes'
 AND NOT EXISTS(SELECT 1 FROM public.email_contact_attempts a WHERE a.user_id=r.user_id AND a.lifecycle_job=r.job AND a.episode=r.episode AND a.state NOT IN ('cancelled','failed'))),
 'enrollment_pending',(SELECT count(*) FROM public.email_contact_state s WHERE public.lifecycle_permission_verified(s) AND coalesce(s.lifecycle_consent_at,s.account_permission_reviewed_at)<now()-interval '24 hours' AND approved_campaign IS NULL AND paused_at IS NULL),
 'approval_unavailable',
 (SELECT count(*) FROM public.email_contact_controls c WHERE c.singleton AND c.enabled AND c.lifecycle_enabled AND NOT EXISTS(
  SELECT 1 FROM public.email_campaigns campaign WHERE campaign.id=c.automation_campaign AND campaign.status='approved' AND campaign.approved_at<=now() AND campaign.expires_at>now()))
 +(SELECT count(*) FROM public.pro_offer_programs WHERE enabled AND (approved_at IS NULL OR approved_at>now() OR expires_at IS NULL OR expires_at<=now())));
$$;

COMMIT;
