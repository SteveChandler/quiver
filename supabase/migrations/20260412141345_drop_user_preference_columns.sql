BEGIN;

-- Drop partial indexes first
DROP INDEX IF EXISTS idx_profiles_wave_size;
DROP INDEX IF EXISTS idx_profiles_break_type;
DROP INDEX IF EXISTS idx_profiles_crowd_preference;

-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_wave_size;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_break_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS crowd_preference;

COMMIT;
