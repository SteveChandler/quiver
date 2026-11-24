\set ON_ERROR_STOP on
-- Runs after email-bounce-suppression-seed.sql and two runs of 20261124160000_email_repeat_bounce_suppression.sql.

-- Backfill: two bounced messages suppress and pause; one does not; an existing reason is kept; a second run adds nothing.
DO $$ BEGIN
 ASSERT (SELECT reason FROM email_suppression_list WHERE email='repeat-backfill@example.com')='repeat_bounce';
 ASSERT (SELECT count(*) FROM email_suppression_list WHERE email='repeat-backfill@example.com')=1;
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id='b0b00000-0000-4000-8000-000000000001') IS NOT NULL;
 ASSERT NOT EXISTS (SELECT 1 FROM email_suppression_list WHERE email='single-backfill@example.com');
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id='b0b00000-0000-4000-8000-000000000002') IS NULL;
 ASSERT (SELECT reason FROM email_suppression_list WHERE email='hard-backfill@example.com')='hard_bounce';
 ASSERT (SELECT count(*) FROM email_suppression_list WHERE email='hard-backfill@example.com')=1;
END $$;

BEGIN;
DO $$
DECLARE
 l uuid := 'b0b00000-0000-4000-8000-000000000011';
 h uuid := 'b0b00000-0000-4000-8000-000000000012';
 c uuid := 'b0b00000-0000-4000-8000-000000000013';
 n uuid := 'b0b00000-0000-4000-8000-000000000014';
 day_zone text;
 d jsonb;
BEGIN
 UPDATE email_contact_controls SET enabled=true,lifecycle_enabled=true,daily_cap=NULL WHERE singleton;
 SELECT name INTO day_zone FROM pg_catalog.pg_timezone_names
  WHERE (now() AT TIME ZONE name)::time BETWEEN time '10:00' AND time '15:59:59' ORDER BY name LIMIT 1;
 INSERT INTO auth.users(id,email) VALUES (l,'live-bounce@example.com'),(h,'live-hard@example.com'),(c,'live-complaint@example.com'),(n,'live-unlogged@example.com');
 INSERT INTO profiles(id,email,analytics_is_real_user,notif_email_enabled,timezone) VALUES
  (l,'live-bounce@example.com',true,true,day_zone),(h,'live-hard@example.com',true,true,day_zone),
  (c,'live-complaint@example.com',true,true,day_zone),(n,'live-unlogged@example.com',true,true,day_zone);
 INSERT INTO email_contact_state(user_id) VALUES (l),(h),(c),(n);
 INSERT INTO alert_rules(user_id,enabled,notify_email) VALUES (l,true,true);
 INSERT INTO email_send_log(user_id,email_type,resend_message_id,sent_at) VALUES
  (l,'conditions_alert','live-m1',now()-interval '6 days'),(l,'conditions_alert','live-m2',now()-interval '3 days'),
  (h,'conditions_alert','live-h1',now()-interval '3 days'),(c,'conditions_alert','live-c1',now()-interval '3 days');
 INSERT INTO email_send_log(user_id,email_type,resend_message_id,sent_at,bounced_at) VALUES
  (n,'conditions_alert','live-n1',now()-interval '6 days',now()-interval '6 days');

 d := claim_requested_email_alert(l,'before-bounce','{"to":"live-bounce@example.com","html":"Surf"}');
 ASSERT (d->>'allowed')::boolean,d::text;
 DELETE FROM email_contact_attempts WHERE user_id=l;

 -- One hard bounce suppresses at once (existing rule) and keeps the provider type.
 PERFORM record_lifecycle_provider_event_v2('wh-h1','live-h1','email.bounced',now(),ARRAY['Live-Hard@example.com'],true,'Permanent','General');
 ASSERT (SELECT reason FROM email_suppression_list WHERE email='live-hard@example.com')='hard_bounce';
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id=h) IS NOT NULL;
 ASSERT (SELECT bounce_type||'/'||bounce_subtype FROM email_delivery_events WHERE webhook_message_id='wh-h1')='Permanent/General';

 -- First soft bounce: recorded, not suppressed, not paused.
 PERFORM record_lifecycle_provider_event_v2('wh-l1','live-m1','email.bounced',now(),ARRAY['live-bounce@example.com'],false,'Transient','MailboxFull');
 ASSERT NOT EXISTS (SELECT 1 FROM email_suppression_list WHERE email='live-bounce@example.com');
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id=l) IS NULL;
 ASSERT (SELECT bounce_type FROM email_delivery_events WHERE webhook_message_id='wh-l1')='Transient';
 ASSERT (SELECT bounced_at FROM email_send_log WHERE resend_message_id='live-m1') IS NOT NULL;

 -- A replayed webhook and a second webhook for the same message are still one bounced message.
 PERFORM record_lifecycle_provider_event_v2('wh-l1','live-m1','email.bounced',now(),ARRAY['live-bounce@example.com'],false,'Transient','MailboxFull');
 PERFORM record_lifecycle_provider_event_v2('wh-l1-again','live-m1','email.bounced',now(),ARRAY['live-bounce@example.com'],false,'Transient','MailboxFull');
 ASSERT NOT EXISTS (SELECT 1 FROM email_suppression_list WHERE email='live-bounce@example.com');
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id=l) IS NULL;

 -- Other event types never count as a bounce.
 PERFORM record_lifecycle_provider_event_v2('wh-l2-delivered','live-m2','email.delivered',now(),ARRAY['live-bounce@example.com'],false,NULL,NULL);
 ASSERT NOT EXISTS (SELECT 1 FROM email_suppression_list WHERE email='live-bounce@example.com');
 ASSERT (SELECT bounce_type FROM email_delivery_events WHERE webhook_message_id='wh-l2-delivered') IS NULL;

 -- Second bounced message of any type: suppress and pause.
 PERFORM record_lifecycle_provider_event_v2('wh-l2','live-m2','email.bounced',now(),ARRAY['LIVE-bounce@example.com '],false,'Undetermined','Undetermined');
 ASSERT (SELECT reason FROM email_suppression_list WHERE email='live-bounce@example.com')='repeat_bounce';
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id=l) IS NOT NULL;
 d := claim_requested_email_alert(l,'after-bounce','{"to":"live-bounce@example.com","html":"Surf"}');
 ASSERT d->>'reason'='ineligible_or_suppressed',d::text;

 -- A bounce for a message missing from email_send_log still counts as one message.
 PERFORM record_lifecycle_provider_event_v2('wh-n2','unlogged-message','email.bounced',now(),ARRAY['live-unlogged@example.com'],false,'Transient','General');
 ASSERT (SELECT reason FROM email_suppression_list WHERE email='live-unlogged@example.com')='repeat_bounce';

 -- Complaint suppresses at once (existing rule).
 PERFORM record_lifecycle_provider_event_v2('wh-c1','live-c1','email.complained',now(),ARRAY['live-complaint@example.com'],false,NULL,NULL);
 ASSERT (SELECT reason FROM email_suppression_list WHERE email='live-complaint@example.com')='complaint';
 ASSERT (SELECT paused_at FROM email_contact_state WHERE user_id=c) IS NOT NULL;
 ASSERT (SELECT bounce_type FROM email_delivery_events WHERE webhook_message_id='wh-c1') IS NULL;

 -- A soft bounce with no recipient is stored without error; a hard bounce with no recipient still fails.
 PERFORM record_lifecycle_provider_event_v2('wh-empty','live-c1','email.bounced',now(),ARRAY[]::text[],false,'Transient','General');
 ASSERT EXISTS (SELECT 1 FROM email_delivery_events WHERE webhook_message_id='wh-empty');
 BEGIN
  PERFORM record_lifecycle_provider_event_v2('wh-empty-hard','live-c1','email.bounced',now(),ARRAY[]::text[],true,'Permanent','General');
  RAISE EXCEPTION 'hard bounce without recipient was accepted';
 EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM='Suppression recipient missing',SQLERRM;
 END;

 -- The old function is unchanged for code that deploys before this migration.
 PERFORM record_lifecycle_provider_event('wh-old','live-h1','email.delivered',now(),ARRAY['live-hard@example.com'],false);
 ASSERT EXISTS (SELECT 1 FROM email_delivery_events WHERE webhook_message_id='wh-old' AND bounce_type IS NULL);
END $$;
ROLLBACK;

BEGIN;
DO $$ BEGIN
 ASSERT has_function_privilege('service_role','public.record_lifecycle_provider_event_v2(text,text,text,timestamptz,text[],boolean,text,text,text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.record_lifecycle_provider_event_v2(text,text,text,timestamptz,text[],boolean,text,text,text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.record_lifecycle_provider_event_v2(text,text,text,timestamptz,text[],boolean,text,text,text,text)','EXECUTE');
 ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE proname='record_lifecycle_provider_event_v2');
END $$;
ROLLBACK;
