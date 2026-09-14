BEGIN;

ALTER TABLE public.email_reply_sync_runs ADD COLUMN error_code text
 CHECK(error_code IS NULL OR error_code ~ '^gmail_[a-z0-9_]{1,80}$');
CREATE TABLE public.email_reply_missing_messages (
 mailbox text NOT NULL, message_id text NOT NULL CHECK(length(message_id) BETWEEN 1 AND 256),
 start_history_id text NOT NULL CHECK(start_history_id ~ '^[0-9]+$'),
 first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz, resolution text, review_reference text,
 PRIMARY KEY(mailbox,message_id),
 CHECK((resolved_at IS NULL AND resolution IS NULL AND review_reference IS NULL)
 OR (resolved_at IS NOT NULL AND resolution IS NOT NULL AND (resolution='metadata_recovered'
 OR (resolution='reviewed_unrecoverable' AND nullif(trim(review_reference),'') IS NOT NULL))))
);
ALTER TABLE public.email_reply_missing_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_reply_missing_messages FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_reply_missing_messages TO service_role;

CREATE OR REPLACE FUNCTION public.claim_gmail_reply_sync(p_mailbox text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.email_reply_sync%ROWTYPE; run_id uuid; missing jsonb;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.mailbox IS DISTINCT FROM lower(trim(p_mailbox)) OR s.status='failed' THEN RAISE EXCEPTION 'Mailbox needs reviewed bootstrap or recovery'; END IF;
 IF s.lease_expires_at>now() THEN RAISE EXCEPTION 'Reply sync already running'; END IF;
 SELECT coalesce(jsonb_agg(message_id ORDER BY first_seen_at,message_id),'[]') INTO missing
 FROM public.email_reply_missing_messages WHERE mailbox=s.mailbox AND resolved_at IS NULL;
 IF jsonb_array_length(missing)>200 THEN RAISE EXCEPTION 'Reply reconciliation capacity exceeded'; END IF;
 UPDATE public.email_reply_sync_runs SET status='error',finished_at=now(),error_code='gmail_lease_expired' WHERE status='started';
 INSERT INTO public.email_reply_sync_runs(start_history_id) VALUES(s.history_id) RETURNING id INTO run_id;
 UPDATE public.email_reply_sync SET status='running',lease_id=run_id,lease_expires_at=now()+interval '90 seconds' WHERE singleton;
 RETURN jsonb_build_object('lease_id',run_id,'history_id',s.history_id,'missing_ids',missing);
END; $$;

CREATE FUNCTION public.note_gmail_reply_missing(p_lease_id uuid,p_message_id text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.email_reply_sync%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.lease_id IS DISTINCT FROM p_lease_id OR (s.lease_expires_at>now()) IS NOT TRUE OR s.status IS DISTINCT FROM 'running' THEN RAISE EXCEPTION 'Invalid reply lease'; END IF;
 INSERT INTO public.email_reply_missing_messages(mailbox,message_id,start_history_id)
 VALUES(s.mailbox,p_message_id,s.history_id)
 ON CONFLICT(mailbox,message_id) DO UPDATE SET last_seen_at=now();
END; $$;

CREATE FUNCTION public.resolve_gmail_reply_missing(p_lease_id uuid,p_message_id text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.email_reply_sync%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.lease_id IS DISTINCT FROM p_lease_id OR (s.lease_expires_at>now()) IS NOT TRUE OR s.status IS DISTINCT FROM 'running' THEN RAISE EXCEPTION 'Invalid reply lease'; END IF;
 UPDATE public.email_reply_missing_messages SET resolved_at=now(),resolution='metadata_recovered'
 WHERE mailbox=s.mailbox AND message_id=p_message_id AND resolved_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.finish_gmail_reply_sync(p_lease_id uuid,p_history_id text,p_processed integer) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.email_reply_sync%ROWTYPE; has_gaps boolean;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.status IS DISTINCT FROM 'running' OR s.lease_id IS DISTINCT FROM p_lease_id OR (s.lease_expires_at>now()) IS NOT TRUE
 OR p_history_id IS NULL OR p_history_id !~ '^[0-9]+$' OR p_history_id::numeric<s.history_id::numeric
 OR p_processed IS NULL OR p_processed NOT BETWEEN 0 AND 200 THEN RAISE EXCEPTION 'Invalid or expired reply checkpoint'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.email_reply_missing_messages WHERE mailbox=s.mailbox AND resolved_at IS NULL) INTO has_gaps;
 UPDATE public.email_reply_sync SET history_id=p_history_id,status=CASE WHEN has_gaps THEN 'pending' ELSE 'healthy' END,
 last_synced_at=now(),lease_id=NULL,lease_expires_at=NULL WHERE singleton;
 UPDATE public.email_reply_sync_runs SET status=CASE WHEN has_gaps THEN 'error' ELSE 'ok' END,finished_at=now(),
 end_history_id=p_history_id,processed=p_processed,error_code=CASE WHEN has_gaps THEN 'gmail_message_gaps_unresolved' END WHERE id=p_lease_id;
END; $$;

CREATE FUNCTION public.record_gmail_reply_failure(p_lease_id uuid,p_retryable boolean,p_error_code text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF p_retryable IS NULL OR p_error_code IS NULL OR p_error_code !~ '^gmail_[a-z0-9_]{1,80}$' THEN RAISE EXCEPTION 'Invalid reply failure code'; END IF;
 UPDATE public.email_reply_sync SET status=CASE WHEN p_retryable THEN 'pending' ELSE 'failed' END,lease_id=NULL,lease_expires_at=NULL
 WHERE singleton AND lease_id=p_lease_id AND status='running';
 IF FOUND THEN
  UPDATE public.email_reply_sync_runs SET status='error',finished_at=now(),error_code=p_error_code WHERE id=p_lease_id;
  -- Keep the operator's lifecycle choice intact; freshness and gap gates close handoff.
 END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.gmail_reply_ingestion_ready() RETURNS boolean
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.email_reply_sync s WHERE singleton AND status='healthy' AND last_synced_at>now()-interval '90 seconds'
 AND NOT EXISTS(SELECT 1 FROM public.email_reply_missing_messages m WHERE m.mailbox=s.mailbox AND m.resolved_at IS NULL));
$$;
CREATE OR REPLACE FUNCTION public.require_fresh_email_replies() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.lifecycle_job IS NOT NULL AND NEW.state IN ('reserved','handoff_started') AND NOT public.gmail_reply_ingestion_ready() THEN
  RAISE EXCEPTION 'Reply ingestion is not healthy and fresh';
 END IF;
 RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.note_gmail_reply_missing(uuid,text),public.resolve_gmail_reply_missing(uuid,text),public.record_gmail_reply_failure(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.note_gmail_reply_missing(uuid,text),public.resolve_gmail_reply_missing(uuid,text),public.record_gmail_reply_failure(uuid,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.email_automation_dashboard() RETURNS jsonb
LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
 'due',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT user_id,job,status,reason,next_eligible_at,due_age,attempt_state,provider_id FROM public.email_lifecycle_due ORDER BY evaluated_at LIMIT 50) q),'[]'),
 'attention',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT kind,record_id,reason FROM (SELECT 'reply_gap'::text AS kind,message_id AS record_id,'gmail_message_missing'::text AS reason,0 AS priority FROM public.email_reply_missing_messages WHERE resolved_at IS NULL UNION ALL SELECT 'reply_sync','mailbox',coalesce((SELECT error_code FROM public.email_reply_sync_runs WHERE error_code IS NOT NULL ORDER BY started_at DESC LIMIT 1),'gmail_recovery_required'),0 FROM public.email_reply_sync WHERE status IN ('pending','failed') UNION ALL SELECT kind,record_id,reason,1 FROM public.email_automation_attention) attention ORDER BY priority,record_id LIMIT 100) q),'[]'),
 'offers',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,user_id,program_id,state,attention,verified_at,mirror_verified_at FROM public.pro_offer_attention LIMIT 100) q),'[]'),
 'runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT route,job,status,started_at,finished_at FROM public.cron_runs WHERE route IN ('/api/cron/email-lifecycle','/api/cron/pro-offer-reconcile','/api/cron/email-replies') ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'trial_feedback',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM public.trial_feedback_outcomes ORDER BY (attention IS NOT NULL) DESC,submitted_at DESC LIMIT 100) q),'[]'),
 'reply_runs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT status,started_at,finished_at,start_history_id,end_history_id,processed,error_code FROM public.email_reply_sync_runs ORDER BY started_at DESC LIMIT 20) q),'[]'),
 'reply_sync', (SELECT jsonb_build_object('status',status,'last_synced_at',last_synced_at,'lease_expires_at',lease_expires_at,
 'unresolved_messages',(SELECT count(*) FROM public.email_reply_missing_messages WHERE resolved_at IS NULL),
 'last_error',(SELECT error_code FROM public.email_reply_sync_runs ORDER BY started_at DESC LIMIT 1)) FROM public.email_reply_sync WHERE singleton));
$$;
COMMIT;
