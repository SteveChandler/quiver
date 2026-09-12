BEGIN;
-- Audience enters source_hash, so an upgrade cancels a previously reserved promo.
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
    'source',jsonb_build_object('audience',audience,'email',lower(trim(p.email)),'name',p.display_name,'home_beach_id',p.home_beach_id,
      'sessions',count_sessions,'last_completion',last_completion,'trial_end',e.trial_ends_at,'offer_id',offer.id,'offer_months',CASE WHEN offer.program_id='five_sessions_month' THEN 1 WHEN offer.program_id='return_three_months' THEN 3 END));
  RETURN result;
END; $$;
COMMIT;
