BEGIN;
-- A new approved program, fresh opt-in, no manually issued award.
DELETE FROM earned_pro_grants;
DELETE FROM pro_offer_awards;
ALTER TABLE pro_offer_programs DISABLE TRIGGER freeze_pro_offer_program;
UPDATE pro_offer_programs SET automatic_enrollment=true WHERE id='five_sessions_month';
ALTER TABLE pro_offer_programs ENABLE TRIGGER freeze_pro_offer_program;
DO $$
DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; a uuid; reply_lease jsonb; count_before integer;
BEGIN
 UPDATE email_contact_state SET paused_at=NULL,history_reviewed_at=now() WHERE user_id=u;
 UPDATE email_contact_controls SET automation_campaign='startup-lifecycle-v1',history_cutover_at=now(),history_cutover_reference='approved cutover';
 DELETE FROM user_email_prefs WHERE user_id=u;
 UPDATE user_entitlements SET is_pro=false,is_trialing=false WHERE user_id=u;
 PERFORM set_lifecycle_consent(u,true);
 PERFORM record_lifecycle_entitlement_check(u,false);
 ASSERT enroll_automatic_pro_offers()=1;
 ASSERT enroll_automatic_pro_offers()=0;
 SELECT id INTO a FROM pro_offer_awards WHERE user_id=u;
 ASSERT a IS NOT NULL;
 ASSERT (list_owned_pro_offers(u)->'offers'->0->>'earned')::boolean;
 ASSERT owned_pro_offer_key('22222222-2222-4222-8222-222222222222',a) IS NULL;
 ASSERT jsonb_array_length(pro_offer_fulfillment_queue())=0;
 PERFORM request_pro_offer_claim(u,owned_pro_offer_key(u,a));
 ASSERT jsonb_array_length(pro_offer_fulfillment_queue())=1;
 PERFORM set_lifecycle_consent(u,false);
 ASSERT (SELECT earned_at IS NOT NULL AND claim_requested_at IS NOT NULL FROM pro_offer_awards WHERE id=a);
 PERFORM defer_pro_offer_retry(a);
 ASSERT jsonb_array_length(pro_offer_fulfillment_queue())=0;
 ASSERT (SELECT retry_count=1 AND next_attempt_at>now() FROM pro_offer_awards WHERE id=a);
 -- Native outbox uses stable UUIDs and ignore-duplicates. Replay cannot manufacture a sixth session or a second award.
 SELECT count(*) INTO count_before FROM sessions WHERE user_id=u;
 INSERT INTO sessions(id,user_id,status) SELECT id,user_id,status FROM sessions WHERE user_id=u ON CONFLICT(id) DO NOTHING;
 ASSERT (SELECT count(*) FROM sessions WHERE user_id=u)=count_before;
 ASSERT (SELECT count(*) FROM pro_offer_awards WHERE user_id=u)=1;
 ASSERT (SELECT cardinality(session_ids)=5 FROM pro_offer_awards WHERE id=a);
 UPDATE email_reply_sync SET status='healthy',lease_id=NULL,lease_expires_at=NULL;
 reply_lease:=claim_gmail_reply_sync('mail@gmail.com');
 PERFORM retryable_gmail_reply_failure((reply_lease->>'lease_id')::uuid);
 ASSERT (SELECT status='pending' AND history_id=reply_lease->>'history_id' FROM email_reply_sync);
 reply_lease:=claim_gmail_reply_sync('mail@gmail.com');
 PERFORM finish_gmail_reply_sync((reply_lease->>'lease_id')::uuid,reply_lease->>'history_id',0);
 ASSERT NOT has_function_privilege('authenticated','public.request_pro_offer_claim(uuid,text)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.enroll_automatic_pro_offers()','EXECUTE');
END $$;
-- A configured inactivity offer takes priority over an unearned, unclaimed session offer.
ALTER TABLE pro_offer_programs DISABLE TRIGGER freeze_pro_offer_program;
UPDATE pro_offer_programs SET automatic_enrollment=true,inactivity_days=14 WHERE id='return_three_months';
ALTER TABLE pro_offer_programs ENABLE TRIGGER freeze_pro_offer_program;
DO $$
DECLARE u uuid:='44444444-4444-4444-8444-444444444444'; a uuid;
BEGIN
 INSERT INTO auth.users(id,email,created_at) VALUES(u,'stalled@example.com',now()-interval '20 days');
 INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone) VALUES(u,'stalled@example.com',true,true,'UTC');
 INSERT INTO email_contact_state(user_id,lifecycle_consent_at,consent_reference,history_reviewed_at,provider_access_active,entitlement_verified_until,entitlement_reference)
 VALUES(u,now(),'explicit fixture',now(),false,now()+interval '1 hour','fixture');
 a:=issue_pro_offer(u,'five_sessions_month',repeat('f',64),'fixture','v1');
 ASSERT enroll_automatic_pro_offers()=1;
 ASSERT (SELECT count(*) FROM pro_offer_awards WHERE user_id=u)=2;
 ASSERT jsonb_array_length(list_owned_pro_offers(u)->'offers')=1;
 ASSERT list_owned_pro_offers(u)->'offers'->0->>'program_id'='return_three_months';
 ASSERT (SELECT earned_at IS NULL AND claim_requested_at IS NULL FROM pro_offer_awards WHERE id=a);
END $$;
-- Preference changes must be affirmative; profile defaults and service writes are not consent.
DO $$
DECLARE u uuid:='44444444-4444-4444-8444-444444444444'; first_due timestamptz;
BEGIN
 UPDATE email_contact_state SET paused_at=now(),marketing_consent_at=now() WHERE user_id=u;
 UPDATE profiles SET notif_email_enabled=false WHERE id=u;
 ASSERT (SELECT lifecycle_consent_at IS NULL AND marketing_consent_at IS NULL FROM email_contact_state WHERE user_id=u);
 UPDATE profiles SET notif_email_enabled=true WHERE id=u;
 ASSERT (SELECT lifecycle_consent_at IS NULL FROM email_contact_state WHERE user_id=u);
 UPDATE profiles SET notif_email_enabled=false WHERE id=u;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u)::text,true);
 UPDATE profiles SET notif_email_enabled=true WHERE id=u;
 ASSERT (SELECT lifecycle_consent_at IS NOT NULL AND consent_reference='authenticated_email_preference:lifecycle-v1' AND paused_at IS NOT NULL FROM email_contact_state WHERE user_id=u);
 ASSERT (SELECT count(*) FROM pro_offer_awards WHERE user_id=u)=2;
 PERFORM set_config('request.jwt.claims','',true);
 INSERT INTO email_lifecycle_recipients(user_id,job,episode,status,reason) VALUES(u,'welcome','test','due','fixture');
 SELECT first_due_at INTO first_due FROM email_lifecycle_recipients WHERE user_id=u;
 UPDATE email_lifecycle_recipients SET evaluated_at=now()+interval '1 hour' WHERE user_id=u;
 ASSERT (SELECT first_due_at=first_due FROM email_lifecycle_recipients WHERE user_id=u);
 UPDATE email_lifecycle_recipients SET status='held' WHERE user_id=u;
 ASSERT (SELECT first_due_at IS NULL FROM email_lifecycle_recipients WHERE user_id=u);
END $$;
-- Two unresolved receipts must not starve the rest of the repair queue.
DO $$
DECLARE candidate jsonb; remaining uuid;
BEGIN
 INSERT INTO pro_offer_awards(user_id,program_id,code_hash,eligibility_reference,terms_version) VALUES('22222222-2222-4222-8222-222222222222','five_sessions_month',repeat('1',64),'queue fixture','v1');
 UPDATE pro_offer_awards SET state='unknown',handoff_at=now()-interval '3 minutes' WHERE user_id<>'44444444-4444-4444-8444-444444444444' OR program_id='return_three_months';
 SELECT id INTO remaining FROM pro_offer_awards WHERE state='unknown' AND id NOT IN (SELECT (value->>'award_id')::uuid FROM jsonb_array_elements(pro_offer_reconciliation_queue()));
 ASSERT remaining IS NOT NULL;
 FOR candidate IN SELECT value FROM jsonb_array_elements(pro_offer_reconciliation_queue()) LOOP
  PERFORM record_pro_offer_reconciliation((candidate->>'award_id')::uuid);
 END LOOP;
 ASSERT pro_offer_reconciliation_queue()->0->>'award_id'=remaining::text;
END $$;
ROLLBACK;
