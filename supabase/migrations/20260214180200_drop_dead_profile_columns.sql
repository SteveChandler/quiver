BEGIN;
-- Drop FK constraint first
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_favorite_spot_id_fkey;
-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS favorite_spot;
ALTER TABLE profiles DROP COLUMN IF EXISTS favorite_spot_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_beach_ids;
ALTER TABLE profiles DROP COLUMN IF EXISTS secondary_beaches;
COMMIT;
