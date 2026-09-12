\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE
 u uuid:='66666666-6666-4666-8666-666666666666'; d jsonb; a uuid;
BEGIN
 INSERT INTO auth.users(id,email,created_at) VALUES(u,'audience@example.com',now()-interval '4 days');
 INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone)
 VALUES(u,'audience@example.com',true,true,(SELECT name FROM pg_timezone_names WHERE extract(hour FROM now() AT TIME ZONE name) BETWEEN 10 AND 15 LIMIT 1));
 INSERT INTO email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at,entitlement_verified_until,entitlement_reference,provider_access_active)
 VALUES(u,'startup-lifecycle-v1',now(),'fixture',now(),now()+interval '1 hour','fixture',false);
 INSERT INTO user_entitlements(user_id,is_pro,is_trialing) VALUES(u,false,false);
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now()-interval '1 day');
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true;
 UPDATE email_reply_sync SET status='healthy',last_synced_at=now(),lease_id=NULL,lease_expires_at=NULL;
 PERFORM issue_pro_offer(u,'five_sessions_month',repeat('9',64),'audience fixture','v1');
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='activation' AND d->>'status'='due',d::text;
 ASSERT d->'source'->>'audience'='free' AND d->'source'->>'offer_id' IS NOT NULL,d::text;
 a:=(claim_email_lifecycle(u,1,repeat('a',64))->>'attempt_id')::uuid;
 ASSERT a IS NOT NULL;
 -- Same job/episode, different audience: the reserved promo must be cancelled.
 UPDATE user_entitlements SET is_pro=true WHERE user_id=u;
 ASSERT NOT begin_email_lifecycle(a,'{"to":"audience@example.com","subject":"promo","html":"promo","text":"promo"}');
 ASSERT (SELECT state FROM email_contact_attempts WHERE id=a)='cancelled';
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='activation' AND d->>'status'='due',d::text;
 ASSERT d->'source'->>'audience'='entitled' AND d->'source'->>'offer_id' IS NULL,d::text;
 -- Provider access protects users even when the mirror is behind.
 UPDATE user_entitlements SET is_pro=false WHERE user_id=u;
 UPDATE email_contact_state SET provider_access_active=true WHERE user_id=u;
 ASSERT evaluate_email_lifecycle(u)->'source'->>'audience'='entitled';
 UPDATE email_contact_state SET provider_access_active=false WHERE user_id=u;
 INSERT INTO earned_pro_grants(user_id,entitlement_id,expires_at,reason) VALUES(u,'Quiver Pro',now()+interval '1 month','audience fixture');
 ASSERT evaluate_email_lifecycle(u)->'source'->>'audience'='entitled';
 UPDATE earned_pro_grants SET revoked_at=now() WHERE user_id=u;
 -- Unknown or stale entitlement evidence is never a free audience.
 UPDATE email_contact_state SET provider_access_active=NULL WHERE user_id=u;
 ASSERT evaluate_email_lifecycle(u)->>'reason'='entitlement_unknown';
 UPDATE email_contact_state SET provider_access_active=false,entitlement_verified_until=now()-interval '1 second' WHERE user_id=u;
 ASSERT evaluate_email_lifecycle(u)->>'reason'='entitlement_review_stale';
 UPDATE email_contact_state SET entitlement_verified_until=now()+interval '1 hour' WHERE user_id=u;
 -- Both offers stay out of paid mail, including an already earned three-month award.
 PERFORM issue_pro_offer(u,'return_three_months',repeat('8',64),'manual fixture','v1');
 ASSERT evaluate_email_lifecycle(u)->>'job'='offer_ready';
 UPDATE user_entitlements SET is_pro=true WHERE user_id=u;
 ASSERT evaluate_email_lifecycle(u)->>'job'='activation';
 ASSERT evaluate_email_lifecycle(u)->'source'->>'offer_id' IS NULL;
 -- Paid users keep welcome and progress support in the same mutually exclusive path.
 UPDATE auth.users SET created_at=now()-interval '12 hours' WHERE id=u;
 ASSERT evaluate_email_lifecycle(u)->>'job'='welcome';
 UPDATE auth.users SET created_at=now()-interval '4 days' WHERE id=u;
 INSERT INTO sessions(user_id,status) VALUES(u,'completed');
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='progress' AND d->'source'->>'audience'='entitled',d::text;
 ASSERT d->'source'->>'offer_id' IS NULL;
 -- Verified trials receive support, never a saved promo.
 UPDATE user_entitlements SET is_trialing=true,product_id='pro',trial_ends_at=now()+interval '12 days' WHERE user_id=u;
 UPDATE email_contact_state SET provider_access_active=true,provider_trial=jsonb_build_object('product_id','pro','expires_at',now()+interval '12 days') WHERE user_id=u;
 INSERT INTO revenuecat_provider_events VALUES('audience-trial',u,'PRODUCTION',now(),'pro','TRIAL','INITIAL_PURCHASE',now()-interval '2 days',now()+interval '12 days',now()-interval '2 days');
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='trial_support' AND d->'source'->>'audience'='trial',d::text;
 ASSERT d->'source'->>'offer_id' IS NULL;
 UPDATE user_entitlements SET is_trialing=false WHERE user_id=u;
 UPDATE auth.users SET created_at=now()-interval '22 days' WHERE id=u;
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now()-interval '3 days');
 d:=evaluate_email_lifecycle(u);
 ASSERT d->>'job'='routine' AND d->'source'->>'audience'='entitled',d::text;
 UPDATE email_contact_state SET paused_at=now() WHERE user_id=u;
 ASSERT evaluate_email_lifecycle(u)->>'reason'='reply_paused';
 UPDATE email_contact_state SET paused_at=NULL WHERE user_id=u;
 INSERT INTO email_suppression_list(email) VALUES('audience@example.com');
 ASSERT evaluate_email_lifecycle(u)->>'reason'='suppressed';
END $$;
ROLLBACK;
