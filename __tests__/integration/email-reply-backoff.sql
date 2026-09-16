BEGIN;
DO $$
DECLARE lease jsonb; deferred jsonb; run uuid; failures integer; runs_before integer;
BEGIN
 -- Disposable fixture database only; this transaction rolls back all test data.
 DELETE FROM email_reply_sync_runs;
 UPDATE email_reply_sync SET status='pending',history_id='300',lease_id=NULL,lease_expires_at=NULL;
 FOR failures IN 1..7 LOOP
  lease:=claim_gmail_reply_sync('mail@gmail.com');
  ASSERT lease ? 'lease_id', 'due retries must acquire a lease';
  run:=(lease->>'lease_id')::uuid;
  IF failures=1 THEN
   PERFORM note_gmail_reply_missing(run,'backoff-gap');
   PERFORM finish_gmail_reply_sync(run,'301',0);
  ELSE
   PERFORM record_gmail_reply_failure(run,true,'gmail_read_429');
  END IF;
  SELECT count(*) INTO runs_before FROM email_reply_sync_runs;
  deferred:=claim_gmail_reply_sync('mail@gmail.com');
  ASSERT deferred->>'status'='backoff';
  ASSERT (deferred->>'retry_after_seconds')::integer=least(900,60*power(2,failures-1)::integer);
  ASSERT (SELECT count(*) FROM email_reply_sync_runs)=runs_before, 'backoff must not create a run';
  ASSERT (SELECT status='pending' AND history_id='301' AND lease_id IS NULL FROM email_reply_sync);
  ASSERT NOT gmail_reply_ingestion_ready();
  ASSERT EXISTS(SELECT 1 FROM email_reply_missing_messages WHERE message_id='backoff-gap' AND resolved_at IS NULL);
  -- A rejected repeat claim does not extend the deadline.
  ASSERT claim_gmail_reply_sync('mail@gmail.com')=deferred;
  UPDATE email_reply_sync_runs SET started_at=started_at-interval '16 minutes',finished_at=finished_at-interval '16 minutes';
 END LOOP;
 lease:=claim_gmail_reply_sync('mail@gmail.com'); run:=(lease->>'lease_id')::uuid;
 BEGIN
  PERFORM claim_gmail_reply_sync('mail@gmail.com'); RAISE EXCEPTION 'overlapping lease allowed';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Reply sync already running'; END;
 PERFORM resolve_gmail_reply_missing(run,'backoff-gap');
 PERFORM finish_gmail_reply_sync(run,'302',0);
 ASSERT gmail_reply_ingestion_ready();
 UPDATE email_reply_sync_runs SET started_at=started_at-interval '1 second';
 lease:=claim_gmail_reply_sync('mail@gmail.com');
 ASSERT lease ? 'lease_id', 'healthy sync must not be delayed';
 run:=(lease->>'lease_id')::uuid;
 PERFORM record_gmail_reply_failure(run,true,'gmail_oauth_503');
 ASSERT (claim_gmail_reply_sync('mail@gmail.com')->>'retry_after_seconds')::integer=60, 'healthy checkpoint resets backoff';
 UPDATE email_reply_sync_runs SET started_at=started_at-interval '2 minutes',finished_at=finished_at-interval '2 minutes';
 lease:=claim_gmail_reply_sync('mail@gmail.com'); run:=(lease->>'lease_id')::uuid;
 PERFORM record_gmail_reply_failure(run,false,'gmail_history_expired');
 BEGIN
  PERFORM claim_gmail_reply_sync('mail@gmail.com'); RAISE EXCEPTION 'terminal failure retried';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Mailbox needs reviewed bootstrap or recovery'; END;
 ASSERT NOT gmail_reply_ingestion_ready();
 ASSERT NOT has_function_privilege('anon','claim_gmail_reply_sync(text)','execute');
 ASSERT NOT has_function_privilege('authenticated','claim_gmail_reply_sync(text)','execute');
 ASSERT has_function_privilege('service_role','claim_gmail_reply_sync(text)','execute');
END $$;
ROLLBACK;
