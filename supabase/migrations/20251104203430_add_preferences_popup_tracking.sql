-- Migration: Add preferences v2 announcement popup tracking
-- Purpose: Track when users have seen the new preferences announcement popup
-- Created: 2025-11-04

-- ============================================================================
-- SCHEMA CHANGES
-- ============================================================================

-- Add column to track when the preferences v2 announcement popup was shown
-- NULL value indicates the popup has not been shown yet
-- Once shown, the timestamp is recorded
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences_v2_shown_at TIMESTAMPTZ DEFAULT NULL;

-- Add descriptive comment for the column
COMMENT ON COLUMN public.profiles.preferences_v2_shown_at IS
  'Timestamp when the preferences v2 announcement popup was displayed to the user. NULL indicates the popup has not been shown yet.';

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Create index for efficient queries checking if popup should be shown
-- This index will be used when querying for users who haven't seen the popup
-- The partial index (WHERE preferences_v2_shown_at IS NULL) keeps the index small
-- by only indexing users who haven't seen the popup yet
CREATE INDEX IF NOT EXISTS idx_profiles_preferences_v2_shown
  ON public.profiles (preferences_v2_shown_at)
  WHERE preferences_v2_shown_at IS NULL;

-- Add comment explaining the index purpose
COMMENT ON INDEX idx_profiles_preferences_v2_shown IS
  'Partial index to efficiently find users who have not yet seen the preferences v2 announcement popup.';

-- ============================================================================
-- NOTES
-- ============================================================================

-- Display Logic:
-- The popup should be shown when:
--   1. preferences_v2_shown_at IS NULL (not shown yet)
--   2. AND onboarding_completed_at IS NOT NULL (onboarding completed)
--
-- After the user sees/dismisses the popup, update:
--   UPDATE profiles SET preferences_v2_shown_at = NOW() WHERE id = auth.uid();

-- Data Migration:
-- No data migration needed. All existing users will have NULL by default,
-- which is the desired state (they haven't seen the new popup yet).

-- RLS Policies:
-- No RLS policy changes needed. The existing user update policy
-- (user_can_update_own_onboarding) already allows users to update
-- their own profile fields, including this new timestamp field.

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================

-- To rollback this migration, run:
--
-- -- Drop the index
-- DROP INDEX IF EXISTS public.idx_profiles_preferences_v2_shown;
--
-- -- Remove the column
-- ALTER TABLE public.profiles
--   DROP COLUMN IF EXISTS preferences_v2_shown_at;
