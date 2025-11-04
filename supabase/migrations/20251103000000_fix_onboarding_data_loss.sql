-- Migration: Fix Onboarding Data Loss
-- Description: Add display_name and surf_styles columns that onboarding already expects
-- Author: supabase-db-expert
-- Date: 2025-01-03
-- Issue: Onboarding code attempts to save these fields but columns don't exist

-- Add display_name column (unique username for social features)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add surf_styles column (array of surf styles: longboard, shortboard, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS surf_styles TEXT[];

-- Create unique constraint on display_name (like username)
-- Only applies where display_name is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name
  ON profiles(display_name)
  WHERE display_name IS NOT NULL;

-- Add index for surf_styles queries (GIN index for array containment queries)
CREATE INDEX IF NOT EXISTS idx_profiles_surf_styles
  ON profiles USING GIN(surf_styles)
  WHERE surf_styles IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN profiles.display_name IS 'Unique username for social features (previously collected but not saved due to missing column)';
COMMENT ON COLUMN profiles.surf_styles IS 'Array of surf styles: longboard, shortboard, bodyboard, etc. (previously collected but not saved due to missing column)';

-- RLS Note: Existing profiles RLS policies automatically cover these new columns
-- No policy changes needed:
--   - Users can read all profiles (public data)
--   - Users can only update their own profile
