GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_contract_owner ON sessions TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE ON sessions TO authenticated;
GRANT EXECUTE ON FUNCTION stamp_email_session_completion() TO authenticated;
UPDATE profiles SET timezone='UTC';
INSERT INTO auth.users(id,email) VALUES('22222222-2222-4222-8222-222222222222','second@example.com');
INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone) VALUES('22222222-2222-4222-8222-222222222222','second@example.com',true,true,'UTC');
UPDATE pro_offer_programs SET enabled=true,automatic_enrollment=true,approval_reference='local-contract-only',approved_at=now(),expires_at=now()+interval '1 day' WHERE id='five_sessions_month';
INSERT INTO email_contact_state(user_id,lifecycle_consent_at,consent_reference,history_reviewed_at,entitlement_verified_until,entitlement_reference,provider_access_active)
SELECT id,now(),'local opt-in fixture',now(),now()+interval '1 hour','local provider fixture',false FROM profiles;
INSERT INTO user_entitlements(user_id,is_pro,is_trialing) SELECT id,false,false FROM profiles;
INSERT INTO email_reply_sync(mailbox,history_id,review_reference,status,last_synced_at) VALUES('mail@gmail.com','100','local inbox fixture','healthy',now());
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
