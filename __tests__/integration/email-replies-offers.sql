DO $$
DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; lease jsonb; a uuid; r jsonb; m jsonb;
BEGIN
 -- Freshness is enforced in the database, including direct condition-alert handoff.
 BEGIN
  INSERT INTO email_contact_attempts(user_id,email_type,lifecycle_job,state) VALUES(u,'conditions_alert','conditions_alert','handoff_started');
  RAISE EXCEPTION 'missing mailbox allowed handoff';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Reply ingestion is not healthy and fresh'; END;
 INSERT INTO email_reply_sync(mailbox,history_id,review_reference) VALUES('mail@gmail.com','100','historical inbox reviewed');
 lease:=claim_gmail_reply_sync('mail@gmail.com');
 PERFORM record_gmail_reply((lease->>'lease_id')::uuid,'mail@gmail.com','m1','t1','surfer@example.com',now(),'<outbound>');
 PERFORM record_gmail_reply((lease->>'lease_id')::uuid,'mail@gmail.com','m1','t1','surfer@example.com',now(),'<outbound>');
 ASSERT (SELECT count(*) FROM email_reply_events WHERE provider_id='gmail:mail@gmail.com:m1')=1;
 ASSERT (SELECT paused_at IS NOT NULL FROM email_contact_state WHERE user_id=u);
 ASSERT NOT EXISTS(SELECT 1 FROM email_contact_attempts WHERE user_id=u AND state='reserved');
 PERFORM finish_gmail_reply_sync((lease->>'lease_id')::uuid,'105',1);
 ASSERT (SELECT history_id='105' AND status='healthy' FROM email_reply_sync);
 lease:=claim_gmail_reply_sync('mail@gmail.com');
 PERFORM fail_gmail_reply_sync((lease->>'lease_id')::uuid);
 ASSERT (SELECT history_id='105' AND status='failed' FROM email_reply_sync);
 ASSERT (SELECT NOT lifecycle_enabled FROM email_contact_controls);
 BEGIN
  PERFORM claim_gmail_reply_sync('mail@gmail.com'); RAISE EXCEPTION 'failed history advanced';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Mailbox needs reviewed bootstrap or recovery'; END;

 INSERT INTO user_email_prefs(user_id,email_frequency) VALUES(u,'off');
 -- Historical completed sessions count even without the new timestamp.
 UPDATE user_entitlements SET is_pro=false,is_trialing=false;
 DELETE FROM earned_pro_grants WHERE user_id=u;
 DELETE FROM sessions WHERE user_id=u;
 INSERT INTO sessions(user_id,status) SELECT u,'completed' FROM generate_series(1,4);
 ALTER TABLE sessions DISABLE TRIGGER email_session_completion;
 UPDATE sessions SET email_completed_at=NULL;
 ALTER TABLE sessions ENABLE TRIGGER email_session_completion;
 INSERT INTO sessions(user_id,status) VALUES(u,'planned');
 INSERT INTO sessions(user_id,status,deleted_at) VALUES(u,'completed',now());
 UPDATE pro_offer_programs SET enabled=true,approval_reference='fixture approved terms',approved_at=now(),expires_at=now()+interval '1 day';
 a:=issue_pro_offer(u,'five_sessions_month',repeat('b',64),'fixture manual review','v1');
 r:=reserve_pro_offer(u,repeat('b',64),'Quiver Pro'); ASSERT r->>'status'='not_earned'; ASSERT r->>'completed_sessions'='4';
 INSERT INTO sessions(user_id,status) VALUES(u,'completed');
 ASSERT (SELECT earned_at IS NOT NULL FROM pro_offer_awards WHERE id=a); -- event persists the reward before claim
 r:=reserve_pro_offer(u,repeat('b',64),'Quiver Pro'); ASSERT r->>'status'='reserved';
 ASSERT (SELECT cardinality(session_ids)=5 AND earned_at IS NOT NULL FROM pro_offer_awards WHERE id=a);
 ASSERT reserve_pro_offer(u,repeat('b',64),'Quiver Pro')->>'status'='busy';
 ASSERT reserve_pro_offer(gen_random_uuid(),repeat('b',64),'Quiver Pro')->>'status'='not_found';
 ASSERT begin_pro_offer(a,(r->>'reservation_id')::uuid);
 ASSERT NOT begin_pro_offer(a,(r->>'reservation_id')::uuid);
 PERFORM unknown_pro_offer(a,(r->>'reservation_id')::uuid);
 ASSERT reserve_pro_offer(u,repeat('b',64),'Quiver Pro')->>'status'='reconciliation_required';
 PERFORM verify_pro_offer(a,(r->>'reservation_id')::uuid,jsonb_build_object('store','promotional','user_id',u,'entitlement_id','Quiver Pro','product_id','rc_promo_pro','expires_at',r->>'expires_at'));
 PERFORM verify_pro_offer(a,(r->>'reservation_id')::uuid,jsonb_build_object('store','promotional','user_id',u,'entitlement_id','Quiver Pro','product_id','rc_promo_pro','expires_at',r->>'expires_at'));
 ASSERT (SELECT count(*) FROM earned_pro_grants WHERE offer_award_id=a)=1;
 ASSERT reserve_pro_offer(u,repeat('b',64),'Quiver Pro')->>'status'='verified';
 ASSERT (SELECT mirror_verified_at IS NULL FROM pro_offer_awards WHERE id=a);
 INSERT INTO user_entitlements(user_id,is_pro,expires_at,product_id) VALUES(u,true,(r->>'expires_at')::timestamptz,'rc_promo_pro');
 m:=reconcile_pro_offer_mirrors(); ASSERT m->>'matched'='1';
 a:=issue_pro_offer(u,'return_three_months',repeat('c',64),'manual return selection','v1');
 ASSERT reserve_pro_offer(u,repeat('c',64),'Quiver Pro')->>'status'='held_active_access';
 ASSERT (SELECT earned_at IS NOT NULL FROM pro_offer_awards WHERE id=a);
 BEGIN
  UPDATE pro_offer_programs SET approval_reference=NULL WHERE id='return_three_months';
  RAISE EXCEPTION 'null approval passed';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Approved offer terms and budget are frozen'; END;
 ASSERT preview_pro_offer(u,repeat('b',64))->>'months'='1';
 ASSERT preview_pro_offer(gen_random_uuid(),repeat('b',64))->>'status'='not_found';
 -- Service functions and code hashes are inaccessible to app clients.
 ASSERT NOT has_function_privilege('authenticated','public.reserve_pro_offer(uuid,text,text)','execute');
 ASSERT NOT has_table_privilege('authenticated','public.pro_offer_awards','select');
 ASSERT NOT has_function_privilege('anon','public.finish_gmail_reply_sync(uuid,text,integer)','execute');
END $$;

-- Prepare independent concurrent claims, including an already-earned historical award.
INSERT INTO auth.users(id,email) VALUES('22222222-2222-4222-8222-222222222222','second@example.com');
INSERT INTO profiles(id,email,analytics_is_real_user) VALUES('22222222-2222-4222-8222-222222222222','second@example.com',true);
INSERT INTO sessions(user_id,status) SELECT '22222222-2222-4222-8222-222222222222','completed' FROM generate_series(1,5);
SELECT issue_pro_offer('22222222-2222-4222-8222-222222222222','five_sessions_month',repeat('d',64),'reviewed','v1');
DO $$ BEGIN ASSERT (SELECT earned_at IS NOT NULL FROM pro_offer_awards WHERE user_id='22222222-2222-4222-8222-222222222222'); END $$;
