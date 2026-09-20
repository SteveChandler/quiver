-- Account-bound free gifts reuse the existing receipt-verified ledger. No program is activated.
BEGIN;
ALTER TABLE public.pro_offer_programs DROP CONSTRAINT pro_offer_programs_id_check;
ALTER TABLE public.pro_offer_programs DROP CONSTRAINT pro_offer_programs_check;
ALTER TABLE public.pro_offer_programs ADD CONSTRAINT pro_offer_programs_id_check
 CHECK(id IN ('five_sessions_month','return_three_months','manual_month','cancellation_month'));
ALTER TABLE public.pro_offer_programs ADD CONSTRAINT pro_offer_programs_check
 CHECK((id IN ('five_sessions_month','manual_month','cancellation_month') AND months=1) OR (id='return_three_months' AND months=3));
ALTER TABLE public.pro_offer_programs ADD CONSTRAINT explicit_month_gifts_only
 CHECK(id NOT IN ('manual_month','cancellation_month') OR NOT automatic_enrollment);
INSERT INTO public.pro_offer_programs(id,months)
 SELECT id,1 FROM (VALUES('manual_month'),('cancellation_month')) programs(id)
 WHERE NOT EXISTS(SELECT 1 FROM public.pro_offer_programs existing WHERE existing.id=programs.id);

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
 VALUES(p_user_id,p_program_id,p_code_hash,p_reference,p_terms_version,CASE WHEN p_program_id<>'five_sessions_month' THEN now() END) RETURNING id INTO award_id;
 PERFORM public.earn_five_session_offer(p_user_id);
 RETURN award_id;
END; $$;

CREATE OR REPLACE FUNCTION public.list_owned_pro_offers(p_user_id uuid) RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('contract_version',1,'user_id',p_user_id,'enrollment', (SELECT jsonb_build_object('terms_version',terms_version) FROM public.pro_offer_programs WHERE id='five_sessions_month' AND enabled AND automatic_enrollment AND approved_at<=now() AND expires_at>now() AND (max_awards IS NULL OR (SELECT count(*) FROM public.pro_offer_awards WHERE program_id='five_sessions_month')<max_awards) AND NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='return_three_months' AND (state<>'verified' OR expires_at>now()))), 'offers',coalesce(jsonb_agg(jsonb_build_object(
 'award_id',a.id,'program_id',a.program_id,'months',p.months,'terms_version',a.terms_version,'state',a.state,
 'earned',a.earned_at IS NOT NULL,'claim_requested',a.claim_requested_at IS NOT NULL,
 'completed_sessions',(SELECT count(*) FROM public.sessions WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL),
 'expires_at',CASE WHEN a.state='verified' THEN a.expires_at END,'mirror_verified',a.mirror_verified_at IS NOT NULL) ORDER BY a.enrolled_at),'[]'))
 FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id WHERE a.user_id=p_user_id
 AND (a.program_id<>'five_sessions_month' OR NOT EXISTS(SELECT 1 FROM public.pro_offer_awards other WHERE other.user_id=p_user_id AND other.program_id='return_three_months' AND (other.state<>'verified' OR other.expires_at>now())));
$$;

CREATE OR REPLACE FUNCTION public.apply_verified_pro_offer_mirror(p_award_id uuid,p_receipt jsonb) RETURNS void
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
 INSERT INTO public.user_entitlements(user_id,is_pro,is_trialing,trial_ends_at,expires_at,product_id,will_renew,billing_issue,lapsed_at,rc_raw)
 VALUES(a.user_id,true,false,NULL,a.expires_at,p_receipt->>'product_id',false,false,NULL,jsonb_build_object('store','PROMOTIONAL','type','PROMOTIONAL_GRANT','product_id',p_receipt->>'product_id'))
 ON CONFLICT(user_id) DO UPDATE SET is_pro=true,is_trialing=false,trial_ends_at=NULL,expires_at=excluded.expires_at,product_id=excluded.product_id,will_renew=false,billing_issue=false,lapsed_at=NULL,rc_raw=excluded.rc_raw
 WHERE NOT (user_entitlements.is_pro OR user_entitlements.is_trialing) OR user_entitlements.expires_at<=now();
END; $$;

CREATE OR REPLACE FUNCTION public.evaluate_email_lifecycle(p_user_id uuid, p_ignore_attempt uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
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
    WHERE audience='free' AND a.program_id IN ('five_sessions_month','return_three_months') AND a.user_id=p_user_id AND a.state<>'verified' AND a.claim_requested_at IS NULL AND program.enabled
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

-- Same access/retention boundary as trial feedback: service-role only, account-deletion cascade.
-- Free text is never returned by context/analytics; support review requires privileged access.
CREATE TABLE public.cancellation_feedback_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 UNIQUE(user_id,request_id),
 reason text NOT NULL CHECK(reason IN ('forecast','value','time','feature','price','technical','other')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=2000),
 submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cancellation_feedback_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cancellation_feedback_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.cancellation_feedback_submissions TO service_role;
COMMENT ON TABLE public.cancellation_feedback_submissions IS 'Optional cancellation intent feedback, not proof of cancellation. Private support data retained until account deletion, matching trial_feedback_submissions; never export note to analytics.';

CREATE FUNCTION public.cancellation_feedback_context(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE p public.pro_offer_programs%ROWTYPE; a public.pro_offer_awards%ROWTYPE; latest public.revenuecat_provider_events%ROWTYPE; cancelled_at timestamptz; episode_started_at timestamptz; offer jsonb; confirmed boolean;
BEGIN
 SELECT * INTO latest FROM public.revenuecat_provider_events
 WHERE app_user_id=p_user_id AND environment='PRODUCTION' AND environment_verified AND processed_at IS NOT NULL
 AND event_timestamp<=now() AND event_type IN ('INITIAL_PURCHASE','RENEWAL','CANCELLATION','UNCANCELLATION','EXPIRATION','BILLING_ISSUE','PRODUCT_CHANGE','TRANSFER')
 ORDER BY event_timestamp DESC, CASE WHEN event_type IN ('EXPIRATION','BILLING_ISSUE','TRANSFER','UNCANCELLATION','RENEWAL','PRODUCT_CHANGE') THEN 0 ELSE 1 END,provider_event_id LIMIT 1;
 SELECT c.event_timestamp INTO cancelled_at FROM public.revenuecat_provider_events c
 WHERE c.app_user_id=p_user_id AND c.environment='PRODUCTION' AND c.environment_verified AND c.processed_at IS NOT NULL
 AND c.event_type='CANCELLATION' AND c.cancellation_reason='UNSUBSCRIBE' AND c.event_timestamp<=now()
 AND NOT EXISTS(SELECT 1 FROM public.revenuecat_provider_events later WHERE later.app_user_id=p_user_id
   AND later.environment='PRODUCTION' AND later.environment_verified AND later.processed_at IS NOT NULL
   AND later.event_timestamp>=c.event_timestamp AND later.event_timestamp<=now()
   AND later.event_type IN ('INITIAL_PURCHASE','UNCANCELLATION','RENEWAL','PRODUCT_CHANGE','TRANSFER'))
 ORDER BY c.event_timestamp DESC LIMIT 1;
 confirmed:=cancelled_at IS NOT NULL;
 -- An in-app questionnaire precedes store cancellation; associate it with that subscription episode.
 SELECT coalesce(max(event_timestamp),cancelled_at) INTO episode_started_at FROM public.revenuecat_provider_events
 WHERE app_user_id=p_user_id AND environment='PRODUCTION' AND environment_verified AND processed_at IS NOT NULL
 AND event_timestamp<=cancelled_at AND event_type IN ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION');
 SELECT * INTO a FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='cancellation_month';
 SELECT * INTO p FROM public.pro_offer_programs WHERE id='cancellation_month' AND enabled AND approved_at<=now() AND expires_at>now();
 IF a.id IS NOT NULL AND a.state<>'verified' THEN
   offer:=jsonb_build_object('program_id','cancellation_month','months',1,'terms_version',a.terms_version,'award_id',a.id);
 ELSIF a.id IS NULL AND p.id IS NOT NULL
   AND (p.max_awards IS NULL OR (SELECT count(*) FROM public.pro_offer_awards WHERE program_id=p.id)<p.max_awards)
   AND latest.expiration_at>now() AND latest.store IN ('APP_STORE','PLAY_STORE')
   AND latest.event_type IN ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','PRODUCT_CHANGE','CANCELLATION')
   AND (latest.event_type<>'CANCELLATION' OR latest.cancellation_reason='UNSUBSCRIBE')
   AND EXISTS(SELECT 1 FROM public.profiles profile JOIN auth.users u ON u.id=profile.id WHERE profile.id=p_user_id AND profile.analytics_is_real_user AND profile.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL)
 THEN
   offer:=jsonb_build_object('program_id',p.id,'months',1,'terms_version',p.terms_version,'award_id',NULL);
 END IF;
 RETURN jsonb_build_object('contract_version',1,'user_id',p_user_id,
   'management_store',CASE WHEN latest.store IN ('APP_STORE','PLAY_STORE','STRIPE','RC_BILLING') THEN latest.store END,
   'cancellation_confirmed',confirmed,
   'feedback_submitted',EXISTS(SELECT 1 FROM public.cancellation_feedback_submissions WHERE user_id=p_user_id AND (cancelled_at IS NULL OR submitted_at>=episode_started_at)),'offer',offer);
END; $$;

CREATE FUNCTION public.submit_cancellation_feedback(p_user_id uuid,p_request_id uuid,p_reason text,p_note text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE submission uuid;
BEGIN
 IF p_request_id IS NULL OR p_reason IS NULL OR p_reason NOT IN ('forecast','value','time','feature','price','technical','other')
 OR p_note IS NULL OR length(p_note)>2000 THEN RAISE EXCEPTION 'invalid_feedback'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'feedback_account_unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cancellation-feedback:'||p_user_id::text,0));
 SELECT id INTO submission FROM public.cancellation_feedback_submissions WHERE user_id=p_user_id AND request_id=p_request_id;
 IF submission IS NOT NULL THEN RETURN submission; END IF;
 INSERT INTO public.cancellation_feedback_submissions(user_id,request_id,reason,note)
 VALUES(p_user_id,p_request_id,p_reason,trim(p_note)) RETURNING id INTO submission;
 RETURN submission;
END; $$;

CREATE FUNCTION public.accept_cancellation_gift(p_user_id uuid,p_request_id uuid,p_terms_version text,p_code_hash text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.pro_offer_awards%ROWTYPE; context jsonb; award uuid;
BEGIN
 -- The ledger's shared lock serializes budget checks and all competing program claims.
 PERFORM pg_advisory_xact_lock(739302);
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'missing_request'; END IF;
 SELECT * INTO a FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='cancellation_month';
 IF a.id IS NOT NULL THEN
   IF a.terms_version IS DISTINCT FROM p_terms_version THEN RAISE EXCEPTION 'terms_mismatch'; END IF;
   RETURN a.id;
 END IF;
 context:=public.cancellation_feedback_context(p_user_id);
 IF context->'offer' IS NULL OR context->'offer'='null'::jsonb OR context->'offer'->>'terms_version' IS DISTINCT FROM p_terms_version THEN RAISE EXCEPTION 'gift_unavailable'; END IF;
 award:=public.issue_pro_offer(p_user_id,'cancellation_month',p_code_hash,'cancellation-intent:'||p_request_id::text,p_terms_version);
 RETURN award;
END; $$;
REVOKE ALL ON FUNCTION public.cancellation_feedback_context(uuid),public.submit_cancellation_feedback(uuid,uuid,text,text),public.accept_cancellation_gift(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancellation_feedback_context(uuid),public.submit_cancellation_feedback(uuid,uuid,text,text),public.accept_cancellation_gift(uuid,uuid,text,text) TO service_role;
COMMIT;
