BEGIN;
DO $$
DECLARE lease jsonb; next_lease jsonb; run uuid;
BEGIN
 UPDATE email_reply_sync SET status='pending',history_id='200',lease_id=NULL,lease_expires_at=NULL;
 UPDATE email_contact_controls SET lifecycle_enabled=true WHERE singleton;
 lease:=claim_gmail_reply_sync('mail@gmail.com'); run:=(lease->>'lease_id')::uuid;
 ASSERT lease->'missing_ids'='[]'::jsonb;
 PERFORM note_gmail_reply_missing(run,'missing');
 PERFORM note_gmail_reply_missing(run,'missing');
 ASSERT (SELECT count(*) FROM email_reply_missing_messages)=1;
 BEGIN
  PERFORM resolve_gmail_reply_missing(gen_random_uuid(),'missing'); RAISE EXCEPTION 'wrong lease passed';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Invalid reply lease'; END;
 PERFORM record_gmail_reply(run,'mail@gmail.com','recovered-reply','thread','surfer@example.com',now(),NULL);
 PERFORM finish_gmail_reply_sync(run,'205',1);
 ASSERT (SELECT history_id='205' AND status='pending' FROM email_reply_sync);
 ASSERT (SELECT error_code='gmail_message_gaps_unresolved' AND end_history_id='205' AND processed=1 FROM email_reply_sync_runs WHERE id=run);
 ASSERT NOT gmail_reply_ingestion_ready();
 ASSERT (SELECT lifecycle_enabled FROM email_contact_controls);
 ASSERT EXISTS(SELECT 1 FROM email_contact_state WHERE user_id='11111111-1111-4111-8111-111111111111' AND paused_at IS NOT NULL);
 ASSERT EXISTS(SELECT 1 FROM jsonb_array_elements(email_automation_dashboard()->'attention') a WHERE a->>'reason'='gmail_message_missing');
 -- A mistaken healthy label must not defeat the independent missing-message gate.
 UPDATE email_reply_sync SET status='healthy';
 ASSERT NOT gmail_reply_ingestion_ready();
 BEGIN
  INSERT INTO email_contact_attempts(user_id,email_type,lifecycle_job,state)
  VALUES('11111111-1111-4111-8111-111111111111','conditions_alert','conditions_alert','handoff_started');
  RAISE EXCEPTION 'gap allowed handoff';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Reply ingestion is not healthy and fresh'; END;
 next_lease:=claim_gmail_reply_sync('mail@gmail.com');
 ASSERT next_lease->'missing_ids'='["missing"]'::jsonb;
 ASSERT next_lease->>'history_id'='205';
 -- An old lease may neither resolve the gap nor fail the current worker.
 PERFORM record_gmail_reply_failure(run,false,'gmail_history_expired');
 ASSERT (SELECT lease_id=(next_lease->>'lease_id')::uuid AND status='running' FROM email_reply_sync);
 BEGIN
  PERFORM note_gmail_reply_missing(run,'another'); RAISE EXCEPTION 'stale lease passed';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Invalid reply lease'; END;
 run:=(next_lease->>'lease_id')::uuid;
 PERFORM resolve_gmail_reply_missing(run,'missing');
 PERFORM resolve_gmail_reply_missing(run,'missing');
 PERFORM finish_gmail_reply_sync(run,'206',0);
 ASSERT gmail_reply_ingestion_ready();
 ASSERT (SELECT resolution='metadata_recovered' AND resolved_at IS NOT NULL FROM email_reply_missing_messages WHERE message_id='missing');
 lease:=claim_gmail_reply_sync('mail@gmail.com'); run:=(lease->>'lease_id')::uuid;
 ASSERT lease->'missing_ids'='[]'::jsonb;
 PERFORM record_gmail_reply_failure(run,true,'gmail_read_429');
 ASSERT (SELECT status='pending' AND history_id='206' FROM email_reply_sync);
 ASSERT NOT gmail_reply_ingestion_ready();
 lease:=claim_gmail_reply_sync('mail@gmail.com'); run:=(lease->>'lease_id')::uuid;
 PERFORM record_gmail_reply_failure(run,false,'gmail_history_expired');
 ASSERT (SELECT status='failed' AND history_id='206' FROM email_reply_sync);
 ASSERT (SELECT lifecycle_enabled FROM email_contact_controls);
 BEGIN
  PERFORM claim_gmail_reply_sync('mail@gmail.com'); RAISE EXCEPTION 'expired cursor auto recovered';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Mailbox needs reviewed bootstrap or recovery'; END;
 ASSERT NOT has_table_privilege('authenticated','email_reply_missing_messages','select');
 ASSERT NOT has_function_privilege('anon','note_gmail_reply_missing(uuid,text)','execute');
 ASSERT NOT has_function_privilege('authenticated','resolve_gmail_reply_missing(uuid,text)','execute');
 ASSERT NOT has_function_privilege('authenticated','record_gmail_reply_failure(uuid,boolean,text)','execute');
 ASSERT has_function_privilege('service_role','record_gmail_reply_failure(uuid,boolean,text)','execute');
END $$;
ROLLBACK;
