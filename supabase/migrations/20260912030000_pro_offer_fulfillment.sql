BEGIN;
CREATE TABLE public.pro_offer_programs (
 id text PRIMARY KEY CHECK(id IN ('five_sessions_month','return_three_months')),
 months integer NOT NULL CHECK((id='five_sessions_month' AND months=1) OR (id='return_three_months' AND months=3)),
 terms_version text NOT NULL DEFAULT 'v1',
 enabled boolean NOT NULL DEFAULT false, approval_reference text, approved_at timestamptz, expires_at timestamptz,
 max_awards integer NOT NULL DEFAULT 25 CHECK(max_awards BETWEEN 1 AND 50),
 CHECK(NOT enabled OR (approval_reference IS NOT NULL AND length(trim(approval_reference))>0 AND approved_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>approved_at))
);
INSERT INTO public.pro_offer_programs(id,months) VALUES('five_sessions_month',1),('return_three_months',3);
CREATE FUNCTION public.freeze_pro_offer_program() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.approved_at IS NOT NULL AND (NEW.id,NEW.months,NEW.terms_version,NEW.max_awards,NEW.approval_reference,NEW.approved_at,NEW.expires_at)
 IS DISTINCT FROM (OLD.id,OLD.months,OLD.terms_version,OLD.max_awards,OLD.approval_reference,OLD.approved_at,OLD.expires_at) THEN
  RAISE EXCEPTION 'Approved offer terms and budget are frozen';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER freeze_pro_offer_program BEFORE UPDATE ON public.pro_offer_programs FOR EACH ROW EXECUTE FUNCTION public.freeze_pro_offer_program();
REVOKE ALL ON FUNCTION public.freeze_pro_offer_program() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_pro_offer_program() TO service_role;
CREATE TABLE public.pro_offer_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 program_id text NOT NULL REFERENCES public.pro_offer_programs(id), code_hash text NOT NULL UNIQUE CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 eligibility_reference text NOT NULL CHECK(length(trim(eligibility_reference))>0), terms_version text NOT NULL CHECK(length(trim(terms_version))>0),
 enrolled_at timestamptz NOT NULL DEFAULT now(), earned_at timestamptz, session_ids uuid[],
 state text NOT NULL DEFAULT 'enrolled' CHECK(state IN ('enrolled','held','reserved','handoff_started','unknown','verified')),
 reason text, reservation_id uuid, reserved_at timestamptz, handoff_at timestamptz, expires_at timestamptz,
 entitlement_id text, provider_receipt jsonb, verified_at timestamptz, mirror_verified_at timestamptz,
 UNIQUE(user_id,program_id)
);
CREATE UNIQUE INDEX pro_offer_one_pending_grant ON public.pro_offer_awards(user_id) WHERE state IN ('reserved','handoff_started','unknown');
ALTER TABLE public.earned_pro_grants ADD COLUMN offer_award_id uuid UNIQUE REFERENCES public.pro_offer_awards(id);
ALTER TABLE public.pro_offer_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_offer_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pro_offer_programs,public.pro_offer_awards FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.pro_offer_programs,public.pro_offer_awards TO service_role;

CREATE FUNCTION public.earn_five_session_offer(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE ids uuid[];
BEGIN
 -- ponytail: pilot-wide serialization prevents enrollment/completion races; shard by user when throughput warrants it.
 PERFORM pg_advisory_xact_lock(739302);
 IF NOT EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id='five_sessions_month' AND earned_at IS NULL) THEN RETURN; END IF;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.sessions WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL ORDER BY id LIMIT 5) completed;
 IF cardinality(ids)=5 THEN
  UPDATE public.pro_offer_awards SET earned_at=now(),session_ids=ids WHERE user_id=p_user_id AND program_id='five_sessions_month' AND earned_at IS NULL;
 END IF;
END; $$;
CREATE FUNCTION public.earn_pro_offer_on_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='completed' AND NEW.deleted_at IS NULL THEN PERFORM public.earn_five_session_offer(NEW.user_id); END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER earn_pro_offer_on_session AFTER INSERT OR UPDATE OF status,deleted_at ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION public.earn_pro_offer_on_session();
REVOKE ALL ON FUNCTION public.earn_five_session_offer(uuid),public.earn_pro_offer_on_session() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.earn_five_session_offer(uuid),public.earn_pro_offer_on_session() TO service_role;

CREATE FUNCTION public.issue_pro_offer(p_user_id uuid,p_program_id text,p_code_hash text,p_reference text,p_terms_version text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE p public.pro_offer_programs%ROWTYPE; award_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT * INTO p FROM public.pro_offer_programs WHERE id=p_program_id;
 IF p_terms_version IS DISTINCT FROM p.terms_version THEN RAISE EXCEPTION 'Offer terms not approved'; END IF;
 IF p.id IS NULL OR NOT p.enabled OR p.approved_at>now() OR p.expires_at<=now() THEN RAISE EXCEPTION 'Offer program not approved'; END IF;
 IF EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND program_id=p_program_id) THEN RAISE EXCEPTION 'Offer already issued'; END IF;
 IF (SELECT count(*) FROM public.pro_offer_awards WHERE program_id=p_program_id)>=p.max_awards THEN RAISE EXCEPTION 'Offer budget exhausted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles profile JOIN auth.users u ON u.id=profile.id WHERE profile.id=p_user_id AND profile.analytics_is_real_user=true AND u.email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Unverified offer recipient'; END IF;
 INSERT INTO public.pro_offer_awards(user_id,program_id,code_hash,eligibility_reference,terms_version,earned_at)
 VALUES(p_user_id,p_program_id,p_code_hash,p_reference,p_terms_version,CASE WHEN p_program_id='return_three_months' THEN now() END) RETURNING id INTO award_id;
 PERFORM public.earn_five_session_offer(p_user_id);
 RETURN award_id;
END; $$;

CREATE FUNCTION public.preview_pro_offer(p_user_id uuid,p_code_hash text) RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT jsonb_build_object('status','preview','months',p.months,'terms_version',a.terms_version,'state',a.state,
 'completed_sessions',(SELECT count(*) FROM public.sessions WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL))
 FROM public.pro_offer_awards a JOIN public.pro_offer_programs p ON p.id=a.program_id WHERE a.user_id=p_user_id AND a.code_hash=p_code_hash),jsonb_build_object('status','not_found'));
$$;
REVOKE ALL ON FUNCTION public.preview_pro_offer(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preview_pro_offer(uuid,text) TO service_role;

CREATE FUNCTION public.reserve_pro_offer(p_user_id uuid,p_code_hash text,p_entitlement_id text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.pro_offer_awards%ROWTYPE; p public.pro_offer_programs%ROWTYPE; ids uuid[]; token uuid; expiry timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT * INTO a FROM public.pro_offer_awards WHERE user_id=p_user_id AND code_hash=p_code_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
 IF a.state='verified' THEN RETURN jsonb_build_object('status','verified','expires_at',a.expires_at,'mirror_verified',a.mirror_verified_at IS NOT NULL); END IF;
 IF a.state IN ('handoff_started','unknown') THEN RETURN jsonb_build_object('status','reconciliation_required'); END IF;
 IF EXISTS(SELECT 1 FROM public.pro_offer_awards WHERE user_id=p_user_id AND state IN ('reserved','handoff_started','unknown') AND (id<>a.id OR reserved_at>now()-interval '2 minutes')) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO p FROM public.pro_offer_programs WHERE id=a.program_id;
 IF NOT p.enabled THEN RETURN jsonb_build_object('status','paused'); END IF;
 -- An issued/earned right survives campaign expiry and email opt-out.
 IF a.earned_at IS NULL THEN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.sessions WHERE user_id=p_user_id AND status='completed' AND deleted_at IS NULL ORDER BY id LIMIT 5) completed;
  IF coalesce(cardinality(ids),0)<5 THEN RETURN jsonb_build_object('status','not_earned','completed_sessions',coalesce(cardinality(ids),0)); END IF;
  UPDATE public.pro_offer_awards SET earned_at=now(),session_ids=ids WHERE id=a.id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.user_entitlements WHERE user_id=p_user_id AND (is_pro OR is_trialing) AND (expires_at IS NULL OR expires_at>now()))
 OR EXISTS(SELECT 1 FROM public.earned_pro_grants WHERE user_id=p_user_id AND revoked_at IS NULL AND expires_at>now()) THEN
  UPDATE public.pro_offer_awards SET state='held',reason='active_access' WHERE id=a.id;
  RETURN jsonb_build_object('status','held_active_access');
 END IF;
 IF nullif(trim(p_entitlement_id),'') IS NULL THEN RAISE EXCEPTION 'Missing entitlement'; END IF;
 token:=gen_random_uuid();
 -- UTC calendar arithmetic clamps month ends and avoids daylight-saving drift.
 expiry:=((date_trunc('second',now()) AT TIME ZONE 'UTC')+make_interval(months=>p.months)) AT TIME ZONE 'UTC';
 UPDATE public.pro_offer_awards SET state='reserved',reason=NULL,reservation_id=token,reserved_at=now(),expires_at=expiry,entitlement_id=p_entitlement_id WHERE id=a.id;
 RETURN jsonb_build_object('status','reserved','award_id',a.id,'reservation_id',token,'user_id',a.user_id,'expires_at',expiry,'entitlement_id',p_entitlement_id);
END; $$;
CREATE FUNCTION public.begin_pro_offer(p_award_id uuid,p_reservation_id uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 UPDATE public.pro_offer_awards a SET state='handoff_started',handoff_at=now() WHERE a.id=p_award_id AND a.reservation_id=p_reservation_id
 AND a.state='reserved' AND a.reserved_at>now()-interval '2 minutes'
 AND EXISTS(SELECT 1 FROM public.pro_offer_programs p WHERE p.id=a.program_id AND p.enabled)
 AND NOT EXISTS(SELECT 1 FROM public.user_entitlements e WHERE e.user_id=a.user_id AND (e.is_pro OR e.is_trialing) AND (e.expires_at IS NULL OR e.expires_at>now()));
 RETURN FOUND;
END; $$;
CREATE FUNCTION public.hold_pro_offer(p_award_id uuid,p_reservation_id uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.pro_offer_awards SET state='held',reason=p_reason WHERE id=p_award_id AND reservation_id=p_reservation_id AND state='reserved';
END; $$;
CREATE FUNCTION public.unknown_pro_offer(p_award_id uuid,p_reservation_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.pro_offer_awards SET state='unknown',reason='provider_outcome_unknown' WHERE id=p_award_id AND reservation_id=p_reservation_id AND state='handoff_started';
END; $$;
CREATE FUNCTION public.verify_pro_offer(p_award_id uuid,p_reservation_id uuid,p_receipt jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.pro_offer_awards%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(739302);
 SELECT * INTO a FROM public.pro_offer_awards WHERE id=p_award_id AND reservation_id=p_reservation_id FOR UPDATE;
 IF NOT FOUND OR a.state NOT IN ('handoff_started','unknown','verified') THEN RAISE EXCEPTION 'Offer not handed off'; END IF;
 IF (p_receipt->>'store') IS DISTINCT FROM 'promotional' OR (p_receipt->>'user_id') IS DISTINCT FROM a.user_id::text
 OR (p_receipt->>'entitlement_id') IS DISTINCT FROM a.entitlement_id OR (p_receipt->>'expires_at')::timestamptz IS DISTINCT FROM a.expires_at
 OR nullif(p_receipt->>'product_id','') IS NULL THEN RAISE EXCEPTION 'Offer receipt mismatch'; END IF;
 INSERT INTO public.earned_pro_grants(user_id,entitlement_id,granted_at,expires_at,reason,offer_award_id)
 VALUES(a.user_id,a.entitlement_id,a.handoff_at,a.expires_at,a.program_id,a.id) ON CONFLICT(offer_award_id) DO NOTHING;
 UPDATE public.pro_offer_awards SET state='verified',verified_at=coalesce(verified_at,now()),provider_receipt=p_receipt,reason=NULL WHERE id=a.id;
END; $$;
CREATE FUNCTION public.pro_offer_reconciliation_queue() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM
 (SELECT id AS award_id,reservation_id,user_id,entitlement_id,expires_at FROM public.pro_offer_awards WHERE state='unknown' OR (state='handoff_started' AND handoff_at<now()-interval '2 minutes') ORDER BY handoff_at LIMIT 10) q;
$$;
CREATE VIEW public.pro_offer_attention WITH(security_invoker=true) AS
 SELECT id,user_id,program_id,state,reason,enrolled_at,earned_at,handoff_at,expires_at,verified_at,mirror_verified_at,
 CASE WHEN state='verified' AND mirror_verified_at IS NULL THEN 'mirror_unverified' WHEN state IN ('unknown','handoff_started') THEN 'reconcile_provider'
 WHEN state='reserved' AND reserved_at<now()-interval '2 minutes' THEN 'stale_reservation' WHEN earned_at IS NOT NULL AND state IN ('enrolled','held') THEN 'earned_unfulfilled' ELSE state END AS attention
 FROM public.pro_offer_awards;
REVOKE ALL ON public.pro_offer_attention FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.pro_offer_attention TO service_role;
-- Mirror proof is separate from the RevenueCat grant receipt. No entitlement writes here.
CREATE FUNCTION public.reconcile_pro_offer_mirrors() RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE matched integer;
BEGIN
 UPDATE public.pro_offer_awards a SET mirror_verified_at=now() FROM public.user_entitlements e WHERE e.user_id=a.user_id AND a.state='verified'
 AND a.mirror_verified_at IS NULL AND e.is_pro=true AND e.expires_at=a.expires_at AND e.product_id=a.provider_receipt->>'product_id';
 GET DIAGNOSTICS matched=ROW_COUNT;
 RETURN jsonb_build_object('matched',matched,'overdue_mirrors',(SELECT count(*) FROM public.pro_offer_awards WHERE state='verified' AND mirror_verified_at IS NULL AND verified_at<now()-interval '15 minutes'));
END; $$;
REVOKE ALL ON FUNCTION public.issue_pro_offer(uuid,text,text,text,text),public.reserve_pro_offer(uuid,text,text),public.begin_pro_offer(uuid,uuid),public.hold_pro_offer(uuid,uuid,text),public.unknown_pro_offer(uuid,uuid),public.verify_pro_offer(uuid,uuid,jsonb),public.pro_offer_reconciliation_queue(),public.reconcile_pro_offer_mirrors() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_pro_offer(uuid,text,text,text,text),public.reserve_pro_offer(uuid,text,text),public.begin_pro_offer(uuid,uuid),public.hold_pro_offer(uuid,uuid,text),public.unknown_pro_offer(uuid,uuid),public.verify_pro_offer(uuid,uuid,jsonb),public.pro_offer_reconciliation_queue(),public.reconcile_pro_offer_mirrors() TO service_role;
COMMIT;
