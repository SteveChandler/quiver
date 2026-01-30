-- Migration: Reset onboarding for users who were stuck by the completion bug
--
-- Bug: The "View Full Forecast" button in onboarding completion step wasn't working
-- because the code incorrectly accessed the response from saveOnboardingData.
-- When users closed the modal with X instead, skipOnboarding() was called which
-- set onboarding_completed_at but their home_beach_id was never saved.
--
-- This migration identifies and fixes affected users by:
-- 1. Finding users who have onboarding_completed_at set (indicating they saw onboarding)
-- 2. But have no home_beach_id (indicating the save never completed)
-- 3. Resetting their onboarding_completed_at to NULL so they can redo onboarding
--
-- After the code fix is deployed, these users will see onboarding again on their
-- next visit and can properly complete the flow.
--
-- ROLLBACK (if needed):
-- UPDATE profiles
-- SET onboarding_completed_at = updated_at
-- WHERE onboarding_completed_at IS NULL
--   AND home_beach_id IS NULL
--   AND updated_at > '2026-01-30';

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
  RAISE NOTICE 'Reset onboarding for % users with incomplete setup', affected_count;
END $$;
