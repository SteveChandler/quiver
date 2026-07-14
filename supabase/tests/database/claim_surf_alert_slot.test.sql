BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(16);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS index_class
    JOIN pg_catalog.pg_index AS index_meta
      ON index_meta.indexrelid = index_class.oid
    WHERE index_class.relname = 'idx_alert_deliveries_legacy_null_beach_dedup'
      AND index_meta.indisunique = true
      AND index_meta.indpred IS NOT NULL
  ),
  'legacy alert writers retain a unique partial deduplication index during rollout'
);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '81000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'surf-alert-slot-test@quiversurf.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

INSERT INTO public.beaches (id, name, lat, lon)
VALUES (
  '82000000-0000-4000-8000-000000000001',
  'Surf Alert Slot Test Beach',
  32.85,
  -117.27
);

INSERT INTO public.alert_rules (id, user_id, beach_id, name, conditions)
VALUES (
  '83000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'Surf alert slot test rule',
  '{}'
);

INSERT INTO public.alert_queue (
  id,
  user_id,
  rule_id,
  beach_id,
  alert_date,
  send_at,
  window_start,
  window_end,
  best_hour,
  conditions_snapshot
) VALUES (
  '84000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  DATE '2026-07-14',
  now(),
  now(),
  now() + interval '1 hour',
  now() + interval '30 minutes',
  '{"alert_type":"similarity_match"}'
);

INSERT INTO public.notification_events (
  id,
  recipient_user_id,
  type,
  payload,
  status
) VALUES
  (
    '85000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'similarity_match',
    '{"queue_items":[{"queue_id":"84000000-0000-4000-8000-000000000001","rule_id":"83000000-0000-4000-8000-000000000001"}]}',
    'pending'
  ),
  (
    '85000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000001',
    'similarity_match',
    '{}',
    'pending'
  ),
  (
    '85000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000001',
    'forecast_alert',
    '{}',
    'pending'
  ),
  (
    '85000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000001',
    'home_break_call',
    '{}',
    'processed'
  ),
  (
    '85000000-0000-4000-8000-000000000005',
    '81000000-0000-4000-8000-000000000001',
    'similarity_match',
    '{"queue_items":[{"queue_id":"not-a-uuid","rule_id":"also-not-a-uuid"}]}',
    'pending'
  ),
  (
    '85000000-0000-4000-8000-000000000006',
    '81000000-0000-4000-8000-000000000001',
    'forecast_alert',
    '{}',
    'pending'
  ),
  (
    '85000000-0000-4000-8000-000000000007',
    '81000000-0000-4000-8000-000000000001',
    'forecast_alert',
    '{}',
    'pending'
  );

SELECT ok(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-14',
    2::smallint
  ),
  'the first event claims an empty surf-alert slot'
);

SELECT is(
  (
    SELECT winner_notification_event_id
    FROM public.surf_alert_delivery_slots
    WHERE alert_date = DATE '2026-07-14'
  ),
  '85000000-0000-4000-8000-000000000001'::uuid,
  'the first event is persisted as the winner'
);

SELECT isnt(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-14',
    2::smallint
  ),
  true,
  'an equal-priority pending event cannot replace the winner'
);

SELECT is(
  (
    SELECT status
    FROM public.notification_events
    WHERE id = '85000000-0000-4000-8000-000000000001'
  ),
  'pending',
  'an equal-priority challenger does not cancel the winner'
);

SELECT ok(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-14',
    3::smallint
  ),
  'a higher-priority event replaces a pending winner'
);

SELECT is(
  (
    SELECT status
    FROM public.notification_events
    WHERE id = '85000000-0000-4000-8000-000000000001'
  ),
  'cancelled',
  'the displaced pending event is cancelled'
);

SELECT is(
  (
    SELECT skip_reason
    FROM public.notification_events
    WHERE id = '85000000-0000-4000-8000-000000000001'
  ),
  'skipped_redundant',
  'the displaced event records its redundant skip reason'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.alert_delivery_attempts
    WHERE queue_id = '84000000-0000-4000-8000-000000000001'
      AND status = 'skipped_dedup_collision'
      AND skip_reason = 'skipped_dedup'
  ),
  1::bigint,
  'the displaced queue item receives terminal delivery bookkeeping'
);

SELECT is(
  (
    SELECT winner_notification_event_id
    FROM public.surf_alert_delivery_slots
    WHERE alert_date = DATE '2026-07-14'
  ),
  '85000000-0000-4000-8000-000000000003'::uuid,
  'the higher-priority event becomes the durable winner'
);

SELECT ok(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-15',
    1::smallint
  ),
  'a processed event may claim its own empty slot'
);

SELECT isnt(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000007',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-15',
    3::smallint
  ),
  true,
  'a processed winner cannot be displaced'
);

SELECT is(
  (
    SELECT winner_notification_event_id
    FROM public.surf_alert_delivery_slots
    WHERE alert_date = DATE '2026-07-15'
  ),
  '85000000-0000-4000-8000-000000000004'::uuid,
  'the processed winner remains in the slot'
);

SELECT ok(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000005',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-16',
    2::smallint
  ),
  'a legacy event with malformed queue metadata can claim a slot'
);

SELECT ok(
  public.claim_surf_alert_slot(
    '85000000-0000-4000-8000-000000000006',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    DATE '2026-07-16',
    3::smallint
  ),
  'malformed legacy queue metadata does not abort replacement'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.alert_delivery_attempts
    WHERE queue_id = '84000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'malformed metadata does not create unrelated delivery attempts'
);

SELECT * FROM finish();

ROLLBACK;
