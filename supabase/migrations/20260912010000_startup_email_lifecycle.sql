BEGIN;

-- Additive, disabled launch state. No cohort, consent or approval is backfilled.
CREATE TABLE public.email_campaigns (
  id text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paused','retired')),
  owner text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  expires_at timestamptz,
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at > approved_at))
);
ALTER TABLE public.email_contact_controls ADD COLUMN lifecycle_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.email_contact_state
  ADD COLUMN lifecycle_consent_at timestamptz,
  ADD COLUMN manual_contact_at timestamptz,
  ADD COLUMN entitlement_verified_until timestamptz,
  ADD COLUMN entitlement_reference text;
ALTER TABLE public.sessions ADD COLUMN email_completed_at timestamptz;
CREATE FUNCTION public.stamp_email_session_completion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.email_completed_at := CASE WHEN NEW.status = 'completed' THEN now() END;
  ELSIF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.email_completed_at := now();
  ELSE
    NEW.email_completed_at := OLD.email_completed_at;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER email_session_completion BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.stamp_email_session_completion();

CREATE TABLE public.email_lifecycle_recipients (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id text REFERENCES public.email_campaigns(id),
  job text,
  episode text,
  status text NOT NULL,
  reason text NOT NULL,
  due_at timestamptz,
  next_eligible_at timestamptz,
  expires_at timestamptz,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  owner text NOT NULL DEFAULT 'Steve',
  snapshot jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE public.email_contact_attempts
  ADD COLUMN campaign_id text REFERENCES public.email_campaigns(id),
  ADD COLUMN campaign_version integer,
  ADD COLUMN episode text,
  ADD COLUMN lifecycle_job text,
  ADD COLUMN state text NOT NULL DEFAULT 'unknown' CHECK (state IN ('reserved','handoff_started','accepted','unknown','cancelled','failed')),
  ADD COLUMN source_hash text,
  ADD COLUMN content_hash text,
  ADD COLUMN payload jsonb,
  ADD COLUMN payload_hash text,
  ADD COLUMN handoff_at timestamptz,
  ADD COLUMN error_code text;
CREATE UNIQUE INDEX email_lifecycle_once ON public.email_contact_attempts(user_id, lifecycle_job, episode)
  WHERE lifecycle_job IS NOT NULL AND state NOT IN ('cancelled','failed');
CREATE INDEX idx_email_lifecycle_due ON public.email_lifecycle_recipients(next_eligible_at);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lifecycle_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_campaigns, public.email_lifecycle_recipients FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_campaigns, public.email_lifecycle_recipients TO service_role;

-- Approved content cannot be edited in place, including while paused.
CREATE FUNCTION public.freeze_email_campaign() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL AND
    (NEW.id, NEW.version, NEW.content_hash, NEW.owner, NEW.approved_by, NEW.approved_at, NEW.expires_at)
      IS DISTINCT FROM (OLD.id, OLD.version, OLD.content_hash, OLD.owner, OLD.approved_by, OLD.approved_at, OLD.expires_at) THEN
    RAISE EXCEPTION 'Create a new campaign version for changed approved content';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER freeze_email_campaign BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW EXECUTE FUNCTION public.freeze_email_campaign();

-- Read-only source of truth, also called again immediately before handoff.
CREATE FUNCTION public.evaluate_email_lifecycle(p_user_id uuid, p_ignore_attempt uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  n timestamptz := now(); p public.profiles%ROWTYPE; s public.email_contact_state%ROWTYPE;
  c public.email_campaigns%ROWTYPE; e public.user_entitlements%ROWTYPE;
  t public.revenuecat_provider_events%ROWTYPE; registered timestamptz;
  job text; v_episode text := 'onboarding'; reason text; due timestamptz; expiry timestamptz;
  next_at timestamptz; last_use timestamptz; last_completion timestamptz; count_sessions integer;
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

  IF e.is_trialing THEN
    SELECT * INTO t FROM public.revenuecat_provider_events WHERE app_user_id=p_user_id
      AND environment='PRODUCTION' AND processed_at IS NOT NULL AND product_id=e.product_id
      AND period_type='TRIAL' AND event_type IN ('INITIAL_PURCHASE','RENEWAL')
      AND purchased_at<=n AND expiration_at=e.trial_ends_at ORDER BY event_timestamp DESC LIMIT 1;
    IF t.provider_event_id IS NULL OR e.trial_ends_at<=n OR e.is_pro IS DISTINCT FROM true THEN
      RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','held','reason','trial_unverified');
    END IF;
    IF EXISTS(SELECT 1 FROM public.user_events WHERE user_id=p_user_id AND bot_flagged IS NOT TRUE
      AND event_type IN ('home_surf_call_tap','home_beach_forecast_viewed','home_hero_forecast_viewed')
      AND created_at BETWEEN t.purchased_at AND n) THEN
      RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','trial_target_reached');
    END IF;
    job := 'trial_support'; v_episode := t.provider_event_id; due := t.purchased_at+interval '24 hours';
    expiry := least(t.purchased_at+interval '7 days',e.trial_ends_at-interval '24 hours');
  ELSIF e.is_pro THEN
    RETURN jsonb_build_object('user_id',p_user_id,'campaign_id',c.id,'status','quiet','reason','entitled_no_growth');
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
      'sessions',count_sessions,'last_completion',last_completion,'trial_end',e.trial_ends_at));
  RETURN result;
END; $$;

CREATE FUNCTION public.record_email_lifecycle_decision(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE d jsonb;
BEGIN
  d:=public.evaluate_email_lifecycle(p_user_id);
  INSERT INTO public.email_lifecycle_recipients(user_id,campaign_id,job,episode,status,reason,due_at,next_eligible_at,expires_at,snapshot)
  VALUES(p_user_id,d->>'campaign_id',d->>'job',d->>'episode',d->>'status',d->>'reason',
    (d->>'due_at')::timestamptz,(d->>'next_eligible_at')::timestamptz,(d->>'expires_at')::timestamptz,d)
  ON CONFLICT(user_id) DO UPDATE SET campaign_id=excluded.campaign_id,job=excluded.job,episode=excluded.episode,
    status=excluded.status,reason=excluded.reason,due_at=excluded.due_at,next_eligible_at=excluded.next_eligible_at,
    expires_at=excluded.expires_at,snapshot=excluded.snapshot,evaluated_at=now();
  RETURN d;
END; $$;

CREATE FUNCTION public.claim_email_lifecycle(p_user_id uuid, p_version integer, p_content_hash text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE d jsonb; attempt uuid;
BEGIN
  -- ponytail: one lock for the <=15/day pilot; partition only after measured contention.
  PERFORM pg_advisory_xact_lock(739301);
  IF NOT EXISTS (SELECT 1 FROM public.email_contact_controls WHERE singleton AND enabled AND lifecycle_enabled) THEN
    RETURN jsonb_build_object('allowed',false,'reason','disabled'); END IF;
  d:=public.record_email_lifecycle_decision(p_user_id);
  IF d->>'status' IS DISTINCT FROM 'due' THEN
    RETURN jsonb_build_object('allowed',false,'reason',d->>'reason'); END IF;
  IF (d->>'campaign_version')::integer IS DISTINCT FROM p_version OR d->>'content_hash' IS DISTINCT FROM p_content_hash THEN
    RETURN jsonb_build_object('allowed',false,'reason','version_mismatch'); END IF;
  INSERT INTO public.email_contact_attempts(user_id,email_type,campaign_id,campaign_version,lifecycle_job,episode,state,source_hash,content_hash)
  VALUES(p_user_id,CASE d->>'job' WHEN 'welcome' THEN 'welcome' WHEN 'activation' THEN 'first_session_nudge'
    WHEN 'progress' THEN 'session_prompt' WHEN 'trial_support' THEN 'trial_started' ELSE 'weekly_recap' END,
    d->>'campaign_id',p_version,d->>'job',d->>'episode','reserved',md5((d->'source')::text),p_content_hash) RETURNING id INTO attempt;
  RETURN jsonb_build_object('allowed',true,'attempt_id',attempt,'decision',d);
END; $$;

CREATE FUNCTION public.begin_email_lifecycle(p_attempt_id uuid,p_payload jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE a public.email_contact_attempts%ROWTYPE; d jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(739301);
  SELECT * INTO a FROM public.email_contact_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF a.state IS DISTINCT FROM 'reserved' THEN RETURN false; END IF;
  d:=public.evaluate_email_lifecycle(a.user_id,a.id);
  IF NOT EXISTS(SELECT 1 FROM public.email_contact_controls WHERE singleton AND enabled AND lifecycle_enabled)
    OR d->>'status' IS DISTINCT FROM 'due' OR d->>'job' IS DISTINCT FROM a.lifecycle_job OR d->>'episode' IS DISTINCT FROM a.episode
    OR d->>'campaign_id' IS DISTINCT FROM a.campaign_id OR (d->>'campaign_version')::integer IS DISTINCT FROM a.campaign_version
    OR d->>'content_hash' IS DISTINCT FROM a.content_hash OR md5((d->'source')::text) IS DISTINCT FROM a.source_hash
    OR a.claimed_at<now()-interval '5 minutes' THEN
    UPDATE public.email_contact_attempts SET state='cancelled',error_code='eligibility_changed' WHERE id=a.id;
    RETURN false;
  END IF;
  IF p_payload->>'to' IS DISTINCT FROM d->'source'->>'email' OR nullif(p_payload->>'subject','') IS NULL
    OR nullif(p_payload->>'html','') IS NULL OR nullif(p_payload->>'text','') IS NULL THEN RAISE EXCEPTION 'Invalid lifecycle payload'; END IF;
  UPDATE public.email_contact_attempts SET state='handoff_started',handoff_at=now(),payload=p_payload,payload_hash=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') WHERE id=a.id;
  RETURN true;
END; $$;

CREATE FUNCTION public.finish_email_lifecycle(p_attempt_id uuid,p_provider_id text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE a public.email_contact_attempts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(739301);
  SELECT * INTO a FROM public.email_contact_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF a.id IS NULL OR a.state NOT IN ('handoff_started','unknown','accepted') OR nullif(trim(p_provider_id),'') IS NULL
    OR (a.provider_id IS NOT NULL AND a.provider_id<>p_provider_id) THEN RAISE EXCEPTION 'Invalid provider acceptance'; END IF;
  UPDATE public.email_contact_attempts SET state='accepted',provider_id=p_provider_id,sent_at=coalesce(sent_at,now()) WHERE id=a.id;
  IF a.lifecycle_job='conditions_alert' THEN RETURN; END IF;
  INSERT INTO public.email_send_log(user_id,email_type,subject,resend_message_id,local_date,sent_at,message_instance_id,meta)
  SELECT a.user_id,a.email_type,a.payload->>'subject',p_provider_id,(a.handoff_at AT TIME ZONE 'UTC')::date,a.handoff_at,a.id,
    jsonb_build_object('campaign_id',a.campaign_id,'campaign_version',a.campaign_version,'lifecycle_job',a.lifecycle_job,'message_instance_id',a.id)
  WHERE NOT EXISTS(SELECT 1 FROM public.email_send_log WHERE resend_message_id=p_provider_id);
END; $$;

-- Disable the old claim API permanently at cutover, including code rollback.
CREATE OR REPLACE FUNCTION public.claim_email_contact(p_user_id uuid,p_email text,p_email_type text)
RETURNS jsonb LANGUAGE sql SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('allowed',false,'reason','retired_use_lifecycle');
$$;

CREATE VIEW public.email_lifecycle_due WITH (security_invoker=true) AS
SELECT r.user_id,r.campaign_id,r.job,r.status,r.reason,r.due_at,r.next_eligible_at,r.expires_at,
  r.evaluated_at,r.owner,now()-r.evaluated_at AS evaluation_age,
  CASE WHEN r.status='due' THEN greatest(now()-r.due_at,interval '0') END AS due_age,
  a.id AS attempt_id,a.state AS attempt_state,a.provider_id,a.handoff_at,a.error_code,
  l.delivered_at,l.opened_at,l.clicked_at,l.bounced_at
FROM public.email_lifecycle_recipients r LEFT JOIN LATERAL (
  SELECT id,state,provider_id,handoff_at,error_code FROM public.email_contact_attempts
  WHERE user_id=r.user_id AND lifecycle_job IS NOT NULL ORDER BY claimed_at DESC LIMIT 1
) a ON true LEFT JOIN public.email_send_log l ON l.resend_message_id=a.provider_id;
REVOKE ALL ON public.email_lifecycle_due FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_lifecycle_due TO service_role;
REVOKE ALL ON FUNCTION public.evaluate_email_lifecycle(uuid,uuid),public.record_email_lifecycle_decision(uuid),
  public.claim_email_lifecycle(uuid,integer,text),public.begin_email_lifecycle(uuid,jsonb),public.finish_email_lifecycle(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_email_lifecycle(uuid,uuid),public.record_email_lifecycle_decision(uuid),
  public.claim_email_lifecycle(uuid,integer,text),public.begin_email_lifecycle(uuid,jsonb),public.finish_email_lifecycle(uuid,text) TO service_role;

CREATE FUNCTION public.email_lifecycle_cohort() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(user_id),'[]'::jsonb) FROM (
  SELECT s.user_id FROM public.email_contact_state s
  LEFT JOIN public.email_lifecycle_recipients r ON r.user_id=s.user_id
  WHERE s.approved_campaign='startup-lifecycle-v1'
  ORDER BY r.evaluated_at NULLS FIRST,s.user_id LIMIT 51
 ) cohort;
$$;
CREATE FUNCTION public.mark_email_lifecycle_unknown(p_attempt_id uuid) RETURNS void LANGUAGE sql SET search_path=public,pg_temp AS $$
 UPDATE public.email_contact_attempts SET state='unknown',error_code='provider_or_receipt_unknown'
 WHERE id=p_attempt_id AND state='handoff_started';
 UPDATE public.email_contact_controls SET lifecycle_enabled=false WHERE singleton;
$$;
CREATE FUNCTION public.reconcile_email_lifecycle() RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE expired_count integer; unknown_count integer;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 -- Only reservations that never began handoff can be released automatically.
 UPDATE public.email_contact_attempts SET state='cancelled',error_code='reservation_expired'
 WHERE lifecycle_job IS NOT NULL AND state='reserved' AND claimed_at<now()-interval '5 minutes';
 GET DIAGNOSTICS expired_count=ROW_COUNT;
 UPDATE public.email_contact_attempts SET state='unknown',error_code='handoff_timeout'
 WHERE lifecycle_job IS NOT NULL AND state='handoff_started' AND handoff_at<now()-interval '5 minutes';
 SELECT count(*) INTO unknown_count FROM public.email_contact_attempts WHERE lifecycle_job IS NOT NULL AND state='unknown';
 IF unknown_count>0 THEN UPDATE public.email_contact_controls SET lifecycle_enabled=false WHERE singleton; END IF;
 INSERT INTO public.email_send_log(user_id,email_type,subject,resend_message_id,local_date,sent_at,message_instance_id,meta)
 SELECT a.user_id,a.email_type,a.payload->>'subject',a.provider_id,(a.handoff_at AT TIME ZONE 'UTC')::date,a.handoff_at,a.id,
   jsonb_build_object('campaign_id',a.campaign_id,'lifecycle_job',a.lifecycle_job,'message_instance_id',a.id,'reconciled',true)
 FROM public.email_contact_attempts a WHERE a.state='accepted' AND a.lifecycle_job IS NOT NULL
   AND a.provider_id IS NOT NULL AND a.handoff_at IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.email_send_log WHERE resend_message_id=a.provider_id);
 UPDATE public.email_delivery_events d SET email_send_log_id=l.id FROM public.email_send_log l
 WHERE d.email_send_log_id IS NULL AND d.resend_message_id=l.resend_message_id;
 UPDATE public.email_send_log l SET delivered_at=least(l.delivered_at,d.delivered),opened_at=least(l.opened_at,d.opened),
   clicked_at=least(l.clicked_at,d.clicked),bounced_at=least(l.bounced_at,d.bounced)
 FROM (SELECT resend_message_id,min(event_at) FILTER(WHERE event_type='email.delivered') AS delivered,
   min(event_at) FILTER(WHERE event_type='email.opened') AS opened,min(event_at) FILTER(WHERE event_type='email.clicked') AS clicked,
   min(event_at) FILTER(WHERE event_type='email.bounced') AS bounced FROM public.email_delivery_events GROUP BY resend_message_id) d
 WHERE d.resend_message_id=l.resend_message_id;
 RETURN jsonb_build_object('expired_reservations',expired_count,'unknown_handoffs',unknown_count);
END; $$;
REVOKE ALL ON FUNCTION public.email_lifecycle_cohort(),public.mark_email_lifecycle_unknown(uuid),public.reconcile_email_lifecycle() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_lifecycle_cohort(),public.mark_email_lifecycle_unknown(uuid),public.reconcile_email_lifecycle() TO service_role;

CREATE FUNCTION public.unsubscribe_email_lifecycle(p_user_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 UPDATE public.email_contact_state SET lifecycle_consent_at=NULL,marketing_consent_at=NULL,paused_at=now() WHERE user_id=p_user_id;
 UPDATE public.email_contact_attempts SET state='cancelled',error_code='unsubscribed' WHERE user_id=p_user_id AND state='reserved';
 UPDATE public.email_lifecycle_recipients SET status='held',reason='unsubscribed',next_eligible_at=NULL WHERE user_id=p_user_id;
END; $$;
REVOKE ALL ON FUNCTION public.unsubscribe_email_lifecycle(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_email_lifecycle(uuid) TO service_role;

ALTER TABLE public.email_delivery_events DROP CONSTRAINT email_delivery_events_event_type_check;
ALTER TABLE public.email_delivery_events ADD CONSTRAINT email_delivery_events_event_type_check CHECK
 (event_type IN ('email.delivered','email.opened','email.clicked','email.bounced','email.complained','email.failed','email.delivery_delayed'));
CREATE FUNCTION public.record_lifecycle_provider_event(p_webhook_id text,p_provider_id text,p_type text,p_at timestamptz,
 p_recipients text[],p_hard_bounce boolean,p_link text DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE log_id bigint; recipient text;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 SELECT id INTO log_id FROM public.email_send_log WHERE resend_message_id=p_provider_id LIMIT 1;
 INSERT INTO public.email_delivery_events(email_send_log_id,resend_message_id,webhook_message_id,event_type,event_at)
 VALUES(log_id,p_provider_id,p_webhook_id,p_type,p_at) ON CONFLICT(webhook_message_id) DO NOTHING;
 IF p_type='email.complained' OR (p_type='email.bounced' AND p_hard_bounce) THEN
   IF cardinality(p_recipients)=0 THEN RAISE EXCEPTION 'Suppression recipient missing'; END IF;
   FOREACH recipient IN ARRAY p_recipients LOOP
    INSERT INTO public.email_suppression_list(email,reason) VALUES(lower(trim(recipient)),CASE WHEN p_type='email.complained' THEN 'complaint' ELSE 'hard_bounce' END)
    ON CONFLICT(email) DO NOTHING;
    UPDATE public.email_contact_state SET paused_at=coalesce(paused_at,now())
    WHERE user_id IN (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(recipient)));
   END LOOP;
 END IF;
 UPDATE public.email_send_log SET
  delivered_at=CASE WHEN p_type='email.delivered' THEN least(delivered_at,p_at) ELSE delivered_at END,
  opened_at=CASE WHEN p_type='email.opened' THEN least(opened_at,p_at) ELSE opened_at END,
  clicked_at=CASE WHEN p_type='email.clicked' THEN least(clicked_at,p_at) ELSE clicked_at END,
  bounced_at=CASE WHEN p_type='email.bounced' THEN least(bounced_at,p_at) ELSE bounced_at END
 WHERE id=log_id;
 IF p_type='email.clicked' AND p_link IS NOT NULL THEN
  INSERT INTO public.email_click_events(email_send_log_id,resend_message_id,webhook_message_id,clicked_at,link,user_agent)
  VALUES(log_id,p_provider_id,p_webhook_id,p_at,p_link,p_user_agent) ON CONFLICT DO NOTHING;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_lifecycle_provider_event(text,text,text,timestamptz,text[],boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_lifecycle_provider_event(text,text,text,timestamptz,text[],boolean,text,text) TO service_role;

CREATE FUNCTION public.claim_requested_email_alert(p_user_id uuid,p_episode text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE p public.profiles%ROWTYPE; a uuid; v_cap integer;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 SELECT daily_cap INTO v_cap FROM public.email_contact_controls WHERE singleton AND enabled AND lifecycle_enabled;
 IF v_cap IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','disabled'); END IF;
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
   ) history WHERE at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=v_cap
 THEN RETURN jsonb_build_object('allowed',false,'reason','contact_cap'); END IF;
 IF nullif(p_episode,'') IS NULL OR length(p_episode)>4000 OR nullif(p_payload->>'html','') IS NULL THEN RAISE EXCEPTION 'Invalid alert payload'; END IF;
 INSERT INTO public.email_contact_attempts(user_id,email_type,lifecycle_job,episode,state,handoff_at,payload)
 VALUES(p_user_id,'conditions_alert','conditions_alert',p_episode,'handoff_started',now(),p_payload) RETURNING id INTO a;
 RETURN jsonb_build_object('allowed',true,'attempt_id',a);
END; $$;
REVOKE ALL ON FUNCTION public.claim_requested_email_alert(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_requested_email_alert(uuid,text,jsonb) TO service_role;

CREATE VIEW public.email_lifecycle_outcomes WITH(security_invoker=true) AS
SELECT a.id AS message_instance_id,a.user_id,a.campaign_id,a.lifecycle_job,a.handoff_at,a.provider_id,
 now()>=a.handoff_at+interval '7 days' AS seven_day_window_mature,
 (SELECT min(e.created_at) FROM public.user_events e WHERE e.user_id=a.user_id AND e.bot_flagged IS NOT TRUE
   AND e.metadata->>'message_instance_id'=a.id::text AND e.created_at BETWEEN a.handoff_at AND a.handoff_at+interval '7 days') AS attributed_entry_at,
 (SELECT count(*) FROM public.sessions s WHERE s.user_id=a.user_id AND s.status='completed' AND s.deleted_at IS NULL
   AND s.email_completed_at BETWEEN a.handoff_at AND a.handoff_at+interval '7 days') AS completed_sessions_after_send
FROM public.email_contact_attempts a WHERE a.state='accepted' AND a.lifecycle_job IS NOT NULL;
COMMENT ON VIEW public.email_lifecycle_outcomes IS 'Message-linked entry and observational post-send sessions; not causal attribution or proof of paid conversion.';
REVOKE ALL ON public.email_lifecycle_outcomes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_lifecycle_outcomes TO service_role;
COMMIT;
