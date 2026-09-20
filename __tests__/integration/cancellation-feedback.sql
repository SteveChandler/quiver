BEGIN;
-- New disposable accounts isolate gifts from the existing lifecycle fixture cohorts.
INSERT INTO auth.users(id,email) SELECT ('eeee0000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'cancellation-'||i||'@example.com' FROM generate_series(1,5) i;
INSERT INTO profiles(id,email,analytics_is_real_user) SELECT id,email,true FROM auth.users WHERE email LIKE 'cancellation-%';
INSERT INTO user_entitlements(user_id,is_pro,is_trialing,will_renew,expires_at,product_id,rc_raw)
 SELECT id,true,false,true,now()+interval '1 day','monthly','{"store":"APP_STORE"}' FROM auth.users WHERE email LIKE 'cancellation-%';
INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,period_type,event_type,event_timestamp,expiration_at)
 SELECT 'cancel-fixture-'||id,id,'PRODUCTION',true,now(),'APP_STORE','monthly','NORMAL','RENEWAL',now()-interval '1 day',now()+interval '1 day' FROM auth.users WHERE email LIKE 'cancellation-%';
DO $$ DECLARE u uuid:='eeee0000-0000-4000-8000-000000000001'; v uuid:='eeee0000-0000-4000-8000-000000000002'; award uuid; subscription_store text; submission uuid; request_id uuid:=gen_random_uuid(); result jsonb; proof jsonb; BEGIN
 ASSERT NOT has_table_privilege('authenticated','cancellation_feedback_submissions','SELECT');
 ASSERT NOT has_function_privilege('authenticated','submit_cancellation_feedback(uuid,uuid,text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','accept_cancellation_gift(uuid,uuid,text,text)','EXECUTE');
 ASSERT cancellation_feedback_context(u)->'offer'='null'::jsonb,'migration must not activate gifts';
 submission:=submit_cancellation_feedback(u,request_id,'feature','');
 ASSERT submit_cancellation_feedback(u,request_id,'technical','Do not overwrite')=submission,'retry must retain original submission';
 ASSERT (SELECT note='' AND reason='feature' FROM cancellation_feedback_submissions WHERE id=submission);
 ASSERT submit_cancellation_feedback(u,gen_random_uuid(),'technical','New flow detail')<>submission,'a new explicit flow saves new feedback';
 PERFORM submit_cancellation_feedback(v,gen_random_uuid(),'technical','Missing saved forecast');
 ASSERT (SELECT note='Missing saved forecast' FROM cancellation_feedback_submissions WHERE user_id=v);
 ASSERT NOT (cancellation_feedback_context(v) ? 'note'),'private note must not escape context';
 BEGIN PERFORM submit_cancellation_feedback(v,gen_random_uuid(),'technical',repeat('x',2001)); RAISE EXCEPTION 'oversized note'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='invalid_feedback'; END;
 UPDATE pro_offer_programs SET enabled=true,approved_at=now(),expires_at=now()+interval '7 days',approval_reference='disposable test only',max_awards=2 WHERE id IN ('manual_month','cancellation_month');
 ASSERT cancellation_feedback_context(u)->'offer'->>'months'='1';
 ASSERT cancellation_feedback_context(u)->>'management_store'='APP_STORE';
 FOR subscription_store IN SELECT unnest(ARRAY['APP_STORE','PLAY_STORE','STRIPE','RC_BILLING','PROMOTIONAL']) LOOP
   UPDATE revenuecat_provider_events SET store=subscription_store WHERE app_user_id='eeee0000-0000-4000-8000-000000000004';
   result:=cancellation_feedback_context('eeee0000-0000-4000-8000-000000000004');
   ASSERT result->>'management_store' IS NOT DISTINCT FROM CASE WHEN subscription_store='PROMOTIONAL' THEN NULL ELSE subscription_store END;
   ASSERT (result->'offer'<>'null'::jsonb)=(subscription_store IN ('APP_STORE','PLAY_STORE')),'web billing cannot receive native cancellation gift';
   IF subscription_store IN ('STRIPE','RC_BILLING','PROMOTIONAL') THEN
     BEGIN PERFORM accept_cancellation_gift('eeee0000-0000-4000-8000-000000000004',gen_random_uuid(),'v1',repeat('6',64)); RAISE EXCEPTION 'unsupported store accepted'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='gift_unavailable'; END;
   END IF;
 END LOOP;
 UPDATE revenuecat_provider_events SET store='APP_STORE' WHERE app_user_id='eeee0000-0000-4000-8000-000000000004';

 BEGIN PERFORM accept_cancellation_gift(u,gen_random_uuid(),'wrong',repeat('8',64)); RAISE EXCEPTION 'wrong terms'; EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='gift_unavailable'; END;
 award:=accept_cancellation_gift(u,gen_random_uuid(),'v1',repeat('8',64));
 ASSERT accept_cancellation_gift(u,gen_random_uuid(),'v1',repeat('9',64))=award,'repeat acceptance must not grant again';
 ASSERT (SELECT earned_at IS NOT NULL FROM pro_offer_awards WHERE id=award),'retention must not require five sessions';
 ASSERT reserve_pro_offer(u,repeat('8',64),'Quiver Pro')->>'status'='held_active_access','gift must preserve active paid period';
 ASSERT (SELECT will_renew FROM user_entitlements WHERE user_id=u),'acceptance must not cancel renewal';
 award:=issue_pro_offer(v,'manual_month',repeat('7',64),'staff fixture','v1');
 ASSERT (SELECT earned_at IS NOT NULL FROM pro_offer_awards WHERE id=award),'manual gift is unconditional';
 ASSERT jsonb_path_exists(list_owned_pro_offers(v),'$.offers[*] ? (@.program_id == "manual_month")');
 -- An old cancellation delivered after a later uncancellation must not solicit feedback again.
 INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,event_type,event_timestamp,expiration_at,cancellation_reason)
 VALUES('cancel-fixture-cancel',v,'PRODUCTION',true,now(),'APP_STORE','monthly','CANCELLATION',now()-interval '2 hours',now()+interval '1 day','UNSUBSCRIBE');
 ASSERT (cancellation_feedback_context(v)->>'cancellation_confirmed')::boolean;
 INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,event_type,event_timestamp,expiration_at)
 VALUES('cancel-fixture-expired',v,'PRODUCTION',true,now(),'APP_STORE','monthly','EXPIRATION',now()-interval '90 minutes',now()-interval '90 minutes');
 ASSERT (cancellation_feedback_context(v)->>'cancellation_confirmed')::boolean,'expiration must retain the canceled episode';
 ASSERT cancellation_feedback_context(v)->'offer'='null'::jsonb,'expired account cannot newly earn retention offer';
 INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,event_type,event_timestamp,expiration_at)
 VALUES('cancel-fixture-uncancel',v,'PRODUCTION',true,now(),'APP_STORE','monthly','UNCANCELLATION',now()-interval '1 hour',now()+interval '1 day');
 UPDATE revenuecat_provider_events SET processed_at=now() WHERE provider_event_id='cancel-fixture-cancel';
 ASSERT NOT (cancellation_feedback_context(v)->>'cancellation_confirmed')::boolean;
 -- After expiry the verified promotional grant clears stale renewal/store metadata.
 UPDATE user_entitlements SET expires_at=now()-interval '1 second' WHERE user_id=v;
 result:=reserve_pro_offer(v,repeat('7',64),'Quiver Pro');
 ASSERT result->>'status'='reserved';
 ASSERT begin_pro_offer(award,(result->>'reservation_id')::uuid);
 proof:=jsonb_build_object('user_id',v,'store','promotional','product_id','rc_promo_month','entitlement_id','Quiver Pro','expires_at',result->>'expires_at','observed_at',now());
 PERFORM verify_pro_offer(award,(result->>'reservation_id')::uuid,proof);
 PERFORM apply_verified_pro_offer_mirror(award,proof);
 ASSERT (SELECT is_pro AND NOT is_trialing AND NOT will_renew AND rc_raw->>'store'='PROMOTIONAL' FROM user_entitlements WHERE user_id=v);
 ASSERT (SELECT expires_at>now()+interval '27 days' AND expires_at<now()+interval '32 days' FROM user_entitlements WHERE user_id=v);
 ASSERT NOT (cancellation_feedback_context('eeee0000-0000-4000-8000-000000000003')->>'feedback_submitted')::boolean;
 ASSERT cancellation_feedback_context('eeee0000-0000-4000-8000-000000000003')->'offer'->>'months'='1','survey is optional';
 -- Save feedback in Quiver, then cancel in the store: returning must not ask again.
 PERFORM submit_cancellation_feedback('eeee0000-0000-4000-8000-000000000005',gen_random_uuid(),'price','Same episode');
 UPDATE cancellation_feedback_submissions SET submitted_at=now()-interval '3 hours' WHERE user_id='eeee0000-0000-4000-8000-000000000005';
 INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,event_type,event_timestamp,expiration_at,cancellation_reason)
 VALUES('episode-cancel-1','eeee0000-0000-4000-8000-000000000005','PRODUCTION',true,now(),'APP_STORE','monthly','CANCELLATION',now()-interval '2 hours',now()+interval '1 day','UNSUBSCRIBE');
 ASSERT (cancellation_feedback_context('eeee0000-0000-4000-8000-000000000005')->>'feedback_submitted')::boolean,'pre-cancel feedback belongs to its active subscription episode';
 -- A later subscription episode must not inherit the previous episode's feedback.
 INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,event_type,event_timestamp,expiration_at)
 VALUES('episode-renewal-2','eeee0000-0000-4000-8000-000000000005','PRODUCTION',true,now(),'APP_STORE','monthly','RENEWAL',now()-interval '1 hour',now()+interval '1 day');
 INSERT INTO revenuecat_provider_events(provider_event_id,app_user_id,environment,environment_verified,processed_at,store,product_id,event_type,event_timestamp,expiration_at,cancellation_reason)
 VALUES('episode-cancel-2','eeee0000-0000-4000-8000-000000000005','PRODUCTION',true,now(),'APP_STORE','monthly','CANCELLATION',now()-interval '30 minutes',now()+interval '1 day','UNSUBSCRIBE');
 ASSERT NOT (cancellation_feedback_context('eeee0000-0000-4000-8000-000000000005')->>'feedback_submitted')::boolean,'new subscription episode can collect fresh feedback';
 PERFORM submit_cancellation_feedback('eeee0000-0000-4000-8000-000000000005',gen_random_uuid(),'feature','New episode feedback');
 ASSERT (cancellation_feedback_context('eeee0000-0000-4000-8000-000000000005')->>'feedback_submitted')::boolean;

END $$;
COMMIT;
