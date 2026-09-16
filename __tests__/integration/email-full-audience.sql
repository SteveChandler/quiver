BEGIN;
-- Isolated fixtures only: do not run this file against a shared database.
UPDATE email_contact_state SET paused_at=now();
ALTER TABLE pro_offer_programs DISABLE TRIGGER freeze_pro_offer_program;
UPDATE pro_offer_programs SET enabled=false;
UPDATE pro_offer_programs SET enabled=true,automatic_enrollment=true,max_awards=NULL WHERE id='five_sessions_month';
ALTER TABLE pro_offer_programs ENABLE TRIGGER freeze_pro_offer_program;
UPDATE email_contact_controls SET automation_campaign='startup-lifecycle-v1',history_cutover_at=now(),history_cutover_reference='fixture reviewed history';
INSERT INTO auth.users(id,email,created_at)
 SELECT ('aaaa0000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'full-'||i||'@example.com',now()-interval '5 days' FROM generate_series(1,125) i;
INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone)
 SELECT id,email,true,true,'UTC' FROM auth.users WHERE email LIKE 'full-%';
INSERT INTO email_contact_state(user_id,account_permission_reviewed_at,account_permission_reference,history_reviewed_at,provider_access_active,entitlement_verified_until,entitlement_reference)
 SELECT id,now(),'account policy reviewed fixture',now(),false,now()+interval '1 hour','fixture provider proof' FROM auth.users WHERE email LIKE 'full-%';
UPDATE email_contact_state SET paused_at=now() WHERE user_id='aaaa0000-0000-4000-8000-000000000001';
UPDATE profiles SET notif_email_enabled=false WHERE id='aaaa0000-0000-4000-8000-000000000002';
DO $$
DECLARE u uuid; first_batch jsonb; second_batch jsonb; budget integer; v jsonb;
BEGIN
 ASSERT refresh_lifecycle_enrollment()=50,'first batch must be bounded';
 ASSERT refresh_lifecycle_enrollment()=50,'second batch must advance beyond 50 total';
 ASSERT refresh_lifecycle_enrollment()=23,'third batch reaches all eligible contacts';
 ASSERT refresh_lifecycle_enrollment()=0,'enrollment is idempotent';
 ASSERT (SELECT count(*) FROM email_contact_state WHERE user_id::text LIKE 'aaaa0000%' AND approved_campaign='startup-lifecycle-v1')=123;
 ASSERT (SELECT count(*) FROM email_contact_state WHERE user_id::text LIKE 'aaaa0000%' AND lifecycle_consent_at IS NOT NULL)=0,'account permission must not fabricate opt-in';
 first_batch:=email_lifecycle_cohort(); ASSERT jsonb_array_length(first_batch)=50;
 FOR u IN SELECT value::uuid FROM jsonb_array_elements_text(first_batch) LOOP
  PERFORM record_email_lifecycle_decision(u);
 END LOOP;
 second_batch:=email_lifecycle_cohort(); ASSERT jsonb_array_length(second_batch)=50;
 ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(first_batch) a JOIN jsonb_array_elements_text(second_batch) b ON a.value=b.value),'evaluation must rotate';
 ASSERT enroll_automatic_pro_offers()=50;
 ASSERT enroll_automatic_pro_offers()=50;
 ASSERT enroll_automatic_pro_offers()=23;
 ASSERT enroll_automatic_pro_offers()=0;
 ASSERT list_owned_pro_offers('aaaa0000-0000-4000-8000-000000000003')->'enrollment' IS NOT NULL,'unlimited budget supports self-service';
 -- Null budgets must not weaken finite budget enforcement or approval immutability.
 BEGIN
  UPDATE pro_offer_programs SET max_awards=999 WHERE id='five_sessions_month';
  RAISE EXCEPTION 'approved budget was mutable';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Approved offer terms and budget are frozen'; END;
 SELECT count(*) INTO budget FROM pro_offer_awards WHERE program_id='five_sessions_month';
 ALTER TABLE pro_offer_programs DISABLE TRIGGER freeze_pro_offer_program;
 UPDATE pro_offer_programs SET max_awards=budget WHERE id='five_sessions_month';
 ALTER TABLE pro_offer_programs ENABLE TRIGGER freeze_pro_offer_program;
 ASSERT list_owned_pro_offers('aaaa0000-0000-4000-8000-000000000003')->'enrollment'='null'::jsonb;
 BEGIN
  PERFORM issue_pro_offer('aaaa0000-0000-4000-8000-000000000001','five_sessions_month',repeat('9',64),'fixture','v1');
  RAISE EXCEPTION 'finite budget bypassed';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Offer budget exhausted'; END;
 -- Failed reads rotate without manufacturing successful entitlement evidence.
 UPDATE email_contact_state SET entitlement_verified_until=NULL WHERE user_id::text LIKE 'aaaa0000%';
 first_batch:=lifecycle_entitlement_queue(); ASSERT jsonb_array_length(first_batch)=24;
 FOR u IN SELECT value::uuid FROM jsonb_array_elements_text(first_batch) LOOP
  PERFORM record_lifecycle_entitlement_attempt(u);
 END LOOP;
 second_batch:=lifecycle_entitlement_queue();
 ASSERT jsonb_array_length(second_batch)=24;
 ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(first_batch) a JOIN jsonb_array_elements_text(second_batch) b ON a.value=b.value);
 ASSERT NOT EXISTS(SELECT 1 FROM email_contact_state WHERE user_id::text LIKE 'aaaa0000%' AND entitlement_verified_until IS NOT NULL);
 -- User withdrawal clears account-based permission; service preference re-enablement cannot restore it.
 u:='aaaa0000-0000-4000-8000-000000000003';
 UPDATE profiles SET notif_email_enabled=false WHERE id=u;
 UPDATE profiles SET notif_email_enabled=true WHERE id=u;
 ASSERT NOT (SELECT lifecycle_permission_verified(s) FROM email_contact_state s WHERE user_id=u);
 PERFORM set_lifecycle_consent(u,true);
 ASSERT (SELECT lifecycle_permission_verified(s) FROM email_contact_state s WHERE user_id=u);
 PERFORM unsubscribe_email_lifecycle(u);
 ASSERT (SELECT NOT lifecycle_permission_verified(s) AND paused_at IS NOT NULL FROM email_contact_state s WHERE user_id=u);
 ASSERT NOT has_function_privilege('authenticated','public.record_lifecycle_entitlement_attempt(uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.lifecycle_permission_verified(public.email_contact_state)','EXECUTE');
END $$;
-- A never-returning signup still gets the stalled-activation job; deleted accounts never do.
DO $$ DECLARE u uuid:='aaaa0000-0000-4000-8000-000000000004'; d jsonb; BEGIN
 UPDATE auth.users SET created_at=now()-interval '8 days' WHERE id=u;
 UPDATE email_contact_state SET entitlement_verified_until=now()+interval '1 hour' WHERE user_id=u;
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='friction','zero-activity accounts must reach day-seven friction';
 UPDATE profiles SET deleted_at=now() WHERE id=u;
 ASSERT evaluate_email_lifecycle(u)->>'reason'='ineligible_profile';
END $$;
-- Approval expiry is actionable even when no recipient is currently due.
DO $$ BEGIN
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true;
 ASSERT (email_automation_health()->>'approval_unavailable')::integer=0;
 UPDATE email_campaigns SET status='paused' WHERE id='startup-lifecycle-v1';
 ASSERT (email_automation_health()->>'approval_unavailable')::integer=1,'an unavailable campaign must not look healthy';
 UPDATE email_campaigns SET status='approved' WHERE id='startup-lifecycle-v1';
 ALTER TABLE pro_offer_programs DISABLE TRIGGER freeze_pro_offer_program;
 UPDATE pro_offer_programs SET approved_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id='five_sessions_month';
 ASSERT (email_automation_health()->>'approval_unavailable')::integer=1,'an expired enabled reward must alert';
 UPDATE pro_offer_programs SET expires_at=now()+interval '1 day' WHERE id='five_sessions_month';
 ALTER TABLE pro_offer_programs ENABLE TRIGGER freeze_pro_offer_program;
END $$;
-- Imported sent-folder history must participate in the same contact caps.
DO $$ DECLARE u uuid:='aaaa0000-0000-4000-8000-000000000006'; d jsonb; BEGIN
 UPDATE email_contact_state SET entitlement_verified_until=now()+interval '1 hour' WHERE user_id=u;
 INSERT INTO user_events(user_id,event_type,created_at) VALUES(u,'beach_view',now()-interval '1 day');
 INSERT INTO email_contact_attempts(user_id,email_type,claimed_at,sent_at,provider_id,state)
 SELECT u,'manual_outreach',now()-make_interval(days=>i),now()-make_interval(days=>i),'gmail:fixture-'||i||':'||u,'accepted'
 FROM generate_series(10,13) i;
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='activation' AND d->>'reason'='expired_no_safe_slot',d::text;
 ASSERT (d->>'next_eligible_at')::timestamptz>=now()+interval '17 days','manual history must count toward the 30-day cap';
 ASSERT NOT EXISTS(SELECT 1 FROM email_contact_attempts WHERE user_id=u AND state='reserved'),'history import must not reserve a send';
END $$;
-- New confirmed signups can enter automatically only after account-policy activation.
INSERT INTO auth.users(id,email,created_at) VALUES('bbbb0000-0000-4000-8000-000000000001','future-fixture@example.com',now());
INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone) VALUES('bbbb0000-0000-4000-8000-000000000001','future-fixture@example.com',true,true,'UTC');
DO $$ BEGIN
 PERFORM refresh_lifecycle_enrollment();
 ASSERT NOT EXISTS(SELECT 1 FROM email_contact_state WHERE user_id='bbbb0000-0000-4000-8000-000000000001');
 UPDATE email_contact_controls SET account_policy_reference='approved policy fixture';
 ASSERT refresh_lifecycle_enrollment()=1;
 ASSERT (SELECT lifecycle_consent_at IS NULL AND account_permission_reviewed_at IS NOT NULL AND approved_campaign IS NOT NULL FROM email_contact_state WHERE user_id='bbbb0000-0000-4000-8000-000000000001');
 BEGIN
  ALTER TABLE pro_offer_programs DISABLE TRIGGER freeze_pro_offer_program;
  UPDATE pro_offer_programs SET automatic_enrollment=true,inactivity_days=30 WHERE id='return_three_months';
  RAISE EXCEPTION 'three-month automation allowed';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
