-- Intentionally ordered between the January Board Rec seed and the July
-- session_created backfill. Do not rename or retimestamp this migration:
-- fresh replays must classify the synthetic profile before 20260709123000.
--
-- Production already tracks both surrounding migrations, so this bridge must
-- be applied with the approved out-of-order ledger procedure. The production
-- database had no matching seed profile as of 2026-07-21, making its DML a
-- no-op there while still repairing clean migration replays.

BEGIN;

UPDATE public.profiles AS p
SET
  is_mock = true,
  analytics_is_real_user = false,
  analytics_exclusion_reason = 'mock_profile'
WHERE p.full_name = 'Board Rec Test User'
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.boards AS b
    WHERE b.user_id = p.id
      AND b.name = 'Performance Thruster'
  )
  AND EXISTS (
    SELECT 1
    FROM public.boards AS b
    WHERE b.user_id = p.id
      AND b.name = 'Retro Fish'
  )
  AND EXISTS (
    SELECT 1
    FROM public.boards AS b
    WHERE b.user_id = p.id
      AND b.name = 'Classic Noserider'
  )
  AND (
    p.is_mock IS DISTINCT FROM true
    OR p.analytics_is_real_user IS DISTINCT FROM false
    OR p.analytics_exclusion_reason IS DISTINCT FROM 'mock_profile'
  );

COMMIT;
