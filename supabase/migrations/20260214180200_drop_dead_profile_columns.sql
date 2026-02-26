BEGIN;
-- Drop dependent view first (will be recreated without the dead columns)
DROP VIEW IF EXISTS profiles_with_home_beach;
-- Drop FK constraint first
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_favorite_spot_id_fkey;
-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS favorite_spot;
ALTER TABLE profiles DROP COLUMN IF EXISTS favorite_spot_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_beach_ids;
ALTER TABLE profiles DROP COLUMN IF EXISTS secondary_beaches;
-- Recreate view without the dropped columns
CREATE OR REPLACE VIEW profiles_with_home_beach WITH (security_invoker = true) AS
SELECT
  p.*,
  b.name AS home_beach_name,
  b.slug AS home_beach_slug
FROM profiles p
LEFT JOIN beaches b ON p.home_beach_id = b.id;
COMMIT;
