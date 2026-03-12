BEGIN;

-- Drop the existing inline CHECK constraint on beach_photos.source
-- (auto-named by PostgreSQL as {table}_{column}_check)
ALTER TABLE public.beach_photos
  DROP CONSTRAINT IF EXISTS beach_photos_source_check;

-- Re-create with 'google_places' added to the allowed values
ALTER TABLE public.beach_photos
  ADD CONSTRAINT beach_photos_source_check
  CHECK (source IN ('openverse', 'flickr', 'unsplash', 'pexels', 'wikimedia', 'user', 'google_places'));

COMMIT;
