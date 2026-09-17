\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; d jsonb;
BEGIN
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=NULL;
 DELETE FROM email_suppression_list WHERE email='surfer@example.com';
 DELETE FROM user_email_prefs WHERE user_id=u;
 DELETE FROM sessions WHERE user_id=u;
 DELETE FROM user_events WHERE user_id=u;
 DELETE FROM user_entitlements WHERE user_id=u;
 DELETE FROM earned_pro_grants WHERE user_id=u;
 DELETE FROM pro_offer_awards WHERE user_id=u;
 UPDATE email_contact_state SET paused_at=NULL,provider_access_active=false WHERE user_id=u;
 DELETE FROM email_send_log;
 UPDATE auth.users SET created_at=now()-interval '4 days';
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now()-interval '1 day');
 INSERT INTO email_send_log(user_id,email_type,resend_message_id,sent_at)
 VALUES(gen_random_uuid(),'welcome','uncapped-one',now()),(gen_random_uuid(),'welcome','uncapped-two',now());
 d:=evaluate_email_lifecycle(u); ASSERT d->>'status'='due',d::text;
 INSERT INTO alert_rules VALUES(u,true,true);
 d:=claim_requested_email_alert(u,'uncapped','{"to":"surfer@example.com","html":"hello"}');
 ASSERT (d->>'allowed')::boolean,d::text;
END $$;
ROLLBACK;

BEGIN;
DO $$ DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; d jsonb;
BEGIN
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=2;
 DELETE FROM email_suppression_list WHERE email='surfer@example.com';
 DELETE FROM user_email_prefs WHERE user_id=u;
 DELETE FROM sessions WHERE user_id=u;
 DELETE FROM user_events WHERE user_id=u;
 DELETE FROM user_entitlements WHERE user_id=u;
 DELETE FROM earned_pro_grants WHERE user_id=u;
 DELETE FROM pro_offer_awards WHERE user_id=u;
 UPDATE email_contact_state SET paused_at=NULL,provider_access_active=false WHERE user_id=u;
 DELETE FROM email_send_log;
 UPDATE auth.users SET created_at=now()-interval '4 days';
 INSERT INTO user_events(user_id,bot_flagged,event_type,created_at) VALUES(u,false,'beach_view',now()-interval '1 day');
 INSERT INTO email_send_log(user_id,email_type,resend_message_id,sent_at)
 VALUES(gen_random_uuid(),'welcome','capped-one',now()),(gen_random_uuid(),'welcome','capped-two',now());
 ASSERT evaluate_email_lifecycle(u)->>'status'='deferred';
 INSERT INTO alert_rules VALUES(u,true,true);
 d:=claim_requested_email_alert(u,'capped','{"to":"surfer@example.com","html":"hello"}');
 ASSERT d->>'reason'='contact_cap',d::text;
END $$;
ROLLBACK;

BEGIN;
DO $$ DECLARE d jsonb; rejected boolean:=false;
BEGIN
 DELETE FROM email_suppression_list WHERE email='surfer@example.com';
 DELETE FROM user_email_prefs WHERE user_id='11111111-1111-4111-8111-111111111111';
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=false,daily_cap=NULL;
 d:=claim_requested_email_alert('11111111-1111-4111-8111-111111111111','disabled','{"to":"surfer@example.com","html":"hello"}');
 ASSERT d->>'reason'='disabled',d::text;
 BEGIN
  UPDATE email_contact_controls SET daily_cap=0;
  RAISE EXCEPTION 'daily_cap=0 was accepted';
 EXCEPTION WHEN check_violation THEN
  rejected:=true;
 END;
 ASSERT rejected;
END $$;
ROLLBACK;
