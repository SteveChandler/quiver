BEGIN;

-- Re-reset users who dismissed onboarding without setting a home beach.
-- This gives them another chance with the improved onboarding flow.
--
-- This is a repeat of 20260130143450_reset_stuck_onboarding_users.sql for
-- users who became stuck after that migration ran. The improved onboarding
-- UI reduces the likelihood of users getting stuck again.
--
-- ROLLBACK (if needed):
-- UPDATE profiles
-- SET onboarding_completed_at = updated_at
-- WHERE onboarding_completed_at IS NULL
--   AND home_beach_id IS NULL
--   AND updated_at > '2026-02-23';

DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE profiles
  SET onboarding_completed_at = NULL,
      updated_at = now()
  WHERE onboarding_completed_at IS NOT NULL
    AND home_beach_id IS NULL;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Re-reset onboarding for % users with incomplete setup', affected_count;
END $$;

COMMIT;
