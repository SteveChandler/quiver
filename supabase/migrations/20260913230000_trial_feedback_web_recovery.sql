-- Dormant RevenueCat Web Billing recovery: private reservations, exact provider
-- readback, service-only reconciliation, and additive operational evidence.
BEGIN;

ALTER TABLE public.trial_feedback_controls ADD COLUMN web_enabled boolean NOT NULL DEFAULT false;

-- Separate provider evidence: web extends the existing period; it does not issue an iOS promotional receipt.
CREATE TABLE public.trial_feedback_web_recoveries (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL UNIQUE REFERENCES public.trial_feedback_submissions(id),
  reservation_id uuid NOT NULL UNIQUE,
  subscription_id text NOT NULL UNIQUE CHECK (subscription_id ~ '^sub[a-zA-Z0-9]+$'),
  baseline jsonb NOT NULL,
  original_starts_at timestamptz NOT NULL,
  original_ends_at timestamptz NOT NULL,
  expected_ends_at timestamptz NOT NULL CHECK (expected_ends_at>original_ends_at),
  terms_version text NOT NULL,
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','pending','extended','renewing','review_required','closed')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  handoff_at timestamptz,
  extension_verified_at timestamptz,
  renewal_verified_at timestamptz,
  mirror_verified_at timestamptz,
  last_observed_at timestamptz,
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  attention text,
  CHECK (state NOT IN ('pending','extended','renewing','closed') OR handoff_at IS NOT NULL),
  CHECK (state NOT IN ('extended','renewing','closed') OR extension_verified_at IS NOT NULL),
  CHECK (state<>'renewing' OR renewal_verified_at IS NOT NULL)
);
ALTER TABLE public.trial_feedback_web_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_feedback_web_recoveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.trial_feedback_web_recoveries TO service_role;
CREATE INDEX trial_feedback_web_queue ON public.trial_feedback_web_recoveries(next_check_at) WHERE state<>'closed';

CREATE FUNCTION public.trial_feedback_web_context(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.trial_feedback_web_recoveries%ROWTYPE; context jsonb; offer jsonb; start_at timestamptz;
BEGIN
 SELECT * INTO r FROM public.trial_feedback_web_recoveries WHERE user_id=p_user_id;
 IF FOUND THEN RETURN jsonb_build_object('recovery',to_jsonb(r),'offer',NULL); END IF;
 IF EXISTS(SELECT 1 FROM public.trial_feedback_controls WHERE singleton AND enabled AND redemption_enabled AND web_enabled) THEN
   context:=public.trial_feedback_context(p_user_id); offer:=context->'offer';
   IF offer->>'store'='RC_BILLING' THEN
     SELECT e.purchased_at INTO start_at FROM public.trial_feedback_submissions f JOIN public.revenuecat_provider_events e ON e.provider_event_id=f.trial_event_id WHERE f.user_id=p_user_id;
     RETURN jsonb_build_object('recovery',NULL,'offer',offer||jsonb_build_object('original_starts_at',start_at));
   END IF;
 END IF;
 RETURN jsonb_build_object('recovery',NULL,'offer',NULL);
END; $$;

CREATE FUNCTION public.reserve_trial_feedback_web(p_user_id uuid,p_request_id uuid,p_terms_version text,p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE context jsonb; offer jsonb; f public.trial_feedback_submissions%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.trial_feedback_web_recoveries WHERE user_id=p_user_id) THEN RETURN public.trial_feedback_web_context(p_user_id); END IF;
 context:=public.trial_feedback_web_context(p_user_id); offer:=context->'offer';
 IF offer IS NULL OR offer='null'::jsonb OR offer->>'store'<>'RC_BILLING' OR offer->>'terms_version' IS DISTINCT FROM p_terms_version
   OR (offer->>'trial_ends_at')::timestamptz<=now()+interval '5 minutes' THEN RAISE EXCEPTION 'web_offer_unavailable'; END IF;
 IF p_snapshot->>'customer_id' IS DISTINCT FROM p_user_id::text OR p_snapshot->>'original_customer_id' IS DISTINCT FROM p_user_id::text
   OR p_snapshot->>'store' IS DISTINCT FROM 'rc_billing' OR p_snapshot->>'environment' IS DISTINCT FROM 'production'
   OR p_snapshot->>'status' IS DISTINCT FROM 'trialing' OR p_snapshot->>'auto_renewal_status' IS DISTINCT FROM 'will_not_renew'
   OR p_snapshot->>'gives_access' IS DISTINCT FROM 'true' OR p_snapshot->>'pending_payment' IS DISTINCT FROM 'false'
   OR p_snapshot->>'ownership' IS DISTINCT FROM 'purchased' OR p_snapshot->'total_revenue_in_usd'->>'gross' IS DISTINCT FROM '0'
   OR to_timestamp((p_snapshot->>'current_period_starts_at')::numeric/1000) IS DISTINCT FROM (offer->>'original_starts_at')::timestamptz
   OR to_timestamp((p_snapshot->>'current_period_ends_at')::numeric/1000) IS DISTINCT FROM (offer->>'trial_ends_at')::timestamptz
 THEN RAISE EXCEPTION 'web_trial_mismatch'; END IF;
 PERFORM public.reserve_trial_feedback_offer(p_user_id,p_request_id,p_terms_version);
 SELECT * INTO f FROM public.trial_feedback_submissions WHERE user_id=p_user_id;
 INSERT INTO public.trial_feedback_web_recoveries(user_id,submission_id,reservation_id,subscription_id,baseline,original_starts_at,original_ends_at,expected_ends_at,terms_version)
 VALUES(p_user_id,f.id,p_request_id,p_snapshot->>'id',p_snapshot,(offer->>'original_starts_at')::timestamptz,f.trial_ends_at,f.expected_expires_at,p_terms_version);
 RETURN public.trial_feedback_web_context(p_user_id);
END; $$;

CREATE FUNCTION public.begin_trial_feedback_web(p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.trial_feedback_web_recoveries%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 SELECT * INTO r FROM public.trial_feedback_web_recoveries WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR r.state<>'reserved' OR r.original_ends_at<=now()+interval '5 minutes'
   OR NOT EXISTS(SELECT 1 FROM public.trial_feedback_controls WHERE singleton AND enabled AND redemption_enabled AND web_enabled) THEN RETURN false; END IF;
 IF NOT public.begin_trial_feedback_handoff(p_user_id,r.reservation_id) THEN RETURN false; END IF;
 UPDATE public.trial_feedback_web_recoveries SET state='pending',handoff_at=now(),next_check_at=now()+interval '10 minutes' WHERE user_id=p_user_id;
 RETURN true;
END; $$;

CREATE FUNCTION public.record_trial_feedback_web(p_user_id uuid,p_snapshot jsonb,p_attention text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.trial_feedback_web_recoveries%ROWTYPE; matches boolean; product text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 SELECT * INTO r FROM public.trial_feedback_web_recoveries WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR r.state='closed' THEN RETURN; END IF;
 IF r.extension_verified_at IS NOT NULL AND now()>=r.expected_ends_at THEN
   UPDATE public.trial_feedback_web_recoveries SET state='closed',last_checked_at=now(),attention=NULL WHERE user_id=p_user_id; RETURN;
 END IF;
 matches:=r.handoff_at IS NOT NULL AND p_snapshot->>'id'=r.subscription_id
   AND p_snapshot->>'customer_id'=p_user_id::text AND p_snapshot->>'original_customer_id'=p_user_id::text
   AND p_snapshot->>'product_id'=r.baseline->>'product_id' AND p_snapshot->>'store_subscription_identifier'=r.baseline->>'store_subscription_identifier'
   AND p_snapshot->>'store'='rc_billing' AND p_snapshot->>'environment'='production' AND p_snapshot->>'ownership'='purchased'
   AND p_snapshot->>'status'='trialing' AND p_snapshot->>'gives_access'='true' AND p_snapshot->>'pending_payment'='false'
   AND coalesce(p_snapshot->'pending_changes','null'::jsonb)='null'::jsonb AND coalesce(p_snapshot->'product_change','null'::jsonb)='null'::jsonb
   AND p_snapshot->'total_revenue_in_usd'->>'gross'='0' AND p_snapshot->'total_revenue_in_usd'->>'currency'='USD'
   AND p_snapshot->>'starts_at'=r.baseline->>'starts_at'
   AND to_timestamp((p_snapshot->>'current_period_starts_at')::numeric/1000)=r.original_starts_at
   AND to_timestamp((p_snapshot->>'current_period_ends_at')::numeric/1000)=r.expected_ends_at
   AND p_snapshot->>'auto_renewal_status' IN ('will_renew','will_not_renew');
 IF coalesce(matches,false) THEN
   UPDATE public.trial_feedback_web_recoveries SET state=CASE WHEN p_snapshot->>'auto_renewal_status'='will_renew' THEN 'renewing' ELSE 'extended' END,
     extension_verified_at=coalesce(extension_verified_at,now()),renewal_verified_at=CASE WHEN p_snapshot->>'auto_renewal_status'='will_renew' THEN coalesce(renewal_verified_at,now()) ELSE renewal_verified_at END,
     attention=NULL,last_observed_at=now(),last_checked_at=now(),next_check_at=now()+interval '10 minutes' WHERE user_id=p_user_id;
   -- Only mirror independently verified provider access onto this same original trial.
   -- A later paid period, different product or lifetime grant must never be overwritten.
   SELECT product_id INTO product FROM public.trial_feedback_submissions WHERE id=r.submission_id;
   UPDATE public.user_entitlements SET is_pro=true,is_trialing=true,trial_ends_at=r.expected_ends_at,expires_at=r.expected_ends_at,
     will_renew=(p_snapshot->>'auto_renewal_status'='will_renew'),billing_issue=false,lapsed_at=NULL
   WHERE user_id=p_user_id AND product_id=product
     AND (trial_ends_at IN (r.original_ends_at,r.expected_ends_at) OR expires_at=r.original_ends_at)
     AND (expires_at IS NULL OR expires_at<=r.expected_ends_at);
   IF FOUND THEN
     UPDATE public.trial_feedback_web_recoveries SET mirror_verified_at=now() WHERE user_id=p_user_id;
   ELSE
     UPDATE public.trial_feedback_web_recoveries SET state='review_required',attention='entitlement_mirror_conflict' WHERE user_id=p_user_id;
   END IF;

 ELSE
   UPDATE public.trial_feedback_web_recoveries SET
     state=CASE WHEN handoff_at<now()-interval '10 minutes' OR (p_attention IS NOT NULL AND handoff_at IS NOT NULL) THEN 'review_required' ELSE state END,
     attention=CASE WHEN p_attention IS NOT NULL THEN left(p_attention,80) WHEN handoff_at<now()-interval '10 minutes' THEN 'extension_unconfirmed' ELSE attention END,
     last_checked_at=now(),next_check_at=now()+interval '10 minutes' WHERE user_id=p_user_id;
 END IF;
END; $$;

CREATE FUNCTION public.claim_trial_feedback_web_queue() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 WITH due AS (SELECT user_id FROM public.trial_feedback_web_recoveries WHERE state<>'closed' AND next_check_at<=now() ORDER BY next_check_at LIMIT 5 FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE public.trial_feedback_web_recoveries r SET next_check_at=now()+interval '10 minutes' FROM due WHERE r.user_id=due.user_id RETURNING r.user_id)
 SELECT coalesce(jsonb_agg(user_id),'[]'::jsonb) FROM claimed;
$$;
CREATE FUNCTION public.trial_feedback_web_attention_count() RETURNS integer LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT count(*)::integer FROM public.trial_feedback_web_recoveries WHERE attention IS NOT NULL
   OR (state<>'closed' AND next_check_at<now()-interval '30 minutes')
   OR (state IN ('reserved','pending') AND reserved_at<now()-interval '30 minutes');
$$;

REVOKE ALL ON FUNCTION public.trial_feedback_web_context(uuid),public.reserve_trial_feedback_web(uuid,uuid,text,jsonb),public.begin_trial_feedback_web(uuid),public.record_trial_feedback_web(uuid,jsonb,text),public.claim_trial_feedback_web_queue(),public.trial_feedback_web_attention_count() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trial_feedback_web_context(uuid),public.reserve_trial_feedback_web(uuid,uuid,text,jsonb),public.begin_trial_feedback_web(uuid),public.record_trial_feedback_web(uuid,jsonb,text),public.claim_trial_feedback_web_queue(),public.trial_feedback_web_attention_count() TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_trial_feedback(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE f public.trial_feedback_submissions%ROWTYPE; event_id text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-feedback:'||p_user_id::text,0));
 SELECT * INTO f FROM public.trial_feedback_submissions WHERE user_id=p_user_id FOR UPDATE;
 IF f.state='reserved' AND f.store IN ('APP_STORE','PLAY_STORE') THEN
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

CREATE OR REPLACE FUNCTION public.reconcile_trial_feedback_queue() RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE u uuid; count_checked integer:=0;
BEGIN
 FOR u IN SELECT user_id FROM public.trial_feedback_submissions WHERE state='reserved' AND store IN ('APP_STORE','PLAY_STORE') AND (last_reconciled_at IS NULL OR last_reconciled_at<now()-interval '10 minutes')
   ORDER BY last_reconciled_at NULLS FIRST,reserved_at LIMIT 50 LOOP
   PERFORM public.reconcile_trial_feedback(u); count_checked:=count_checked+1;
 END LOOP;
 RETURN count_checked;
END; $$;


CREATE OR REPLACE VIEW public.trial_feedback_outcomes WITH(security_invoker=true) AS
 SELECT f.id,f.store,f.product_id,f.user_id,f.trial_event_id,f.source_message_id,f.submitted_at,f.reason,f.state,f.reserved_at,f.provider_handoff_at,f.verified_at,
   (SELECT count(*) FROM public.sessions session WHERE session.user_id=f.user_id AND session.status='completed' AND session.deleted_at IS NULL AND session.email_completed_at BETWEEN f.submitted_at AND now()) AS completed_sessions_after_feedback,
   (SELECT min(event.created_at) FROM public.user_events event WHERE event.user_id=f.user_id AND event.bot_flagged IS NOT TRUE AND event.event_type IN ('beach_view','forecast_check','home_beach_forecast_viewed','home_hero_forecast_viewed') AND event.created_at BETWEEN f.submitted_at AND now()) AS first_return_after_feedback,
   f.expected_expires_at,a.provider_id,a.sent_at,log.delivered_at,log.opened_at,log.clicked_at,log.bounced_at,
   (SELECT min(e.purchased_at) FROM public.revenuecat_provider_events e WHERE e.app_user_id=f.user_id
     AND e.product_id=f.product_id AND e.environment='PRODUCTION' AND e.environment_verified AND e.processed_at IS NOT NULL AND e.event_type='RENEWAL'
     AND e.store=f.store AND e.price>0 AND e.period_type='NORMAL' AND e.purchased_at>=f.expected_expires_at AND e.purchased_at<=now()) AS first_paid_renewal_at,
   CASE WHEN w.user_id IS NOT NULL THEN coalesce(w.attention,CASE WHEN w.state<>'closed' AND (w.next_check_at<now()-interval '30 minutes' OR (w.state IN ('reserved','pending') AND w.reserved_at<now()-interval '30 minutes')) THEN 'web_reconciliation_overdue' END) WHEN f.store IN ('APP_STORE','PLAY_STORE') AND f.state='reserved' AND f.trial_ends_at<now()-interval '30 minutes' THEN 'awaiting_provider_receipt' END AS attention,
   w.state AS web_state,w.extension_verified_at AS web_extension_verified_at,w.renewal_verified_at AS web_renewal_verified_at,w.mirror_verified_at AS web_mirror_verified_at
 FROM public.trial_feedback_submissions f LEFT JOIN public.trial_feedback_web_recoveries w ON w.user_id=f.user_id LEFT JOIN public.email_contact_attempts a ON a.id=f.source_message_id
 LEFT JOIN public.email_send_log log ON log.message_instance_id=a.id;

CREATE OR REPLACE FUNCTION public.trial_feedback_attention_count() RETURNS integer LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT (SELECT count(*) FROM public.trial_feedback_outcomes WHERE attention IS NOT NULL AND store IN ('APP_STORE','PLAY_STORE'))
 + (SELECT count(*) FROM public.trial_feedback_submissions WHERE state='reserved' AND store IN ('APP_STORE','PLAY_STORE') AND reserved_at<now()-interval '30 minutes'
   AND (last_reconciled_at IS NULL OR last_reconciled_at<now()-interval '30 minutes'))
 + (SELECT count(*) FROM public.trial_feedback_offer_policy WHERE enabled AND expires_at<=now());
$$;
CREATE OR REPLACE FUNCTION public.email_automation_dashboard() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
 'due',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT user_id,job,status,reason,next_eligible_at,due_age,attempt_state,provider_id FROM public.email_lifecycle_due ORDER BY evaluated_at LIMIT 50) q),'[]'),
 'attention',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.email_automation_attention LIMIT 100) q),'[]'),
 'offers',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,user_id,program_id,state,attention,verified_at,mirror_verified_at FROM public.pro_offer_attention LIMIT 100) q),'[]'),
 'runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT route,job,status,started_at,finished_at FROM public.cron_runs WHERE route IN ('/api/cron/email-lifecycle','/api/cron/pro-offer-reconcile','/api/cron/email-replies') ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'trial_feedback',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.trial_feedback_outcomes ORDER BY (attention IS NOT NULL) DESC,submitted_at DESC LIMIT 100) q),'[]'),
 'reply_sync', (SELECT jsonb_build_object('status',status,'last_synced_at',last_synced_at,'lease_expires_at',lease_expires_at) FROM public.email_reply_sync WHERE singleton));
$$;


COMMIT;
