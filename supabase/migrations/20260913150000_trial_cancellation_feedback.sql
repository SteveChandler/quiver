-- Dormant cancellation feedback: provenance columns, private state, service-only RPCs,
-- and additive lifecycle/dashboard support. No campaign or offer is activated.
BEGIN;

ALTER TABLE public.revenuecat_provider_events
  ADD COLUMN cancellation_reason text,
  ADD COLUMN offer_code text,
  ADD COLUMN price numeric,
  ADD COLUMN environment_verified boolean NOT NULL DEFAULT false;

CREATE TABLE public.trial_feedback_controls (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  redemption_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.trial_feedback_controls(singleton)
SELECT true WHERE NOT EXISTS (SELECT 1 FROM public.trial_feedback_controls WHERE singleton);

CREATE TABLE public.trial_feedback_offer_policy (
  store text NOT NULL CHECK (store IN ('APP_STORE','PLAY_STORE','STRIPE','RC_BILLING')),
  product_id text NOT NULL,
  offer_identifier text NOT NULL,
  PRIMARY KEY(store,product_id),
  terms_version text NOT NULL CHECK (length(terms_version) BETWEEN 1 AND 80),
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  expires_at timestamptz,
  stacking_evidence text,
  CHECK (NOT enabled OR (approved_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>approved_at AND coalesce(length(trim(stacking_evidence)),0)>0))
);

CREATE TABLE public.trial_feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_event_id text NOT NULL REFERENCES public.revenuecat_provider_events(provider_event_id),
  cancellation_event_id text NOT NULL REFERENCES public.revenuecat_provider_events(provider_event_id),
  store text NOT NULL CHECK (store IN ('APP_STORE','PLAY_STORE','STRIPE','RC_BILLING')),
  product_id text NOT NULL,
  trial_ends_at timestamptz NOT NULL,
  request_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('forecast','value','time','feature','price','technical','other')),
  note text NOT NULL DEFAULT '' CHECK (length(note)<=2000),
  source_message_id uuid REFERENCES public.email_contact_attempts(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','reserved','verified')),
  reservation_id uuid UNIQUE,
  reserved_at timestamptz,
  provider_handoff_at timestamptz,
  offer_identifier text,
  terms_version text,
  expected_expires_at timestamptz,
  provider_event_id text UNIQUE REFERENCES public.revenuecat_provider_events(provider_event_id),
  verified_at timestamptz,
  last_reconciled_at timestamptz,
  CHECK ((state='submitted' AND reservation_id IS NULL) OR
    (state IN ('reserved','verified') AND reservation_id IS NOT NULL AND reserved_at IS NOT NULL AND offer_identifier IS NOT NULL AND terms_version IS NOT NULL AND expected_expires_at IS NOT NULL)),
  CHECK ((state='verified')=(verified_at IS NOT NULL AND provider_event_id IS NOT NULL))
);

ALTER TABLE public.trial_feedback_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_feedback_offer_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_feedback_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_feedback_controls,public.trial_feedback_offer_policy,public.trial_feedback_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.trial_feedback_controls,public.trial_feedback_offer_policy,public.trial_feedback_submissions TO service_role;

-- An event alone is not current cancellation evidence. Require a fresh independent provider snapshot too.
CREATE FUNCTION public.current_feedback_trial(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('trial_event_id',t.provider_event_id,'cancellation_event_id',c.provider_event_id,
   'store',t.store,'cancelled_at',c.event_timestamp,'trial_ends_at',t.expiration_at,'product_id',t.product_id)
 FROM public.user_entitlements e
 JOIN public.email_contact_state s ON s.user_id=e.user_id
 JOIN public.profiles p ON p.id=e.user_id AND p.deleted_at IS NULL
 JOIN public.revenuecat_provider_events t ON t.app_user_id=e.user_id AND t.product_id=e.product_id
   AND t.environment='PRODUCTION' AND t.environment_verified AND t.store IN ('APP_STORE','PLAY_STORE','STRIPE','RC_BILLING') AND t.period_type='TRIAL'
   AND t.event_type='INITIAL_PURCHASE' AND t.processed_at IS NOT NULL AND t.purchased_at<=now()
   AND t.expiration_at=e.trial_ends_at
 JOIN public.revenuecat_provider_events c ON c.app_user_id=e.user_id AND c.product_id=t.product_id
   AND c.environment='PRODUCTION' AND c.environment_verified AND c.store=t.store AND c.period_type='TRIAL'
   AND c.event_type='CANCELLATION' AND c.cancellation_reason='UNSUBSCRIBE' AND c.processed_at IS NOT NULL
   AND c.purchased_at=t.purchased_at AND c.expiration_at=t.expiration_at
   AND c.event_timestamp BETWEEN t.event_timestamp AND now()
 WHERE e.user_id=p_user_id AND e.is_pro IS TRUE AND e.is_trialing IS TRUE AND e.will_renew IS FALSE
   AND e.trial_ends_at>now() AND s.provider_access_active IS TRUE
   AND s.entitlement_verified_until BETWEEN now()+interval '1 second' AND now()+interval '24 hours'
   AND s.provider_trial->>'product_id'=e.product_id AND (s.provider_trial->>'expires_at')::timestamptz=e.trial_ends_at
   AND s.provider_trial->>'will_renew'='false' AND s.provider_trial->>'billing_issue'='false'
   AND upper(s.provider_trial->>'store')=t.store
   AND NOT EXISTS (SELECT 1 FROM public.revenuecat_provider_events later WHERE later.app_user_id=e.user_id
     AND later.environment='PRODUCTION' AND later.processed_at IS NOT NULL AND later.event_timestamp>=c.event_timestamp
     AND later.event_type IN ('UNCANCELLATION','RENEWAL','PRODUCT_CHANGE','EXPIRATION','BILLING_ISSUE','TRANSFER'))
   AND NOT EXISTS (SELECT 1 FROM public.earned_pro_grants g WHERE g.user_id=e.user_id AND g.revoked_at IS NULL AND g.expires_at>now())
 ORDER BY c.event_timestamp DESC,t.event_timestamp DESC LIMIT 1;
$$;

CREATE FUNCTION public.trial_feedback_context(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE f public.trial_feedback_submissions%ROWTYPE; policy public.trial_feedback_offer_policy%ROWTYPE; t jsonb; offer jsonb; status text;
BEGIN
 SELECT * INTO f FROM public.trial_feedback_submissions WHERE user_id=p_user_id;
 t:=public.current_feedback_trial(p_user_id);
 IF NOT EXISTS(SELECT 1 FROM public.trial_feedback_controls WHERE singleton AND enabled) THEN
   status:='disabled';
 ELSIF f.id IS NOT NULL THEN status:='submitted';
 ELSIF t IS NULL THEN status:='unavailable'; ELSE status:='available'; END IF;
 IF f.id IS NOT NULL AND f.state='verified' THEN status:='verified'; END IF;
 IF f.id IS NOT NULL AND f.state<>'verified' AND f.provider_handoff_at IS NULL AND t->>'trial_event_id'=f.trial_event_id
   AND EXISTS(SELECT 1 FROM public.trial_feedback_controls WHERE singleton AND enabled AND redemption_enabled) THEN
   SELECT * INTO policy FROM public.trial_feedback_offer_policy WHERE product_id=f.product_id AND store=f.store AND enabled
     AND approved_at<=now() AND expires_at>now() AND length(trim(stacking_evidence))>0;
   IF policy.product_id IS NOT NULL AND (f.state='submitted' OR (f.offer_identifier=policy.offer_identifier AND f.terms_version=policy.terms_version)) THEN
     offer:=jsonb_build_object('product_id',f.product_id,'offer_identifier',policy.offer_identifier,'terms_version',policy.terms_version,
       'trial_ends_at',f.trial_ends_at,'free_ends_at',((f.trial_ends_at AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC',
       'store',f.store,'months',1);
   END IF;
 END IF;
 RETURN jsonb_build_object('contract_version',1,'user_id',p_user_id,'status',status,
   'submission_id',f.id,'reservation_id',f.reservation_id,'offer',offer,'redemption_state',f.state,'verified_until',CASE WHEN f.state='verified' THEN f.expected_expires_at END);
END; $$;

CREATE FUNCTION public.submit_trial_feedback(p_user_id uuid,p_request_id uuid,p_reason text,p_note text,p_message_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE t jsonb; message_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.trial_feedback_submissions WHERE user_id=p_user_id) THEN RETURN public.trial_feedback_context(p_user_id); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.trial_feedback_controls WHERE singleton AND enabled) THEN RAISE EXCEPTION 'feedback_disabled'; END IF;
 IF p_request_id IS NULL OR p_reason IS NULL OR p_reason NOT IN ('forecast','value','time','feature','price','technical','other')
   OR p_note IS NULL OR length(p_note)>2000 OR (p_reason='other' AND length(trim(p_note))=0) THEN RAISE EXCEPTION 'invalid_feedback'; END IF;
 t:=public.current_feedback_trial(p_user_id);
 IF t IS NULL THEN RAISE EXCEPTION 'feedback_ineligible'; END IF;
 IF p_message_id IS NOT NULL THEN
   SELECT id INTO message_id FROM public.email_contact_attempts WHERE id=p_message_id AND user_id=p_user_id
     AND lifecycle_job='trial_feedback' AND episode=t->>'trial_event_id' AND state='accepted';
   IF message_id IS NULL THEN RAISE EXCEPTION 'feedback_message_mismatch'; END IF;
 END IF;
 INSERT INTO public.trial_feedback_submissions(user_id,trial_event_id,cancellation_event_id,store,product_id,trial_ends_at,request_id,reason,note,source_message_id)
 VALUES(p_user_id,t->>'trial_event_id',t->>'cancellation_event_id',t->>'store',t->>'product_id',(t->>'trial_ends_at')::timestamptz,p_request_id,p_reason,trim(p_note),message_id);
 -- A response ends automated follow-up; reward review is an independent explicit customer action.
 UPDATE public.email_contact_state SET paused_at=coalesce(paused_at,now()) WHERE user_id=p_user_id;
 RETURN public.trial_feedback_context(p_user_id);
END; $$;

CREATE FUNCTION public.reserve_trial_feedback_offer(p_user_id uuid,p_request_id uuid,p_terms_version text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE context jsonb; f public.trial_feedback_submissions%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 context:=public.trial_feedback_context(p_user_id);
 IF p_request_id IS NULL OR context->'offer' IS NULL OR context->'offer'='null'::jsonb
   OR context->'offer'->>'terms_version' IS DISTINCT FROM p_terms_version THEN RAISE EXCEPTION 'feedback_offer_unavailable'; END IF;
 SELECT * INTO f FROM public.trial_feedback_submissions WHERE user_id=p_user_id FOR UPDATE;
 IF f.state='submitted' THEN
   UPDATE public.trial_feedback_submissions SET state='reserved',reservation_id=p_request_id,reserved_at=now(),
     offer_identifier=context->'offer'->>'offer_identifier',terms_version=p_terms_version,
     expected_expires_at=(context->'offer'->>'free_ends_at')::timestamptz WHERE id=f.id;
 ELSIF f.reservation_id IS DISTINCT FROM p_request_id THEN RAISE EXCEPTION 'feedback_offer_pending'; END IF;
 RETURN public.trial_feedback_context(p_user_id)||jsonb_build_object('reservation_id',p_request_id);
END; $$;

CREATE FUNCTION public.begin_trial_feedback_handoff(p_user_id uuid,p_reservation_id uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE context jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 context:=public.trial_feedback_context(p_user_id);
 IF context->'offer' IS NULL OR context->'offer'='null'::jsonb THEN RETURN false; END IF;
 UPDATE public.trial_feedback_submissions SET provider_handoff_at=now()
 WHERE user_id=p_user_id AND reservation_id=p_reservation_id AND state='reserved' AND provider_handoff_at IS NULL;
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.begin_trial_feedback_handoff(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_trial_feedback_handoff(uuid,uuid) TO service_role;

-- Only a processed production store receipt can confirm the free month. Client success never grants access.
CREATE FUNCTION public.reconcile_trial_feedback(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE f public.trial_feedback_submissions%ROWTYPE; event_id text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 SELECT * INTO f FROM public.trial_feedback_submissions WHERE user_id=p_user_id FOR UPDATE;
 IF f.state='reserved' THEN
   UPDATE public.trial_feedback_submissions SET last_reconciled_at=now() WHERE id=f.id;
   SELECT provider_event_id INTO event_id FROM public.revenuecat_provider_events
   WHERE app_user_id=p_user_id AND environment='PRODUCTION' AND environment_verified AND store=f.store AND price=0 AND processed_at IS NOT NULL
     AND product_id=f.product_id AND offer_code=f.offer_identifier AND period_type IN ('TRIAL','INTRO')
     AND event_type IN ('INITIAL_PURCHASE','RENEWAL') AND f.provider_handoff_at IS NOT NULL AND event_timestamp>=f.provider_handoff_at
     AND purchased_at=f.trial_ends_at AND expiration_at=f.expected_expires_at
   ORDER BY event_timestamp DESC LIMIT 1;
   IF event_id IS NOT NULL THEN
     UPDATE public.trial_feedback_submissions SET state='verified',verified_at=now(),provider_event_id=event_id WHERE id=f.id;
   END IF;
 END IF;
 RETURN public.trial_feedback_context(p_user_id);
END; $$;

CREATE FUNCTION public.reconcile_trial_feedback_queue() RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE u uuid; count_checked integer:=0;
BEGIN
 FOR u IN SELECT user_id FROM public.trial_feedback_submissions WHERE state='reserved' AND (last_reconciled_at IS NULL OR last_reconciled_at<now()-interval '10 minutes')
   ORDER BY last_reconciled_at NULLS FIRST,reserved_at LIMIT 50 LOOP
   PERFORM public.reconcile_trial_feedback(u); count_checked:=count_checked+1;
 END LOOP;
 RETURN count_checked;
END; $$;

CREATE VIEW public.trial_feedback_outcomes WITH(security_invoker=true) AS
 SELECT f.id,f.store,f.product_id,f.user_id,f.trial_event_id,f.source_message_id,f.submitted_at,f.reason,f.state,f.reserved_at,f.provider_handoff_at,f.verified_at,
   (SELECT count(*) FROM public.sessions session WHERE session.user_id=f.user_id AND session.status='completed' AND session.deleted_at IS NULL AND session.email_completed_at BETWEEN f.submitted_at AND now()) AS completed_sessions_after_feedback,
   (SELECT min(event.created_at) FROM public.user_events event WHERE event.user_id=f.user_id AND event.bot_flagged IS NOT TRUE AND event.event_type IN ('beach_view','forecast_check','home_beach_forecast_viewed','home_hero_forecast_viewed') AND event.created_at BETWEEN f.submitted_at AND now()) AS first_return_after_feedback,
   f.expected_expires_at,a.provider_id,a.sent_at,log.delivered_at,log.opened_at,log.clicked_at,log.bounced_at,
   (SELECT min(e.purchased_at) FROM public.revenuecat_provider_events e WHERE e.app_user_id=f.user_id
     AND e.product_id=f.product_id AND e.environment='PRODUCTION' AND e.environment_verified AND e.processed_at IS NOT NULL AND e.event_type='RENEWAL'
     AND e.store=f.store AND e.price>0 AND e.period_type='NORMAL' AND e.purchased_at>=f.expected_expires_at AND e.purchased_at<=now()) AS first_paid_renewal_at,
   CASE WHEN f.state='reserved' AND f.trial_ends_at<now()-interval '30 minutes' THEN 'awaiting_provider_receipt' END AS attention
 FROM public.trial_feedback_submissions f LEFT JOIN public.email_contact_attempts a ON a.id=f.source_message_id
 LEFT JOIN public.email_send_log log ON log.message_instance_id=a.id;
REVOKE ALL ON public.trial_feedback_outcomes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.trial_feedback_outcomes TO service_role;

CREATE OR REPLACE FUNCTION public.email_automation_dashboard() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
 'due',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT user_id,job,status,reason,next_eligible_at,due_age,attempt_state,provider_id FROM public.email_lifecycle_due ORDER BY evaluated_at LIMIT 50) q),'[]'),
 'attention',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.email_automation_attention LIMIT 100) q),'[]'),
 'offers',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,user_id,program_id,state,attention,verified_at,mirror_verified_at FROM public.pro_offer_attention LIMIT 100) q),'[]'),
 'runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT route,job,status,started_at,finished_at FROM public.cron_runs WHERE route IN ('/api/cron/email-lifecycle','/api/cron/pro-offer-reconcile','/api/cron/email-replies') ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'trial_feedback',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.trial_feedback_outcomes ORDER BY submitted_at DESC LIMIT 100) q),'[]'),
 'reply_sync', (SELECT jsonb_build_object('status',status,'last_synced_at',last_synced_at,'lease_expires_at',lease_expires_at) FROM public.email_reply_sync WHERE singleton));
$$;

CREATE FUNCTION public.trial_feedback_attention_count() RETURNS integer LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT (SELECT count(*) FROM public.trial_feedback_outcomes WHERE attention IS NOT NULL)
 + (SELECT count(*) FROM public.trial_feedback_submissions WHERE state='reserved' AND reserved_at<now()-interval '30 minutes'
   AND (last_reconciled_at IS NULL OR last_reconciled_at<now()-interval '30 minutes'))
 + (SELECT count(*) FROM public.trial_feedback_offer_policy WHERE enabled AND expires_at<=now());
$$;
REVOKE ALL ON FUNCTION public.trial_feedback_attention_count() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trial_feedback_attention_count() TO service_role;

CREATE INDEX trial_feedback_reconcile_queue ON public.trial_feedback_submissions(last_reconciled_at NULLS FIRST,reserved_at) WHERE state='reserved';

REVOKE ALL ON FUNCTION public.current_feedback_trial(uuid),public.trial_feedback_context(uuid),
 public.submit_trial_feedback(uuid,uuid,text,text,uuid),public.reserve_trial_feedback_offer(uuid,uuid,text),
 public.reconcile_trial_feedback(uuid),public.reconcile_trial_feedback_queue() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.current_feedback_trial(uuid),public.trial_feedback_context(uuid),
 public.submit_trial_feedback(uuid,uuid,text,text,uuid),public.reserve_trial_feedback_offer(uuid,uuid,text),
 public.reconcile_trial_feedback(uuid),public.reconcile_trial_feedback_queue() TO service_role;

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
