-- Rollback Migration: Fix invalid experience_level values
-- Date: 2025-11-17
--
-- This rollback removes the constraint but does NOT restore invalid values
-- because we don't know which NULL values were originally invalid.
--
-- If you need to restore the exact state, you would need to:
-- 1. Restore from a backup
-- 2. Or manually update specific profile IDs if known

-- Remove the constraint that was added
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS experience_level_check;

-- Note: Cannot reliably restore invalid values without backup data
-- The following profiles had INVALID experience_level values before migration:
--   - 2 profiles with empty strings ("")
--   - 1 profile with "Advanced" (should be lowercase "advanced")
--
-- To restore manually (not recommended):
-- UPDATE public.profiles
-- SET experience_level = ''
-- WHERE id IN ('<profile-id-1>', '<profile-id-2>');
--
-- UPDATE public.profiles
-- SET experience_level = 'Advanced'
-- WHERE id = '<profile-id-3>';
