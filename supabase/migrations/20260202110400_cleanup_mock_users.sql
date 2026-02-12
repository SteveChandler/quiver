-- Migration: Remove Mock Users from Production
-- Impact: ~26 mock users polluting analytics
-- Priority: P2 (Medium)
--
-- Mock users are identified by:
-- - is_mock = true flag
-- - @example.invalid email domain
-- - Test emails like testuser@quiver.surf

BEGIN;

-- Enable destructive operations for this transaction (required for DELETE on profiles)
SET LOCAL app.allow_destructive = 'on';

-- Backup mock users before deletion
CREATE TABLE IF NOT EXISTS _backup_mock_profiles_20260202 AS
SELECT *
FROM profiles
WHERE is_mock = true
   OR email LIKE '%@example.invalid'
   OR email IN ('testuser@quiver.surf', 'test-referrer@quiver.surf');

-- Create a temporary table of mock user IDs for efficient lookups
CREATE TEMP TABLE mock_user_ids AS
SELECT id FROM profiles
WHERE is_mock = true
   OR email LIKE '%@example.invalid'
   OR email IN ('testuser@quiver.surf', 'test-referrer@quiver.surf');

-- Delete data from all tables that reference profiles
-- Order matters due to foreign key constraints

-- 1. Session-related tables (delete sessions first, then related)
DELETE FROM session_likes WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM session_shares WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM session_media WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM session_forecast_snapshots WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM session_invitations WHERE inviter_id IN (SELECT id FROM mock_user_ids) OR invitee_id IN (SELECT id FROM mock_user_ids);
DELETE FROM sessions WHERE user_id IN (SELECT id FROM mock_user_ids);

-- 2. Intel-related tables
DELETE FROM intel_post_confirmations WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM intel_posts WHERE user_id IN (SELECT id FROM mock_user_ids);

-- 3. Beach-related tables
DELETE FROM beach_review_likes WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM beach_reviews WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM favorite_beaches WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM forecast_accuracy_votes WHERE user_id IN (SELECT id FROM mock_user_ids);
-- Set beaches owned by mock users to NULL (don't delete beaches)
UPDATE beaches SET owner_id = NULL WHERE owner_id IN (SELECT id FROM mock_user_ids);

-- 4. Social tables
DELETE FROM user_follows WHERE follower_id IN (SELECT id FROM mock_user_ids) OR following_id IN (SELECT id FROM mock_user_ids);
DELETE FROM comments WHERE user_id IN (SELECT id FROM mock_user_ids);
DELETE FROM referrals WHERE referrer_id IN (SELECT id FROM mock_user_ids) OR referee_id IN (SELECT id FROM mock_user_ids);

-- 5. User activity and device tables
DELETE FROM user_activities WHERE user_id IN (SELECT id FROM mock_user_ids);
-- push_devices was dropped in 20260124130000_consolidate_push_device_tables.sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_devices') THEN
    DELETE FROM push_devices WHERE user_id IN (SELECT id FROM mock_user_ids);
  END IF;
END $$;
DELETE FROM storage_usage WHERE user_id IN (SELECT id FROM mock_user_ids);

-- 6. History/audit tables (set changed_by to NULL instead of deleting history)
UPDATE admin_audit_log SET admin_user_id = NULL WHERE admin_user_id IN (SELECT id FROM mock_user_ids);
UPDATE beach_photos_history SET changed_by = NULL WHERE changed_by IN (SELECT id FROM mock_user_ids);
UPDATE beach_reviews_history SET changed_by = NULL WHERE changed_by IN (SELECT id FROM mock_user_ids);
UPDATE beaches_history SET changed_by = NULL WHERE changed_by IN (SELECT id FROM mock_user_ids);
UPDATE session_media_history SET changed_by = NULL WHERE changed_by IN (SELECT id FROM mock_user_ids);
UPDATE sessions_history SET changed_by = NULL WHERE changed_by IN (SELECT id FROM mock_user_ids);

-- 7. Finally, delete the mock profiles themselves
DELETE FROM profiles WHERE id IN (SELECT id FROM mock_user_ids);

-- Clean up temp table
DROP TABLE mock_user_ids;

COMMIT;

-- Verification query:
-- SELECT COUNT(*) FROM profiles WHERE is_mock = true OR email LIKE '%@example.invalid';
-- Should return 0

-- Note: Auth users in auth.users table may also need cleanup via Supabase dashboard
-- This migration only cleans the public.profiles table and related data

-- Rollback procedure:
-- This is a destructive migration. Full rollback requires restoring from backup.
-- Partial rollback (restore profiles only):
-- BEGIN;
-- INSERT INTO profiles SELECT * FROM _backup_mock_profiles_20260202
-- ON CONFLICT (id) DO NOTHING;
-- DROP TABLE _backup_mock_profiles_20260202;
-- COMMIT;
-- Note: Related data (sessions, reviews, etc.) cannot be restored without separate backups.
