-- Migration: Add Personalization Preferences
-- Description: Add explicit preference fields for personalized recommendations
-- Author: supabase-db-expert
-- Date: 2025-01-03
-- Issue: Part of personalization strategy to deliver tailored surf forecasts

-- Add preferred wave size preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_wave_size TEXT
  CHECK (preferred_wave_size IN ('small', 'medium', 'large', 'any'));

-- Add preferred break type preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_break_type TEXT
  CHECK (preferred_break_type IN ('beach', 'point', 'reef', 'any'));

-- Add crowd preference for social/solitude balance
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crowd_preference TEXT
  CHECK (crowd_preference IN ('social', 'moderate', 'solitude'));

-- Add indexes for preference-based queries (used in recommendation engine)
CREATE INDEX IF NOT EXISTS idx_profiles_wave_size
  ON profiles(preferred_wave_size)
  WHERE preferred_wave_size IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_break_type
  ON profiles(preferred_break_type)
  WHERE preferred_break_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_crowd_preference
  ON profiles(crowd_preference)
  WHERE crowd_preference IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN profiles.preferred_wave_size IS 'Explicit wave size preference from onboarding: small (1-3ft), medium (3-6ft), large (6ft+), or any';
COMMENT ON COLUMN profiles.preferred_break_type IS 'Explicit break type preference: beach (sand bottom), point (long wrapping waves), reef (coral/rock), or any';
COMMENT ON COLUMN profiles.crowd_preference IS 'Social preference: social (love the crew), moderate (few people OK), solitude (dawn patrol vibes)';

-- RLS Note: Existing profiles RLS policies automatically cover these new columns
-- No policy changes needed:
--   - Users can read all profiles (public data)
--   - Users can only update their own profile
