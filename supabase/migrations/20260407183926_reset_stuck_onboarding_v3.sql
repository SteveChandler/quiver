-- Migration: Reset onboarding for users stuck by Bugs A and B (third cleanup pass)
--
-- Context:
-- Two prior migrations (20260130143450_reset_stuck_onboarding_users.sql and
-- 20260223120001_re_reset_stuck_onboarding.sql) reset users who ended up with
-- `onboarding_completed_at IS NOT NULL AND home_beach_id IS NULL`. The same
-- pattern kept recurring because the underlying bugs were never fixed in code:
--
--   Bug A: The onboarding dialog's X button (handleSkip) called skipOnboarding()
--          directly, bypassing all escalating-snooze logic. ~33% of new users
--          reflex-tapped it within 6 seconds and got permanently locked out.
--
--   Bug B: PayoffStep called saveOnboardingData in a mount useEffect. The resulting
--          updateProfile() flowed through ProfileContext and triggered the dialog's
--          stale-close effect, dismissing the dialog before the user saw the
--          celebration UI or clicked the finish button. 100% bug rate.
--
-- Both bugs are fixed in this plan cycle (see plans/majestic-squishing-newell.md).
-- This migration resets affected users ONE MORE TIME so they can re-enter the
-- now-fixed flow. After this, the pattern should stop recurring.
--
-- Ordering: this migration MUST run AFTER fixes 1-6 are deployed. Otherwise the
-- reset users will re-enter the broken flow and hit the same bugs again. Verify
-- production health before applying.
--
-- ROLLBACK (if needed):
-- UPDATE profiles
-- SET onboarding_completed_at = updated_at
-- WHERE onboarding_completed_at IS NULL
--   AND home_beach_id IS NULL
--   AND updated_at > '2026-04-07';

BEGIN;

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
  RAISE NOTICE 'v3 cleanup: reset onboarding for % users with incomplete setup', affected_count;
END $$;

COMMIT;
