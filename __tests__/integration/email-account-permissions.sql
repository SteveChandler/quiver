BEGIN;
DO $$ BEGIN
 ASSERT NOT has_table_privilege('service_role','auth.users','SELECT');
 ASSERT NOT has_table_privilege('service_role','auth.users','INSERT,UPDATE,DELETE');
 ASSERT NOT has_column_privilege('service_role','auth.users','encrypted_password','SELECT');
 ASSERT NOT has_any_column_privilege('anon','auth.users','SELECT');
 ASSERT NOT has_any_column_privilege('authenticated','auth.users','SELECT');
END $$;
INSERT INTO auth.users(id,email) VALUES('cccc0000-0000-4000-8000-000000000001','permission-fixture@example.com');
INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone)
 VALUES('cccc0000-0000-4000-8000-000000000001','permission-fixture@example.com',true,true,'UTC');
INSERT INTO email_contact_state(user_id,approved_campaign,lifecycle_consent_at,consent_reference,history_reviewed_at)
 VALUES('cccc0000-0000-4000-8000-000000000001','startup-lifecycle-v1',now(),'fixture',now());
SET LOCAL ROLE service_role;
DO $$ DECLARE d jsonb; BEGIN
 ASSERT (SELECT email='permission-fixture@example.com' AND created_at IS NOT NULL AND email_confirmed_at IS NOT NULL
   FROM auth.users WHERE id='cccc0000-0000-4000-8000-000000000001');
 d:=evaluate_email_lifecycle('cccc0000-0000-4000-8000-000000000001');
 ASSERT d->>'reason'='entitlement_review_stale',d::text;
 PERFORM refresh_lifecycle_enrollment();
 BEGIN
  PERFORM encrypted_password FROM auth.users;
  RAISE EXCEPTION 'Private auth field readable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE auth.users SET email='changed@example.com' WHERE id='cccc0000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Auth identity writable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
