\set ON_ERROR_STOP on
INSERT INTO email_campaigns(id,version,content_hash,owner) VALUES ('startup-lifecycle-v1',1,repeat('a',64),'Steve');
INSERT INTO email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,entitlement_verified_until,entitlement_reference)
VALUES('11111111-1111-4111-8111-111111111111','startup-lifecycle-v1',now(),'fixture opt-in',now(),now()+interval '1 hour','fixture entitlement review');
DO $$ DECLARE d jsonb; a uuid;
BEGIN
  d:=evaluate_email_lifecycle('11111111-1111-4111-8111-111111111111'); ASSERT d->>'reason'='campaign_unapproved',d::text;
  UPDATE email_campaigns SET status='approved',approved_at=now(),approved_by='fixture',expires_at=now()+interval '30 days';
  d:=evaluate_email_lifecycle('11111111-1111-4111-8111-111111111111'); ASSERT d->>'status'='due',d::text; ASSERT d->>'job'='welcome';
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64)); ASSERT d->>'reason'='disabled';
  UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true;
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('b',64)); ASSERT (d->>'allowed')::boolean=false;
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64)); ASSERT (d->>'allowed')::boolean,d::text; a:=(d->>'attempt_id')::uuid;
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64)); ASSERT (d->>'allowed')::boolean=false;
  PERFORM record_email_reply('reply-one','webhook-one','surfer@example.com',now());
  ASSERT NOT begin_email_lifecycle(a,'{"to":"surfer@example.com","subject":"hello","html":"<p>hello</p>","text":"hello"}');
  ASSERT (SELECT state FROM email_contact_attempts WHERE id=a)='cancelled';
  UPDATE email_contact_state SET paused_at=NULL;
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64)); a:=(d->>'attempt_id')::uuid;
  UPDATE profiles SET notif_email_enabled=false;
  ASSERT NOT begin_email_lifecycle(a,'{}');
  UPDATE profiles SET notif_email_enabled=true;
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64)); a:=(d->>'attempt_id')::uuid;
  ASSERT begin_email_lifecycle(a,'{"to":"surfer@example.com","subject":"hello","html":"<p>hello</p>","text":"hello"}');
  ASSERT NOT begin_email_lifecycle(a,'{}');
  d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64)); ASSERT (d->>'allowed')::boolean=false;
  PERFORM finish_email_lifecycle(a,'provider-one'); PERFORM finish_email_lifecycle(a,'provider-one');
  ASSERT (SELECT count(*) FROM email_send_log WHERE resend_message_id='provider-one')=1;
  ASSERT (SELECT count(*) FROM email_contact_attempts WHERE provider_id='provider-one')=1;
END $$;
-- Disposable fixture only: reset attempts to test real concurrent connections next.
DELETE FROM email_contact_attempts;
DELETE FROM email_send_log;
