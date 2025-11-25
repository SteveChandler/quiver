-- Migration: cleanup_excess_beach_photos
-- Purpose: Delete excess beach photos, keeping only the 5 most recent per beach
-- This reduces rate limit issues on the image proxy

-- Delete photos that are not in the top 5 most recent per beach
DELETE FROM beach_photos
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY beach_id
      ORDER BY fetched_at DESC
    ) as rn
    FROM beach_photos
  ) ranked
  WHERE rn <= 5
);

-- Log how many photos remain per beach (for verification)
DO $$
DECLARE
  photo_count INTEGER;
  beach_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT beach_id)
  INTO photo_count, beach_count
  FROM beach_photos;

  RAISE NOTICE 'Beach photos cleanup complete: % photos across % beaches', photo_count, beach_count;
END $$;
