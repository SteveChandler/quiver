-- Backfill display_name for all NPC profiles that only have full_name set
BEGIN;
UPDATE profiles
SET display_name = full_name
WHERE is_mock = true AND display_name IS NULL AND full_name IS NOT NULL;
COMMIT;
