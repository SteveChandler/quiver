\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; d jsonb; a uuid; completed timestamptz;
BEGIN
 UPDATE auth.users SET created_at=now()-interval '4 days';
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now()-interval '1 day');
 d:=evaluate_email_lifecycle(u); ASSERT d->>'job'='activation',d::text; ASSERT d->>'status'='due',d::text;
 INSERT INTO sessions(user_id,status) VALUES(u,'planned');
 ASSERT (evaluate_email_lifecycle(u)->'source'->>'sessions')::integer=0;
 UPDATE sessions SET status='completed'; SELECT email_completed_at INTO completed FROM sessions LIMIT 1;
 UPDATE sessions SET email_completed_at=now()-interval '100 days';
 ASSERT (SELECT email_completed_at FROM sessions LIMIT 1)=completed;
 d:=evaluate_email_lifecycle(u); ASSERT d->>'job'='progress',d::text; ASSERT d->>'status'='deferred',d::text;
 UPDATE sessions SET deleted_at=now(); ASSERT (evaluate_email_lifecycle(u)->'source'->>'sessions')::integer=0;
 UPDATE profiles SET timezone='invalid'; ASSERT evaluate_email_lifecycle(u)->>'reason'='timezone_unknown';
 UPDATE profiles SET timezone=(SELECT name FROM pg_timezone_names WHERE extract(hour FROM now() AT TIME ZONE name) BETWEEN 10 AND 15 LIMIT 1);
 UPDATE email_contact_state SET lifecycle_consent_at=NULL; ASSERT evaluate_email_lifecycle(u)->>'reason'='consent_or_history_unknown';
 UPDATE email_contact_state SET lifecycle_consent_at=now(),entitlement_verified_until=now()-interval '1 second';
 ASSERT evaluate_email_lifecycle(u)->>'reason'='entitlement_review_stale';
 ASSERT claim_email_lifecycle(u,1,repeat('a',64))->>'reason'='entitlement_review_stale';
 UPDATE email_contact_state SET entitlement_verified_until=now()+interval '1 hour';
 INSERT INTO user_entitlements(user_id,is_pro,is_trialing,product_id,trial_ends_at) VALUES(u,true,true,'pro',now()+interval '12 days');
 ASSERT evaluate_email_lifecycle(u)->>'reason'='trial_unverified';
 INSERT INTO revenuecat_provider_events VALUES('trial-event',u,'SANDBOX',now(),'pro','TRIAL','INITIAL_PURCHASE',now()-interval '2 days',now()+interval '12 days',now()-interval '2 days');
 ASSERT evaluate_email_lifecycle(u)->>'reason'='trial_unverified';
 UPDATE revenuecat_provider_events SET environment='PRODUCTION';
 d:=evaluate_email_lifecycle(u); ASSERT d->>'job'='trial_support',d::text; ASSERT d->>'status'='due',d::text;
 a:=(claim_email_lifecycle(u,1,repeat('a',64))->>'attempt_id')::uuid;
 UPDATE user_entitlements SET is_trialing=false;
 ASSERT NOT begin_email_lifecycle(a,'{}');
 ASSERT evaluate_email_lifecycle(u)->>'reason'='entitled_no_growth';
END $$;
ROLLBACK;
BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; d jsonb;
BEGIN
 UPDATE auth.users SET created_at=now()-interval '8 days';
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now()-interval '5 days');
 d:=evaluate_email_lifecycle(u); ASSERT d->>'job'='friction',d::text;
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now());
 ASSERT evaluate_email_lifecycle(u)->>'job' IS DISTINCT FROM 'friction';
 UPDATE auth.users SET created_at=now()-interval '22 days';
 d:=evaluate_email_lifecycle(u); ASSERT d->>'job'='routine',d::text; ASSERT d->>'status'='due';
 INSERT INTO email_send_log(user_id,email_type,sent_at,resend_message_id) VALUES(u,'welcome',now()-interval '4 days','prior-1'),(u,'session_prompt',now()-interval '6 days','prior-2');
 d:=evaluate_email_lifecycle(u); ASSERT d->>'status'='deferred',d::text;
 ASSERT (d->>'next_eligible_at')::timestamptz>=now()+interval '1 day';
 PERFORM unsubscribe_email_lifecycle(u); ASSERT evaluate_email_lifecycle(u)->>'reason'='reply_paused';
END $$;
ROLLBACK;
BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; d jsonb; a uuid;
BEGIN
 INSERT INTO alert_rules VALUES(u,true,true);
 d:=claim_requested_email_alert(u,'queue-one','{"to":"surfer@example.com","subject":"Surf","html":"<p>Surf</p>","text":"Surf"}');
 ASSERT (d->>'allowed')::boolean,d::text; a:=(d->>'attempt_id')::uuid;
 ASSERT evaluate_email_lifecycle(u)->>'reason'='unresolved_handoff';
 PERFORM finish_email_lifecycle(a,'alert-one');
 ASSERT evaluate_email_lifecycle(u)->>'status'='expired';
 d:=claim_requested_email_alert(u,'queue-two','{"to":"surfer@example.com","html":"Surf"}'); ASSERT NOT (d->>'allowed')::boolean;
 PERFORM record_lifecycle_provider_event('complaint-one','alert-one','email.complained',now(),ARRAY['SURFER@example.com'],false);
 PERFORM record_lifecycle_provider_event('complaint-one','alert-one','email.complained',now(),ARRAY['SURFER@example.com'],false);
 ASSERT (SELECT count(*) FROM email_delivery_events)=1;
 ASSERT (SELECT count(*) FROM email_suppression_list WHERE email='surfer@example.com')=1;
 ASSERT evaluate_email_lifecycle(u)->>'reason'='suppressed';
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM evaluate_email_lifecycle('11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'Client role executed private function'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM email_lifecycle_due; RAISE EXCEPTION 'Client role read private view'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
BEGIN READ ONLY;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 ASSERT jsonb_array_length(email_lifecycle_cohort())=1;
 ASSERT evaluate_email_lifecycle('11111111-1111-4111-8111-111111111111')->>'job'='welcome';
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE service_role;
DO $$ DECLARE d jsonb; BEGIN
 d:=claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64));
 ASSERT (d->>'allowed')::boolean,d::text;
END $$;
ROLLBACK;

BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; BEGIN
 INSERT INTO user_entitlements(user_id,is_pro,is_trialing,product_id,trial_ends_at) VALUES(u,true,true,'pro',now()+interval '12 days');
 INSERT INTO revenuecat_provider_events VALUES('trial-target',u,'PRODUCTION',now(),'pro','TRIAL','INITIAL_PURCHASE',now()-interval '2 days',now()+interval '12 days',now()-interval '2 days');
 ASSERT evaluate_email_lifecycle(u)->>'job'='trial_support';
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'home_surf_call_tap',now());
 ASSERT evaluate_email_lifecycle(u)->>'reason'='trial_target_reached';
END $$;
ROLLBACK;

BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; a uuid; d jsonb;
BEGIN
 UPDATE email_contact_controls SET daily_cap=2;
 INSERT INTO email_send_log(user_id,email_type,resend_message_id,sent_at)
 VALUES(gen_random_uuid(),'welcome','legacy-cap-one',now());
 a:=(claim_email_lifecycle(u,1,repeat('a',64))->>'attempt_id')::uuid;
 ASSERT a IS NOT NULL;
 ASSERT begin_email_lifecycle(a,'{"to":"surfer@example.com","subject":"hello","html":"hello","text":"hello"}');
 PERFORM finish_email_lifecycle(a,'last-slot');
 DELETE FROM email_contact_attempts WHERE id=a;
 DELETE FROM email_send_log WHERE resend_message_id='last-slot';
 INSERT INTO email_send_log(user_id,email_type,resend_message_id,sent_at)
 VALUES(gen_random_uuid(),'welcome','legacy-cap-two',now());
 ASSERT evaluate_email_lifecycle(u)->>'status'<>'due';
 INSERT INTO alert_rules VALUES(u,true,true);
 d:=claim_requested_email_alert(u,'capped','{"to":"surfer@example.com","html":"hello"}');
 ASSERT d->>'reason'='contact_cap',d::text;
END $$;
ROLLBACK;
BEGIN;
DO $$ DECLARE a uuid; d jsonb;
BEGIN
 a:=(claim_email_lifecycle('11111111-1111-4111-8111-111111111111',1,repeat('a',64))->>'attempt_id')::uuid;
 UPDATE email_contact_attempts SET state='handoff_started',handoff_at=now()-interval '6 minutes' WHERE id=a;
 d:=reconcile_email_lifecycle();
 ASSERT (d->>'unknown_handoffs')::integer=1;
 ASSERT NOT (SELECT lifecycle_enabled FROM email_contact_controls WHERE singleton);
 ASSERT (SELECT state FROM email_contact_attempts WHERE id=a)='unknown';
END $$;
ROLLBACK;
