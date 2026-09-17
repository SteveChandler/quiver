BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.email_reply_missing_messages DROP CONSTRAINT IF EXISTS email_reply_missing_messages_check;
ALTER TABLE public.email_reply_missing_messages ADD CONSTRAINT email_reply_missing_messages_check CHECK(
 (resolved_at IS NULL AND resolution IS NULL AND review_reference IS NULL)
 OR (resolved_at IS NOT NULL AND resolution IS NOT NULL AND (
   resolution IN ('metadata_recovered','deleted_before_sync')
   OR (resolution='reviewed_unrecoverable' AND nullif(trim(review_reference),'') IS NOT NULL)
 ))
);

CREATE OR REPLACE FUNCTION public.auto_resolve_gmail_reply_missing(p_lease_id uuid,p_message_id text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $function$
DECLARE s public.email_reply_sync%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.lease_id IS DISTINCT FROM p_lease_id OR (s.lease_expires_at>now()) IS NOT TRUE OR s.status IS DISTINCT FROM 'running' THEN RAISE EXCEPTION 'Invalid reply lease'; END IF;
 UPDATE public.email_reply_missing_messages SET resolved_at=now(),resolution='deleted_before_sync'
 WHERE mailbox=s.mailbox AND message_id=p_message_id AND resolved_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gmail_reply_auto_resolved_24h() RETURNS integer
LANGUAGE sql SET search_path=public,pg_temp AS $function$
 SELECT count(*)::integer FROM public.email_reply_missing_messages
 WHERE resolution='deleted_before_sync' AND resolved_at>now()-interval '24 hours';
$function$;

CREATE OR REPLACE FUNCTION public.finish_gmail_reply_sync(p_lease_id uuid,p_history_id text,p_processed integer) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $function$
DECLARE s public.email_reply_sync%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.status IS DISTINCT FROM 'running' OR s.lease_id IS DISTINCT FROM p_lease_id OR (s.lease_expires_at>now()) IS NOT TRUE
 OR p_history_id IS NULL OR p_history_id !~ '^[0-9]+$' OR p_history_id::numeric<s.history_id::numeric
 OR p_processed IS NULL OR p_processed NOT BETWEEN 0 AND 200 THEN RAISE EXCEPTION 'Invalid or expired reply checkpoint'; END IF;
 UPDATE public.email_reply_sync SET history_id=p_history_id,status='healthy',last_synced_at=now(),lease_id=NULL,lease_expires_at=NULL WHERE singleton;
 UPDATE public.email_reply_sync_runs SET status='ok',finished_at=now(),end_history_id=p_history_id,processed=p_processed,error_code=NULL WHERE id=p_lease_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gmail_reply_ingestion_ready() RETURNS boolean
LANGUAGE sql SET search_path=public,pg_temp AS $function$
 SELECT EXISTS(SELECT 1 FROM public.email_reply_sync WHERE singleton AND status='healthy' AND last_synced_at>now()-interval '90 seconds');
$function$;

CREATE OR REPLACE FUNCTION public.email_automation_dashboard() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $function$
 SELECT jsonb_build_object(
 'due',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT user_id,job,status,reason,next_eligible_at,due_age,attempt_state,provider_id FROM public.email_lifecycle_due ORDER BY evaluated_at LIMIT 50) q),'[]'),
 'attention',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT kind,record_id,reason FROM (SELECT 'reply_gap'::text AS kind,message_id AS record_id,'gmail_message_missing'::text AS reason,0 AS priority FROM public.email_reply_missing_messages WHERE resolved_at IS NULL UNION ALL SELECT 'reply_sync','mailbox',coalesce((SELECT error_code FROM public.email_reply_sync_runs WHERE error_code IS NOT NULL ORDER BY started_at DESC LIMIT 1),'gmail_recovery_required'),0 FROM public.email_reply_sync WHERE status IN ('pending','failed') UNION ALL SELECT 'reply_sync','mailbox','reply_gap_auto_resolved_24h',0 WHERE public.gmail_reply_auto_resolved_24h()>0 UNION ALL SELECT kind,record_id,reason,1 FROM public.email_automation_attention) attention ORDER BY priority,record_id LIMIT 100) q),'[]'),
 'offers',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,user_id,program_id,state,attention,verified_at,mirror_verified_at FROM public.pro_offer_attention LIMIT 100) q),'[]'),
 'runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT route,job,status,started_at,finished_at FROM public.cron_runs WHERE route IN ('/api/cron/email-lifecycle','/api/cron/pro-offer-reconcile','/api/cron/email-replies') ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'trial_feedback',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.trial_feedback_outcomes ORDER BY (attention IS NOT NULL) DESC,submitted_at DESC LIMIT 100) q),'[]'),
 'reply_runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT status,started_at,finished_at,start_history_id,end_history_id,processed,error_code FROM public.email_reply_sync_runs ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'reply_sync', (SELECT jsonb_build_object('status',status,'last_synced_at',last_synced_at,'lease_expires_at',lease_expires_at,
 'unresolved_messages',(SELECT count(*) FROM public.email_reply_missing_messages WHERE resolved_at IS NULL),
 'auto_resolved_24h',public.gmail_reply_auto_resolved_24h(),
 'last_error',(SELECT error_code FROM public.email_reply_sync_runs ORDER BY started_at DESC LIMIT 1)) FROM public.email_reply_sync WHERE singleton));
$function$;

REVOKE ALL ON FUNCTION public.auto_resolve_gmail_reply_missing(uuid,text),public.gmail_reply_auto_resolved_24h() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_resolve_gmail_reply_missing(uuid,text),public.gmail_reply_auto_resolved_24h() TO service_role;
REVOKE ALL ON FUNCTION public.finish_gmail_reply_sync(uuid,text,integer),public.gmail_reply_ingestion_ready(),public.email_automation_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_gmail_reply_sync(uuid,text,integer),public.gmail_reply_ingestion_ready(),public.email_automation_dashboard() TO service_role;

COMMIT;
