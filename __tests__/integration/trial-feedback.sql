BEGIN;
-- Disposable cluster only. Four store cohorts exercise the same private contract.
UPDATE email_contact_controls SET daily_cap=10;
INSERT INTO auth.users(id,email) SELECT ('dddd0000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'feedback-'||i||'@example.com' FROM generate_series(1,4) i;
INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone)
 SELECT id,email,true,true,(SELECT name FROM pg_timezone_names WHERE extract(hour FROM now() AT TIME ZONE name) BETWEEN 10 AND 15 LIMIT 1) FROM auth.users WHERE email LIKE 'feedback-%';
INSERT INTO user_entitlements(user_id,is_pro,is_trialing,will_renew,product_id,trial_ends_at)
 SELECT id,true,true,false,'pro',now()+interval '10 days' FROM auth.users WHERE email LIKE 'feedback-%';
INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,store,processed_at,product_id,period_type,event_type,purchased_at,expiration_at,event_timestamp)
 SELECT 'feedback-trial-'||i,('dddd0000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'PRODUCTION',store,now(),'pro','TRIAL','INITIAL_PURCHASE',now()-interval '4 days',now()+interval '10 days',now()-interval '4 days'
 FROM unnest(ARRAY['APP_STORE','PLAY_STORE','STRIPE','RC_BILLING']) WITH ORDINALITY stores(store,i);
INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,store,processed_at,product_id,period_type,event_type,purchased_at,expiration_at,event_timestamp,cancellation_reason)
 SELECT provider_event_id||'-cancel',app_user_id,environment,store,now(),product_id,period_type,'CANCELLATION',purchased_at,expiration_at,now()-interval '2 days','UNSUBSCRIBE' FROM revenuecat_provider_events WHERE provider_event_id LIKE 'feedback-trial-%';
INSERT INTO email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,provider_access_active,entitlement_verified_until,entitlement_reference,provider_trial)
 SELECT app_user_id,'startup-lifecycle-v1',now(),'fixture',now(),true,now()+interval '1 hour','provider fixture',jsonb_build_object('product_id','pro','expires_at',expiration_at,'will_renew',false,'billing_issue',false,'store',lower(store))
 FROM revenuecat_provider_events WHERE provider_event_id LIKE 'feedback-trial-%' AND event_type='INITIAL_PURCHASE';
UPDATE revenuecat_provider_events SET environment_verified=true WHERE provider_event_id LIKE 'feedback-trial-%';
SET LOCAL ROLE service_role;
DO $$ DECLARE u uuid; c jsonb; id uuid; BEGIN
 ASSERT NOT has_function_privilege('authenticated','public.submit_trial_feedback(uuid,uuid,text,text,uuid)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.trial_feedback_submissions','SELECT');
 ASSERT trial_feedback_context('dddd0000-0000-4000-8000-000000000001')->>'status'='disabled';
 UPDATE trial_feedback_controls SET enabled=true,redemption_enabled=true;
 BEGIN
 INSERT INTO trial_feedback_offer_policy(store,product_id,offer_identifier,terms_version,enabled,approved_at,expires_at)
 VALUES('APP_STORE','invalid','extra','v1',true,now(),now()+interval '1 day');
 RAISE EXCEPTION 'missing evidence allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO trial_feedback_offer_policy(store,product_id,offer_identifier,terms_version,enabled,approved_at,expires_at,stacking_evidence)
 SELECT store,'pro','extra-month','v1',true,now(),now()+interval '1 day','sandbox fixture proof only' FROM unnest(ARRAY['APP_STORE','PLAY_STORE','STRIPE','RC_BILLING']) store;
 FOR u IN SELECT app_user_id FROM revenuecat_provider_events WHERE provider_event_id LIKE 'feedback-trial-%' AND event_type='INITIAL_PURCHASE' LOOP
   ASSERT current_feedback_trial(u) IS NOT NULL,u::text;
   ASSERT evaluate_email_lifecycle(u)->>'job'='trial_feedback',evaluate_email_lifecycle(u)::text;
   ASSERT evaluate_email_lifecycle(u)->>'status'='due',evaluate_email_lifecycle(u)::text;
   UPDATE user_entitlements SET is_trialing=false WHERE user_id=u;
   ASSERT current_feedback_trial(u) IS NULL,'paid access must exit';
   UPDATE user_entitlements SET is_trialing=true WHERE user_id=u;
   UPDATE user_entitlements SET will_renew=true WHERE user_id=u;
   ASSERT current_feedback_trial(u) IS NULL,'uncancellation must exit';
   UPDATE user_entitlements SET will_renew=false WHERE user_id=u;
   UPDATE revenuecat_provider_events SET cancellation_reason='BILLING_ERROR' WHERE app_user_id=u AND event_type='CANCELLATION';
   ASSERT current_feedback_trial(u) IS NULL,'involuntary cancellation must exit';
   UPDATE revenuecat_provider_events SET cancellation_reason='UNSUBSCRIBE' WHERE app_user_id=u AND event_type='CANCELLATION';
   UPDATE email_contact_state SET provider_trial=provider_trial||'{"will_renew":true}' WHERE user_id=u;
   ASSERT current_feedback_trial(u) IS NULL,'fresh snapshot must agree';
   UPDATE email_contact_state SET provider_trial=provider_trial||'{"will_renew":false}' WHERE user_id=u;
   BEGIN PERFORM submit_trial_feedback(u,gen_random_uuid(),'other','',NULL); RAISE EXCEPTION 'blank other accepted'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='invalid_feedback'; END;
   UPDATE email_contact_state SET entitlement_verified_until=now()-interval '1 second' WHERE user_id=u;
   ASSERT current_feedback_trial(u) IS NULL,'stale provider evidence must exit';
   UPDATE email_contact_state SET entitlement_verified_until=now()+interval '1 hour' WHERE user_id=u;
   c:=submit_trial_feedback(u,gen_random_uuid(),'time','Private fixture',NULL); id:=(c->>'submission_id')::uuid;
   ASSERT c->'offer'->>'store'=current_feedback_trial(u)->>'store';
   ASSERT (submit_trial_feedback(u,gen_random_uuid(),'price','changed',NULL)->>'submission_id')::uuid=id;
   ASSERT (SELECT note='Private fixture' FROM trial_feedback_submissions WHERE user_id=u);
   ASSERT evaluate_email_lifecycle(u)->>'reason'='reply_paused','feedback ends email followups';
   c:=reserve_trial_feedback_offer(u,gen_random_uuid(),'v1');
   ASSERT c->>'redemption_state'='reserved';
   ASSERT reserve_trial_feedback_offer(u,(c->>'reservation_id')::uuid,'v1')->>'reservation_id'=c->>'reservation_id';
   BEGIN PERFORM reserve_trial_feedback_offer(u,gen_random_uuid(),'v1'); RAISE EXCEPTION 'duplicate reservation'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='feedback_offer_pending'; END;
   ASSERT reconcile_trial_feedback(u)->>'status'='submitted','client reservation is not a receipt';
   ASSERT begin_trial_feedback_handoff(u,(c->>'reservation_id')::uuid);
   ASSERT NOT begin_trial_feedback_handoff(u,(c->>'reservation_id')::uuid),'a lost store response must never repeat a handoff';
   INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,store,processed_at,product_id,period_type,event_type,purchased_at,expiration_at,event_timestamp,offer_code,price)
   SELECT 'redemption-'||u,u,'SANDBOX',store,now(),'pro','TRIAL','RENEWAL',trial_ends_at,expected_expires_at,now(),offer_identifier,0 FROM trial_feedback_submissions WHERE user_id=u;
   ASSERT reconcile_trial_feedback(u)->>'status'='submitted','sandbox must not grant';
   UPDATE revenuecat_provider_events SET environment='PRODUCTION',environment_verified=true,price=1 WHERE provider_event_id='redemption-'||u;
   ASSERT reconcile_trial_feedback(u)->>'status'='submitted','paid transaction must not prove free month';
   UPDATE revenuecat_provider_events SET price=0 WHERE provider_event_id='redemption-'||u;
   ASSERT reconcile_trial_feedback(u)->>'status'='verified','exact zero-price provider receipt must confirm';
 END LOOP;
 ASSERT (SELECT count(*) FROM trial_feedback_submissions)=4;
 ASSERT jsonb_array_length(email_automation_dashboard()->'trial_feedback')=4;
 ASSERT NOT (email_automation_dashboard()->'trial_feedback'->0 ? 'note'),'private feedback must stay out of the status dashboard';
END $$;
RESET ROLE;
SAVEPOINT renewal_attribution_fixture;
UPDATE trial_feedback_submissions SET expected_expires_at=now()-interval '10 minutes' WHERE user_id='dddd0000-0000-4000-8000-000000000002';
INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,store,processed_at,product_id,period_type,event_type,purchased_at,expiration_at,event_timestamp,price)
 SELECT 'early-delivered-renewal',user_id,'PRODUCTION',true,store,now(),product_id,'NORMAL','RENEWAL',expected_expires_at,expected_expires_at+interval '1 month',expected_expires_at-interval '1 minute',4.99
 FROM trial_feedback_submissions WHERE user_id='dddd0000-0000-4000-8000-000000000002';
DO $$ BEGIN
 ASSERT (SELECT first_paid_renewal_at=expected_expires_at FROM trial_feedback_outcomes WHERE user_id='dddd0000-0000-4000-8000-000000000002'),'early webhook delivery must not hide the effective paid renewal';
 UPDATE revenuecat_provider_events SET purchased_at=now()+interval '1 minute' WHERE provider_event_id='early-delivered-renewal';
 ASSERT (SELECT first_paid_renewal_at IS NULL FROM trial_feedback_outcomes WHERE user_id='dddd0000-0000-4000-8000-000000000002'),'a future billing period is not yet an observed paid outcome';
END $$;
ROLLBACK TO renewal_attribution_fixture;
SAVEPOINT queue_fixture;
INSERT INTO auth.users(id,email) SELECT ('eeee0000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'queue-'||i||'@example.com' FROM generate_series(1,55) i;
INSERT INTO trial_feedback_submissions(user_id,trial_event_id,cancellation_event_id,store,product_id,trial_ends_at,request_id,reason,state,reservation_id,reserved_at,offer_identifier,terms_version,expected_expires_at)
 SELECT u.id,f.trial_event_id,f.cancellation_event_id,f.store,f.product_id,f.trial_ends_at,gen_random_uuid(),'time','reserved',gen_random_uuid(),now()-interval '1 hour',f.offer_identifier,f.terms_version,f.expected_expires_at
 FROM auth.users u CROSS JOIN trial_feedback_submissions f WHERE u.email LIKE 'queue-%' AND f.user_id='dddd0000-0000-4000-8000-000000000002';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 ASSERT reconcile_trial_feedback_queue()=50;
 ASSERT reconcile_trial_feedback_queue()=5,'the next batch must advance instead of starving later reservations';
 ASSERT (SELECT count(*) FROM trial_feedback_submissions WHERE user_id::text LIKE 'eeee%' AND last_reconciled_at IS NOT NULL)=55;
 ASSERT reconcile_trial_feedback_queue()=0,'reconciliation cooldown must hold';
END $$;
RESET ROLE;
ROLLBACK TO queue_fixture;
-- Leave one eligible account for the shell runner's independent concurrent connections.
DELETE FROM trial_feedback_submissions WHERE user_id='dddd0000-0000-4000-8000-000000000001';
DELETE FROM revenuecat_provider_events WHERE provider_event_id='redemption-dddd0000-0000-4000-8000-000000000001';
COMMIT;
