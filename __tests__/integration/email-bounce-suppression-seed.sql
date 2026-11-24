\set ON_ERROR_STOP on
-- Rows that exist before 20261124160000_email_repeat_bounce_suppression.sql runs; its backfill must find them.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('b0b00000-0000-4000-8000-000000000001','repeat-backfill@example.com'),
 ('b0b00000-0000-4000-8000-000000000002','single-backfill@example.com'),
 ('b0b00000-0000-4000-8000-000000000003','hard-backfill@example.com');
INSERT INTO public.profiles(id,email,analytics_is_real_user,notif_email_enabled) VALUES
 ('b0b00000-0000-4000-8000-000000000001','Repeat-Backfill@example.com',true,true),
 ('b0b00000-0000-4000-8000-000000000002','single-backfill@example.com',true,true),
 ('b0b00000-0000-4000-8000-000000000003','hard-backfill@example.com',true,true);
INSERT INTO public.email_contact_state(user_id) VALUES
 ('b0b00000-0000-4000-8000-000000000001'),('b0b00000-0000-4000-8000-000000000002'),('b0b00000-0000-4000-8000-000000000003');
INSERT INTO public.email_send_log(user_id,email_type,resend_message_id,sent_at,bounced_at) VALUES
 ('b0b00000-0000-4000-8000-000000000001','conditions_alert','backfill-r1',now()-interval '9 days',now()-interval '9 days'),
 ('b0b00000-0000-4000-8000-000000000001','conditions_alert','backfill-r2',now()-interval '5 days',now()-interval '5 days'),
 ('b0b00000-0000-4000-8000-000000000001','conditions_alert','backfill-r3',now()-interval '2 days',NULL),
 ('b0b00000-0000-4000-8000-000000000002','conditions_alert','backfill-s1',now()-interval '5 days',now()-interval '5 days'),
 ('b0b00000-0000-4000-8000-000000000002','conditions_alert','backfill-s2',now()-interval '2 days',NULL),
 ('b0b00000-0000-4000-8000-000000000003','conditions_alert','backfill-h1',now()-interval '9 days',now()-interval '9 days'),
 ('b0b00000-0000-4000-8000-000000000003','conditions_alert','backfill-h2',now()-interval '5 days',now()-interval '5 days');
INSERT INTO public.email_suppression_list(email,reason) VALUES ('hard-backfill@example.com','hard_bounce');
COMMIT;
