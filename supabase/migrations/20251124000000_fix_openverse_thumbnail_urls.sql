-- Migration: Fix Openverse Thumbnail URLs
-- Description: Remove ?format=json suffix from beach_photos.thumb_url column
-- 
-- The Openverse API sometimes returns thumbnail URLs with ?format=json appended,
-- which causes 400 errors when passed through Next.js Image Optimization because
-- the endpoint returns JSON metadata instead of an actual image.
--
-- Example bad URL:
--   https://api.openverse.org/v1/images/{id}/thumb/?format=json
-- Correct URL:
--   https://api.openverse.org/v1/images/{id}/thumb/

BEGIN;

-- Count affected rows before update (for logging)
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM beach_photos
  WHERE thumb_url LIKE '%?format=json';
  
  RAISE NOTICE 'Found % beach_photos rows with ?format=json in thumb_url', affected_count;
END $$;

-- Remove ?format=json from all affected thumb_url values
UPDATE beach_photos
SET thumb_url = REPLACE(thumb_url, '?format=json', '')
WHERE thumb_url LIKE '%?format=json';

-- Verify the fix
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM beach_photos
  WHERE thumb_url LIKE '%?format=json';
  
  IF remaining_count > 0 THEN
    RAISE WARNING 'Still have % rows with ?format=json - may need manual review', remaining_count;
  ELSE
    RAISE NOTICE 'Successfully cleaned all ?format=json suffixes from thumb_url';
  END IF;
END $$;

COMMIT;

