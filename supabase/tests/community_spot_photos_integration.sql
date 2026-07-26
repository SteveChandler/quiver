\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(value boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF value IS NOT TRUE THEN
    RAISE EXCEPTION 'assertion_failed: %', message;
  END IF;
END;
$$;

INSERT INTO auth.users (id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000006');

INSERT INTO public.profiles (id, display_name)
SELECT id, 'Surfer ' || right(id::text, 1)
FROM auth.users;

INSERT INTO public.beaches (id, is_private)
VALUES ('20000000-0000-4000-8000-000000000001', false);

INSERT INTO public.custom_spots (id, user_id, visibility, deleted_at)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'private',
  NULL
);

UPDATE public.community_photo_feature_config
SET read_enabled = true, writes_enabled = true;

SELECT pg_temp.assert_true(
  public.preflight_community_spot_photo_upload_v1(
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001'
  ),
  'cheap authenticated upload preflight passes before reservation'
);

UPDATE public.community_photo_feature_config SET writes_enabled = false;
DO $$
BEGIN
  PERFORM public.preflight_community_spot_photo_upload_v1(
    '10000000-0000-4000-8000-000000000006',
    'e0000000-0000-4000-8000-000000000001'
  );
  RAISE EXCEPTION 'expected feature_disabled';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%feature_disabled%' THEN RAISE; END IF;
END;
$$;
UPDATE public.community_photo_feature_config SET writes_enabled = true;
SELECT pg_temp.assert_true(
  public.preflight_community_spot_photo_upload_v1(
    '10000000-0000-4000-8000-000000000006',
    'e0000000-0000-4000-8000-000000000001'
  ),
  'a pre-reservation feature failure leaves the same key retry-safe'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.community_photo_action_events
    WHERE actor_id = '10000000-0000-4000-8000-000000000006'
      AND idempotency_key = 'e0000000-0000-4000-8000-000000000001'
  ),
  'pre-reservation failures do not consume a processing attempt'
);

SELECT *
FROM public.reserve_community_spot_photo_v1(
  'c0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000004',
  'beach',
  '20000000-0000-4000-8000-000000000001',
  'public',
  'overlap/c0000000-0000-4000-8000-000000000001.webp',
  '2026-07-25',
  true,
  'd0000000-0000-4000-8000-000000000001'
);
SELECT pg_temp.assert_true(
  (
    SELECT
      photo_id = 'c0000000-0000-4000-8000-000000000001'
      AND storage_path = 'overlap/c0000000-0000-4000-8000-000000000001.webp'
      AND replay
      AND processing_status = 'processing'
    FROM public.reserve_community_spot_photo_v1(
      'c0000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000004',
      'beach',
      '20000000-0000-4000-8000-000000000001',
      'public',
      'ignored-overlap-path.webp',
      '2026-07-25',
      true,
      'd0000000-0000-4000-8000-000000000001'
    )
  ),
  'overlapping same-key reservation returns stable processing state'
);
SELECT public.finalize_community_spot_photo_v1(
  'c0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000004',
  1600,
  900
);
SELECT pg_temp.assert_true(
  (
    SELECT replay AND processing_status = 'ready'
    FROM public.reserve_community_spot_photo_v1(
      'c0000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      'beach',
      '20000000-0000-4000-8000-000000000001',
      'public',
      'ignored-ready-path.webp',
      '2026-07-25',
      true,
      'd0000000-0000-4000-8000-000000000001'
    )
  ),
  'completed same-key reservation returns stable ready state'
);

DO $$
DECLARE
  attempt integer;
  photo_id uuid;
  attempt_key uuid;
BEGIN
  FOR attempt IN 1..5 LOOP
    photo_id := format(
      'a0000000-0000-4000-8000-%s',
      lpad(attempt::text, 12, '0')
    )::uuid;
    attempt_key := format(
      'b0000000-0000-4000-8000-%s',
      lpad(attempt::text, 12, '0')
    )::uuid;
    PERFORM *
    FROM public.reserve_community_spot_photo_v1(
      photo_id,
      '10000000-0000-4000-8000-000000000005',
      'beach',
      '20000000-0000-4000-8000-000000000001',
      'public',
      'failed/' || photo_id || '.webp',
      '2026-07-25',
      true,
      attempt_key
    );
    PERFORM public.fail_community_spot_photo_upload_v1(
      photo_id,
      '10000000-0000-4000-8000-000000000005',
      'invalid_image'
    );
  END LOOP;
END;
$$;
SELECT pg_temp.assert_true(
  (
    SELECT count(*) = 5
    FROM public.community_photo_action_events
    WHERE actor_id = '10000000-0000-4000-8000-000000000005'
      AND action = 'upload_reserved'
  ),
  'five failed processing attempts preserve five durable reservations'
);
DO $$
BEGIN
  PERFORM public.preflight_community_spot_photo_upload_v1(
    '10000000-0000-4000-8000-000000000005',
    'b0000000-0000-4000-8000-000000000006'
  );
  RAISE EXCEPTION 'expected rolling_upload_limit';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%rolling_upload_limit%' THEN RAISE; END IF;
END;
$$;
DO $$
BEGIN
  PERFORM public.preflight_community_spot_photo_upload_v1(
    '10000000-0000-4000-8000-000000000005',
    'b0000000-0000-4000-8000-000000000001'
  );
  RAISE EXCEPTION 'expected upload_attempt_failed';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%upload_attempt_failed%' THEN RAISE; END IF;
END;
$$;
DO $$
BEGIN
  PERFORM *
  FROM public.reserve_community_spot_photo_v1(
    'a0000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000005',
    'custom_spot',
    '30000000-0000-4000-8000-000000000001',
    'private',
    'failed/different-payload.webp',
    '2026-07-25',
    true,
    'b0000000-0000-4000-8000-000000000001'
  );
  RAISE EXCEPTION 'expected upload_attempt_failed';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%upload_attempt_failed%' THEN RAISE; END IF;
END;
$$;
SELECT pg_temp.assert_true(
  (
    SELECT
      count(*) FILTER (WHERE action = 'upload_reserved') = 5
      AND count(*) FILTER (WHERE action = 'upload_failed') = 5
    FROM public.community_photo_action_events
    WHERE actor_id = '10000000-0000-4000-8000-000000000005'
      AND action IN ('upload_reserved', 'upload_failed')
  ),
  'failed-key reuse does not add a reservation or failure event'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.community_spot_photos
    WHERE id = 'a0000000-0000-4000-8000-000000000006'
  ),
  'failed-key reuse with a different payload creates no processing row'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beach_photo_submissions'
      AND policyname IN ('bps_insert_own', 'bps_update_own')
  ),
  'legacy submission writes are frozen'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beach_photo_submission_votes'
      AND policyname IN ('bpsv_insert_own', 'bpsv_delete_own')
  ),
  'legacy vote writes are frozen'
);

SELECT *
FROM public.reserve_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'beach',
  '20000000-0000-4000-8000-000000000001',
  'public',
  '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.webp',
  '2026-07-25',
  true,
  '50000000-0000-4000-8000-000000000001'
);
SELECT *
FROM public.reserve_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'beach',
  '20000000-0000-4000-8000-000000000001',
  'public',
  '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000002.webp',
  '2026-07-25',
  true,
  '50000000-0000-4000-8000-000000000002'
);
SELECT *
FROM public.reserve_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'beach',
  '20000000-0000-4000-8000-000000000001',
  'public',
  '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000003.webp',
  '2026-07-25',
  true,
  '50000000-0000-4000-8000-000000000003'
);

DO $$
BEGIN
  PERFORM *
  FROM public.reserve_community_spot_photo_v1(
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'beach',
    '20000000-0000-4000-8000-000000000001',
    'public',
    'limit.webp',
    '2026-07-25',
    true,
    '50000000-0000-4000-8000-000000000004'
  );
  RAISE EXCEPTION 'expected target_active_limit';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%target_active_limit%' THEN RAISE; END IF;
END;
$$;

SELECT pg_temp.assert_true(
  public.finalize_community_spot_photo_v1(
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1600,
    900
  ),
  'first photo finalizes'
);
SELECT public.finalize_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  1600,
  900
);
SELECT public.finalize_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  1600,
  900
);

SELECT pg_temp.assert_true(
  (
    SELECT photo_id = '40000000-0000-4000-8000-000000000001'
    FROM public.resolve_community_spot_photo_by_id_v1(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    )
  ),
  'new upload resolves directly by id'
);

SELECT *
FROM public.reserve_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  'custom_spot',
  '30000000-0000-4000-8000-000000000001',
  'private',
  '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000004.webp',
  '2026-07-25',
  true,
  '50000000-0000-4000-8000-000000000004'
);
SELECT public.finalize_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  1200,
  800
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.get_community_spot_photo_image_v1(
      '40000000-0000-4000-8000-000000000004',
      NULL
    )
  ),
  'private custom photo is hidden from non-owner'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.get_community_spot_photo_image_v1(
      '40000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000001'
    )
  ),
  'private custom photo is visible to owner'
);

UPDATE public.community_photo_feature_config SET read_enabled = false;
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.resolve_community_spot_photos_v1(
      'beach',
      '20000000-0000-4000-8000-000000000001',
      NULL,
      20
    )
  ),
  'database read flag closes gallery resolver'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.get_community_spot_photo_image_v1(
      '40000000-0000-4000-8000-000000000001',
      NULL
    )
  ),
  'database read flag closes direct image resolver'
);
UPDATE public.community_photo_feature_config SET read_enabled = true;

DO $$
BEGIN
  PERFORM *
  FROM public.vote_community_spot_photo_v1(
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'up',
    '60000000-0000-4000-8000-000000000001'
  );
  RAISE EXCEPTION 'expected photo_owner_cannot_vote';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%photo_owner_cannot_vote%' THEN RAISE; END IF;
END;
$$;

SELECT *
FROM public.vote_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'up',
  '60000000-0000-4000-8000-000000000002'
);
SELECT *
FROM public.vote_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  'up',
  '60000000-0000-4000-8000-000000000003'
);
SELECT *
FROM public.vote_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000004',
  'up',
  '60000000-0000-4000-8000-000000000004'
);
SELECT *
FROM public.vote_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000005',
  'up',
  '60000000-0000-4000-8000-000000000005'
);
SELECT *
FROM public.vote_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000006',
  'up',
  '60000000-0000-4000-8000-000000000006'
);

SELECT pg_temp.assert_true(
  (
    SELECT vote_score > 0
    FROM public.vote_community_spot_photo_v1(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000006',
      'up',
      '60000000-0000-4000-8000-000000000006'
    )
  ),
  'Wilson score starts at five votes'
);

SELECT *
FROM public.report_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'wrong_spot',
  '70000000-0000-4000-8000-000000000002'
);
SELECT *
FROM public.report_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  'stale',
  '70000000-0000-4000-8000-000000000003'
);
SELECT *
FROM public.report_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004',
  'wrong_spot',
  '70000000-0000-4000-8000-000000000004'
);
SELECT pg_temp.assert_true(
  (
    SELECT moderation_status = 'hidden'
    FROM public.community_spot_photos
    WHERE id = '40000000-0000-4000-8000-000000000002'
  ),
  'three unique quality reporters hide a photo'
);

SELECT *
FROM public.report_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000002',
  'privacy',
  '70000000-0000-4000-8000-000000000005'
);
SELECT pg_temp.assert_true(
  (
    SELECT moderation_status = 'hidden'
    FROM public.community_spot_photos
    WHERE id = '40000000-0000-4000-8000-000000000003'
  ),
  'a severe report hides immediately'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.get_admin_community_spot_photo_image_v1(
      '40000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000006',
      '71000000-0000-4000-8000-000000000001'
    )
  ),
  'admin hidden-media access returns non-purged hidden media'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.community_photo_moderation_events
    WHERE photo_id = '40000000-0000-4000-8000-000000000003'
      AND action = 'admin_view_hidden'
      AND idempotency_key = '71000000-0000-4000-8000-000000000001'
  ),
  'admin hidden-media access is audited'
);
DO $$
BEGIN
  PERFORM *
  FROM public.get_admin_community_spot_photo_image_v1(
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000006',
    '71000000-0000-4000-8000-000000000002'
  );
  RAISE EXCEPTION 'expected photo_not_found';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%photo_not_found%' THEN RAISE; END IF;
END;
$$;

SELECT *
FROM public.remove_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001'
);
SELECT pg_temp.assert_true(
  (
    SELECT recoverable_until = removed_at + interval '30 days'
    FROM public.community_spot_photos
    WHERE id = '40000000-0000-4000-8000-000000000004'
  ),
  'contributor removal recovery is exactly 30 days'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.list_owned_removed_community_spot_photos_v1(
      '10000000-0000-4000-8000-000000000001'
    )
    WHERE photo_id = '40000000-0000-4000-8000-000000000004'
  ),
  'owner can discover a recoverable removal'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.get_community_spot_photo_image_v1(
      '40000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000001'
    )
  ),
  'owner can preview removed media during recovery'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.get_community_spot_photo_image_v1(
      '40000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000002'
    )
  ),
  'non-owner cannot preview removed media'
);
SELECT *
FROM public.recover_owned_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001'
);
SELECT pg_temp.assert_true(
  (
    SELECT lifecycle_status = 'active'
    FROM public.community_spot_photos
    WHERE id = '40000000-0000-4000-8000-000000000004'
  ),
  'owner recovery restores a visible unheld photo'
);
SELECT *
FROM public.remove_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002'
);

SELECT *
FROM public.hold_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000006',
  'active investigation',
  '80000000-0000-4000-8000-000000000002'
);
UPDATE public.community_spot_photos
SET removed_at = now() - interval '31 days',
    recoverable_until = now() - interval '1 day'
WHERE id = '40000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.purge_removed_community_spot_photos_v1(now(), 100)
    WHERE photo_id = '40000000-0000-4000-8000-000000000004'
  ),
  'investigation hold blocks purge'
);

SELECT *
FROM public.remove_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000003'
);
DO $$
BEGIN
  PERFORM *
  FROM public.recover_owned_community_spot_photo_v1(
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004'
  );
  RAISE EXCEPTION 'expected photo_not_recoverable';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%photo_not_recoverable%' THEN RAISE; END IF;
END;
$$;
UPDATE public.community_spot_photos
SET removed_at = now() - interval '31 days',
    recoverable_until = now() - interval '1 day'
WHERE id = '40000000-0000-4000-8000-000000000003';
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.purge_removed_community_spot_photos_v1(now(), 100)
    WHERE photo_id = '40000000-0000-4000-8000-000000000003'
  ),
  'expired unheld removal is claimed for purge'
);
DO $$
BEGIN
  PERFORM *
  FROM public.hold_community_spot_photo_v1(
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000006',
    'too late',
    '81000000-0000-4000-8000-000000000005'
  );
  RAISE EXCEPTION 'expected photo_not_found';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%photo_not_found%' THEN RAISE; END IF;
END;
$$;

SELECT *
FROM public.reserve_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000006',
  'beach',
  '20000000-0000-4000-8000-000000000001',
  'public',
  '10000000-0000-4000-8000-000000000006/40000000-0000-4000-8000-000000000006.webp',
  '2026-07-25',
  true,
  '82000000-0000-4000-8000-000000000001'
);
UPDATE public.community_spot_photos
SET updated_at = now() - interval '16 minutes'
WHERE id = '40000000-0000-4000-8000-000000000006';
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.claim_stuck_community_spot_photo_uploads_v1(now(), 100)
    WHERE photo_id = '40000000-0000-4000-8000-000000000006'
  ),
  'stuck processing upload is claimed for compensation'
);
SELECT pg_temp.assert_true(
  public.finalize_stuck_community_spot_photo_uploads_v1(
    ARRAY['40000000-0000-4000-8000-000000000006'::uuid]
  ) = 1,
  'stuck processing compensation removes the reservation'
);
INSERT INTO storage.objects (id, bucket_id, name, created_at)
VALUES (
  '90000000-0000-4000-8000-000000000001',
  'community-spot-photos',
  'orphan/orphan.webp',
  now() - interval '16 minutes'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM public.list_orphan_community_photo_objects_v1(now(), 100)
    WHERE storage_path = 'orphan/orphan.webp'
  ),
  'orphan storage object is surfaced for compensation'
);

DELETE FROM auth.users
WHERE id = '10000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_true(
  (
    SELECT uploader_id IS NULL
    FROM public.community_spot_photos
    WHERE id = '40000000-0000-4000-8000-000000000001'
  ),
  'account deletion anonymizes uploader'
);
SELECT pg_temp.assert_true(
  (
    SELECT contributor_id IS NULL
    FROM public.community_photo_consents
    WHERE photo_id = '40000000-0000-4000-8000-000000000001'
  ),
  'account deletion anonymizes consent'
);
SELECT pg_temp.assert_true(
  (
    SELECT uploader_id IS NULL
    FROM public.community_spot_photos
    WHERE id = '40000000-0000-4000-8000-000000000001'
  ),
  'published photo remains anonymized'
);
SELECT *
FROM public.vote_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'down',
  '83000000-0000-4000-8000-000000000001'
);
SELECT *
FROM public.report_community_spot_photo_v1(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'stale',
  '83000000-0000-4000-8000-000000000002'
);

ROLLBACK;
