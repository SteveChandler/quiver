-- Migration: Backfill user_email_prefs for existing users
-- Part of re-engagement email system for inactive users
--
-- Problem: user_email_prefs records were never created during onboarding,
-- causing users to miss forecast-digest-email and weekend-outlook-email.
--
-- This backfill creates email prefs for all users who:
-- 1. Have a home_beach_id set
-- 2. Have notif_email_enabled = true
-- 3. Don't already have a user_email_prefs record

INSERT INTO user_email_prefs (
  user_id,
  email_frequency,
  skill_level,
  pref_time_bucket,
  timezone,
  home_beach_id
)
SELECT
  p.id AS user_id,
  'daily' AS email_frequency,
  COALESCE(LOWER(p.experience_level), 'beginner') AS skill_level,
  'dawn' AS pref_time_bucket,
  COALESCE(p.timezone, 'America/Los_Angeles') AS timezone,
  p.home_beach_id
FROM profiles p
WHERE p.home_beach_id IS NOT NULL
  AND p.notif_email_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM user_email_prefs uep
    WHERE uep.user_id = p.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Log the backfill count for verification
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_email_prefs;
  RAISE NOTICE 'user_email_prefs now has % records after backfill', v_count;
END $$;
