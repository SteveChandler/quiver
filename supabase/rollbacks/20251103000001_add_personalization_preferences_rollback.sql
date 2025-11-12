-- Rollback Migration: Add Personalization Preferences
-- Description: Rollback for 20250103000001_add_personalization_preferences.sql
-- Warning: This will delete all preference data

-- Drop indexes first
DROP INDEX IF EXISTS idx_profiles_crowd_preference;
DROP INDEX IF EXISTS idx_profiles_break_type;
DROP INDEX IF EXISTS idx_profiles_wave_size;

-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS crowd_preference;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_break_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_wave_size;
