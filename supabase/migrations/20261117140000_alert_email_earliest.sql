-- Idea 7 (earliest alert email). Expand only.
-- 1. profiles.alert_email_earliest: the local time a condition alert email may start. Default '09:00' is today's rule.
-- 2. Grants as daily_call_time: authenticated may read and change only this column on its own row (RLS);
--    anon gets no SELECT. 20260718142000 keeps new profile columns private until granted.
-- 3. claim_requested_email_alert starts the condition alert window at that time; the end stays 16:59:59.
--    Lifecycle email (evaluate_email_lifecycle) keeps 09:00-16:59.
-- Precondition (prod): md5(pg_get_functiondef('public.claim_requested_email_alert(uuid,text,jsonb)'::regprocedure))
--   = 'db9912fb523352d6a0c5a287bd9b456d' (the 20261031200000 text).
-- Off switch: UPDATE public.profiles SET alert_email_earliest='09:00' WHERE alert_email_earliest<>'09:00';
-- Rollback: re-apply the claim_requested_email_alert block of 20261031200000_lifecycle_timezone_fallback.sql,
--   then (only after no client reads it) ALTER TABLE public.profiles DROP COLUMN alert_email_earliest.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS alert_email_earliest text NOT NULL DEFAULT '09:00'
  CONSTRAINT profiles_alert_email_earliest_check CHECK (alert_email_earliest IN ('05:00','06:00','07:00','09:00'));

GRANT SELECT (alert_email_earliest), UPDATE (alert_email_earliest) ON TABLE public.profiles TO authenticated;
GRANT SELECT (alert_email_earliest), UPDATE (alert_email_earliest) ON TABLE public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.claim_requested_email_alert(p_user_id uuid, p_episode text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE p public.profiles%ROWTYPE; a uuid; v_cap integer; v_timezone text;
BEGIN
 PERFORM pg_advisory_xact_lock(739301);
 IF NOT EXISTS (SELECT 1 FROM public.email_contact_controls WHERE singleton AND enabled AND lifecycle_enabled) THEN
  RETURN jsonb_build_object('allowed',false,'reason','disabled');
 END IF;
 SELECT daily_cap INTO v_cap FROM public.email_contact_controls WHERE singleton;
 SELECT * INTO p FROM public.profiles WHERE id=p_user_id;
 v_timezone := public.email_contact_timezone(p.timezone,p.home_beach_id);
 IF p.analytics_is_real_user IS DISTINCT FROM true OR p.notif_email_enabled IS DISTINCT FROM true
  OR lower(trim(p.email)) IS DISTINCT FROM lower(trim(p_payload->>'to'))
  OR NOT EXISTS(SELECT 1 FROM public.alert_rules WHERE user_id=p_user_id AND enabled AND notify_email)
  OR EXISTS(SELECT 1 FROM public.email_suppression_list WHERE lower(trim(email))=lower(trim(p.email)))
  OR EXISTS(SELECT 1 FROM public.email_contact_state WHERE user_id=p_user_id AND paused_at IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.user_email_prefs WHERE user_id=p_user_id AND email_frequency='off')
  OR (SELECT count(*) FROM public.profiles WHERE lower(trim(email))=lower(trim(p.email)))<>1
 THEN RETURN jsonb_build_object('allowed',false,'reason','ineligible_or_suppressed'); END IF;
 -- Condition alerts start at the user's earliest alert email time; lifecycle email keeps 09:00 (evaluate_email_lifecycle).
 IF (now() AT TIME ZONE v_timezone)::time NOT BETWEEN coalesce(p.alert_email_earliest,'09:00')::time AND time '16:59:59' THEN
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
END; $function$;
REVOKE ALL ON FUNCTION public.claim_requested_email_alert(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_requested_email_alert(uuid,text,jsonb) TO service_role;

COMMIT;
