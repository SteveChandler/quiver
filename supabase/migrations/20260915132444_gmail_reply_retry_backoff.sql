BEGIN;
-- Bound repeat Gmail work to 1, 2, 4, 8, then 15 minute retry intervals.
-- No cursor, missing-message resolution, or outbound eligibility is changed.
CREATE INDEX IF NOT EXISTS email_reply_sync_runs_recent_idx
 ON public.email_reply_sync_runs(started_at DESC,id DESC);

CREATE OR REPLACE FUNCTION public.claim_gmail_reply_sync(p_mailbox text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.email_reply_sync%ROWTYPE; run_id uuid; missing jsonb; previous_run record; failures integer := 0; retry_at timestamptz;
BEGIN
 SELECT * INTO s FROM public.email_reply_sync WHERE singleton FOR UPDATE;
 IF s.mailbox IS DISTINCT FROM lower(trim(p_mailbox)) OR s.status='failed' THEN RAISE EXCEPTION 'Mailbox needs reviewed bootstrap or recovery'; END IF;
 IF s.lease_expires_at>now() THEN RAISE EXCEPTION 'Reply sync already running'; END IF;
 -- The existing run ledger survives cold starts and serializes all callers under
 -- the mailbox lock. Only consecutive completed failures delay another attempt.
 FOR previous_run IN
  SELECT status,finished_at FROM public.email_reply_sync_runs ORDER BY started_at DESC,id DESC LIMIT 5
 LOOP
  EXIT WHEN previous_run.status <> 'error' OR previous_run.finished_at IS NULL;
  IF failures=0 THEN retry_at:=previous_run.finished_at; END IF;
  failures:=failures+1;
 END LOOP;
 IF s.status='pending' AND failures>0 THEN
  retry_at:=retry_at+make_interval(secs=>least(900,60*power(2,failures-1)::integer));
  IF retry_at>now() THEN
   RETURN jsonb_build_object('status','backoff','retry_after_seconds',ceil(extract(epoch FROM retry_at-now()))::integer);
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(message_id ORDER BY first_seen_at,message_id),'[]') INTO missing
 FROM public.email_reply_missing_messages WHERE mailbox=s.mailbox AND resolved_at IS NULL;
 IF jsonb_array_length(missing)>200 THEN RAISE EXCEPTION 'Reply reconciliation capacity exceeded'; END IF;
 UPDATE public.email_reply_sync_runs SET status='error',finished_at=now(),error_code='gmail_lease_expired' WHERE status='started';
 INSERT INTO public.email_reply_sync_runs(start_history_id) VALUES(s.history_id) RETURNING id INTO run_id;
 UPDATE public.email_reply_sync SET status='running',lease_id=run_id,lease_expires_at=now()+interval '90 seconds' WHERE singleton;
 RETURN jsonb_build_object('lease_id',run_id,'history_id',s.history_id,'missing_ids',missing);
END; $$;

COMMIT;
