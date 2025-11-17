-- Migration: Exclude soft-deleted photos from beach_photos_featured view
-- Created: 2025-11-17
-- Description: Updates the beach_photos_featured view to filter out photos with deleted_at timestamp
--
-- Context:
-- The beach_photos_featured view was created in migration 20251020093001 but didn't
-- exclude soft-deleted photos. This creates inconsistency with API endpoints that
-- properly filter deleted photos.
--
-- Changes:
-- - Adds AND deleted_at IS NULL condition to the WHERE clause
-- - Ensures only active, approved photos appear in the featured view
--
-- Rollback:
-- To rollback this migration, restore the previous view definition:
--
-- CREATE OR REPLACE VIEW public.beach_photos_featured AS
-- SELECT DISTINCT ON (beach_id)
--   beach_id,
--   image_url,
--   thumb_url,
--   attribution_html
-- FROM public.beach_photos
-- WHERE approved = true
-- ORDER BY beach_id, fetched_at DESC;

-- Update the view to exclude soft-deleted photos
CREATE OR REPLACE VIEW public.beach_photos_featured AS
SELECT DISTINCT ON (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM public.beach_photos
WHERE approved = true
  AND deleted_at IS NULL  -- Exclude soft-deleted photos
ORDER BY beach_id, fetched_at DESC;

-- Add comment to document the view's purpose
COMMENT ON VIEW public.beach_photos_featured IS
'Returns the most recent approved, non-deleted photo for each beach. Used for featured images in listings and search results.';
