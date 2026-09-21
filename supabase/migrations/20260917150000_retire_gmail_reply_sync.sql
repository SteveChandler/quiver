BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER IF EXISTS require_fresh_email_replies ON public.email_contact_attempts;
DROP FUNCTION IF EXISTS public.require_fresh_email_replies();
DROP FUNCTION IF EXISTS public.gmail_reply_ingestion_ready();
DROP FUNCTION IF EXISTS public.claim_gmail_reply_sync(text);
DROP FUNCTION IF EXISTS public.note_gmail_reply_missing(uuid,text);
DROP FUNCTION IF EXISTS public.resolve_gmail_reply_missing(uuid,text);
DROP FUNCTION IF EXISTS public.record_gmail_reply_failure(uuid,boolean,text);
DROP FUNCTION IF EXISTS public.finish_gmail_reply_sync(uuid,text,integer);
DROP FUNCTION IF EXISTS public.fail_gmail_reply_sync(uuid);
DROP FUNCTION IF EXISTS public.auto_resolve_gmail_reply_missing(uuid,text);
DROP FUNCTION IF EXISTS public.gmail_reply_auto_resolved_24h();
DROP FUNCTION IF EXISTS public.retryable_gmail_reply_failure(uuid);
DROP FUNCTION IF EXISTS public.email_automation_dashboard();

CREATE OR REPLACE FUNCTION public.record_gmail_reply(p_lease_id uuid,p_mailbox text,p_message_id text,p_thread_id text,p_sender text,p_received_at timestamptz,p_in_reply_to text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
BEGIN
  PERFORM public.record_gmail_reply_v2(p_mailbox,p_message_id,p_thread_id,p_sender,p_received_at,p_in_reply_to);
END;
$function$;

DROP TABLE IF EXISTS public.email_reply_missing_messages;
DROP TABLE IF EXISTS public.email_reply_sync_runs;
DROP TABLE IF EXISTS public.email_reply_sync;

CREATE FUNCTION public.gmail_reply_known(p_message_ids text[]) RETURNS text[]
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
  SELECT coalesce(array_agg(input.message_id ORDER BY input.ordinality), '{}'::text[])
  FROM unnest(coalesce(p_message_ids, '{}'::text[])) WITH ORDINALITY AS input(message_id, ordinality)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.email_reply_events e
    WHERE e.provider_id LIKE 'gmail:%:' || input.message_id
  );
$function$;

CREATE FUNCTION public.record_gmail_reply_v2(p_mailbox text,p_message_id text,p_thread_id text,p_sender text,p_received_at timestamptz,p_in_reply_to text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE key text;
BEGIN
 IF nullif(p_mailbox,'') IS NULL OR nullif(p_message_id,'') IS NULL OR nullif(p_thread_id,'') IS NULL
   OR p_received_at IS NULL OR p_received_at>now()+interval '1 minute' THEN RAISE EXCEPTION 'Invalid reply metadata'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE lower(trim(email))=lower(trim(p_sender))) THEN RETURN; END IF;
 key := 'gmail:'||lower(trim(p_mailbox))||':'||p_message_id;
 PERFORM public.record_email_reply(key,key,p_sender,p_received_at);
 UPDATE public.email_reply_events SET thread_id=p_thread_id,in_reply_to=p_in_reply_to WHERE provider_id=key;
 UPDATE public.email_contact_attempts SET state='cancelled',error_code='reply_paused' WHERE state='reserved' AND user_id IN
   (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(p_sender)));
 UPDATE public.email_lifecycle_recipients SET status='held',reason='reply_paused',next_eligible_at=NULL WHERE user_id IN
   (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(p_sender)));
END;
$function$;

REVOKE ALL ON FUNCTION public.gmail_reply_known(text[]),public.record_gmail_reply_v2(text,text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gmail_reply_known(text[]),public.record_gmail_reply_v2(text,text,text,text,timestamptz,text) TO service_role;

CREATE OR REPLACE FUNCTION public.email_automation_dashboard() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $function$
 SELECT jsonb_build_object(
  'due',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT user_id,job,status,reason,next_eligible_at,due_age,attempt_state,provider_id FROM public.email_lifecycle_due ORDER BY evaluated_at LIMIT 50) q),'[]'),
  'attention',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT kind,record_id,reason FROM public.email_automation_attention ORDER BY kind,record_id LIMIT 100) q),'[]'),
  'offers',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,user_id,program_id,state,attention,verified_at,mirror_verified_at FROM public.pro_offer_attention LIMIT 100) q),'[]'),
  'runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT route,job,status,started_at,finished_at FROM public.cron_runs WHERE route IN ('/api/cron/email-lifecycle','/api/cron/pro-offer-reconcile') ORDER BY started_at DESC LIMIT 20) q),'[]'),
  'trial_feedback',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.trial_feedback_outcomes ORDER BY (attention IS NOT NULL) DESC,submitted_at DESC LIMIT 100) q),'[]'),
  'reply_check',coalesce((SELECT summary->'reply_check' FROM public.cron_runs WHERE job='email-lifecycle' ORDER BY started_at DESC LIMIT 1),'null'::jsonb)
 );
$function$;
REVOKE ALL ON FUNCTION public.email_automation_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_automation_dashboard() TO service_role;

COMMIT;
