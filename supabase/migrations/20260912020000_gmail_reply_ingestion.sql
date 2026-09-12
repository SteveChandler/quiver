BEGIN;
-- Bootstrap requires a reviewed history boundary, never an automatic 'start now'.
CREATE TABLE public.email_reply_sync (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), mailbox text NOT NULL,
 history_id text NOT NULL CHECK(history_id ~ '^[0-9]+$'), review_reference text NOT NULL CHECK(length(trim(review_reference))>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','healthy','failed')),
 last_synced_at timestamptz, lease_id uuid, lease_expires_at timestamptz
);
CREATE TABLE public.email_reply_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'started' CHECK(status IN ('started','ok','error')),
 start_history_id text NOT NULL, end_history_id text, processed integer NOT NULL DEFAULT 0
);
ALTER TABLE public.email_reply_events ADD COLUMN thread_id text, ADD COLUMN in_reply_to text;
ALTER TABLE public.email_reply_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_reply_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_reply_sync,public.email_reply_sync_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_reply_sync,public.email_reply_sync_runs TO service_role;

CREATE FUNCTION public.claim_gmail_reply_sync(p_mailbox text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.email_reply_sync%ROWTYPE; run_id uuid;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.mailbox IS DISTINCT FROM lower(trim(p_mailbox)) OR s.status='failed' THEN RAISE EXCEPTION 'Mailbox needs reviewed bootstrap or recovery'; END IF;
 IF s.lease_expires_at>now() THEN RAISE EXCEPTION 'Reply sync already running'; END IF;
 UPDATE public.email_reply_sync_runs SET status='error',finished_at=now() WHERE status='started';
 INSERT INTO public.email_reply_sync_runs(start_history_id) VALUES(s.history_id) RETURNING id INTO run_id;
 UPDATE public.email_reply_sync SET status='running',lease_id=run_id,lease_expires_at=now()+interval '90 seconds' WHERE singleton;
 RETURN jsonb_build_object('lease_id',run_id,'history_id',s.history_id);
END; $$;
CREATE FUNCTION public.record_gmail_reply(p_lease_id uuid,p_mailbox text,p_message_id text,p_thread_id text,p_sender text,p_received_at timestamptz,p_in_reply_to text)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE key text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.email_reply_sync WHERE singleton AND lease_id=p_lease_id AND mailbox=p_mailbox AND lease_expires_at>now() AND status='running') THEN RAISE EXCEPTION 'Invalid reply lease'; END IF;
 IF nullif(p_message_id,'') IS NULL OR nullif(p_thread_id,'') IS NULL OR p_received_at IS NULL OR p_received_at>now()+interval '1 minute' THEN RAISE EXCEPTION 'Invalid reply metadata'; END IF;
 -- Ignore unrelated mailbox contacts; exact sender matches pause every matching profile.
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE lower(trim(email))=lower(trim(p_sender))) THEN RETURN; END IF;
 key := 'gmail:'||p_mailbox||':'||p_message_id;
 PERFORM public.record_email_reply(key,key,p_sender,p_received_at);
 UPDATE public.email_reply_events SET thread_id=p_thread_id,in_reply_to=p_in_reply_to WHERE provider_id=key;
 UPDATE public.email_contact_attempts SET state='cancelled',error_code='reply_paused' WHERE state='reserved' AND user_id IN
  (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(p_sender)));
 UPDATE public.email_lifecycle_recipients SET status='held',reason='reply_paused',next_eligible_at=NULL WHERE user_id IN
  (SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(p_sender)));
END; $$;
CREATE FUNCTION public.finish_gmail_reply_sync(p_lease_id uuid,p_history_id text,p_processed integer) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.email_reply_sync SET history_id=p_history_id,status='healthy',last_synced_at=now(),lease_id=NULL,lease_expires_at=NULL
 WHERE singleton AND status='running' AND lease_id=p_lease_id AND lease_expires_at>now()
 AND p_history_id ~ '^[0-9]+$' AND p_history_id::numeric>=history_id::numeric AND p_processed BETWEEN 0 AND 200;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired reply checkpoint'; END IF;
 UPDATE public.email_reply_sync_runs SET status='ok',finished_at=now(),end_history_id=p_history_id,processed=p_processed WHERE id=p_lease_id;
END; $$;
CREATE FUNCTION public.fail_gmail_reply_sync(p_lease_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.email_reply_sync SET status='failed',lease_id=NULL,lease_expires_at=NULL WHERE singleton AND lease_id=p_lease_id;
 IF FOUND THEN
  UPDATE public.email_reply_sync_runs SET status='error',finished_at=now() WHERE id=p_lease_id;
  UPDATE public.email_contact_controls SET lifecycle_enabled=false WHERE singleton;
 END IF;
END; $$;
CREATE FUNCTION public.require_fresh_email_replies() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.lifecycle_job IS NOT NULL AND NEW.state IN ('reserved','handoff_started') AND NOT EXISTS
 (SELECT 1 FROM public.email_reply_sync WHERE singleton AND status='healthy' AND last_synced_at>now()-interval '2 minutes') THEN
  RAISE EXCEPTION 'Reply ingestion is not healthy and fresh';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER require_fresh_email_replies BEFORE INSERT OR UPDATE OF state ON public.email_contact_attempts
 FOR EACH ROW EXECUTE FUNCTION public.require_fresh_email_replies();
REVOKE ALL ON FUNCTION public.claim_gmail_reply_sync(text),public.record_gmail_reply(uuid,text,text,text,text,timestamptz,text),public.finish_gmail_reply_sync(uuid,text,integer),public.fail_gmail_reply_sync(uuid),public.require_fresh_email_replies() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gmail_reply_sync(text),public.record_gmail_reply(uuid,text,text,text,text,timestamptz,text),public.finish_gmail_reply_sync(uuid,text,integer),public.fail_gmail_reply_sync(uuid),public.require_fresh_email_replies() TO service_role;
COMMIT;
