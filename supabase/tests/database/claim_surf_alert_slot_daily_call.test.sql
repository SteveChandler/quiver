BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '86000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'daily-call-slot-test@quiversurf.test',
  '{"provider":"email","providers":["email"]}',
  '{}'
);

INSERT INTO public.notification_events (id, recipient_user_id, type, payload, status)
VALUES
  (
    '87000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    'daily_call',
    '{"alert_date":"2026-10-16"}',
    'processed'
  ),
  (
    '87000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000001',
    'forecast_alert',
    '{"alert_date":"2026-10-16"}',
    'pending'
  );

SELECT ok(
  public.claim_surf_alert_slot(
    '87000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    DATE '2026-10-16',
    2::smallint
  ),
  'the processed priority-2 Daily Call owns the slot'
);

SELECT is(
  public.claim_surf_alert_slot(
    '87000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000001',
    DATE '2026-10-16',
    3::smallint
  ),
  false,
  'current known-inverted behaviour awaiting a product decision: a processed priority-2 Daily Call rejects a later priority-3 manual alert'
);

SELECT is(
  (SELECT winner_notification_event_id FROM public.surf_alert_delivery_slots
   WHERE recipient_user_id = '86000000-0000-4000-8000-000000000001' AND alert_date = DATE '2026-10-16'),
  '87000000-0000-4000-8000-000000000001'::uuid,
  'the Daily Call remains the winner'
);

SELECT is(
  (SELECT priority FROM public.surf_alert_delivery_slots
   WHERE recipient_user_id = '86000000-0000-4000-8000-000000000001' AND alert_date = DATE '2026-10-16'),
  2::smallint,
  'the slot retains priority 2'
);

SELECT is(
  (SELECT status FROM public.notification_events WHERE id = '87000000-0000-4000-8000-000000000001'),
  'processed',
  'the processed winner is unchanged'
);

UPDATE public.notification_events
SET status = 'processing'
WHERE id = '87000000-0000-4000-8000-000000000001';

SELECT is(
  public.claim_surf_alert_slot(
    '87000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000001',
    DATE '2026-10-16',
    3::smallint
  ),
  false,
  'a processing priority-2 Daily Call also rejects the later priority-3 manual alert'
);

SELECT is(
  (SELECT status FROM public.notification_events WHERE id = '87000000-0000-4000-8000-000000000001'),
  'processing',
  'the in-flight winner is unchanged'
);

SELECT is(
  (SELECT status FROM public.notification_events WHERE id = '87000000-0000-4000-8000-000000000002'),
  'pending',
  'the SQL claim leaves challenger cancellation to the worker'
);

SELECT * FROM finish();
ROLLBACK;
