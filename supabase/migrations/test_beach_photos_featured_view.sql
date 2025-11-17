-- Test queries for beach_photos_featured view migration
-- These queries can be run manually to verify the migration works correctly

-- 1. Check if beach_photos table has deleted_at column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'beach_photos'
  AND column_name = 'deleted_at';

-- 2. Count total approved photos vs non-deleted approved photos
SELECT
  'Total approved photos' as category,
  COUNT(*) as count
FROM public.beach_photos
WHERE approved = true

UNION ALL

SELECT
  'Non-deleted approved photos' as category,
  COUNT(*) as count
FROM public.beach_photos
WHERE approved = true
  AND deleted_at IS NULL;

-- 3. Check if any deleted photos would be excluded from the view
SELECT
  beach_id,
  image_url,
  deleted_at,
  approved
FROM public.beach_photos
WHERE approved = true
  AND deleted_at IS NOT NULL
ORDER BY beach_id, fetched_at DESC
LIMIT 10;

-- 4. Compare view results before and after migration
-- (Run this BEFORE applying the migration)
SELECT 'Before migration' as label, COUNT(*) as featured_count
FROM public.beach_photos_featured;

-- 5. Verify view definition after migration
SELECT pg_get_viewdef('public.beach_photos_featured'::regclass, true);

-- 6. Test the updated view returns expected results
-- (Run this AFTER applying the migration)
SELECT
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM public.beach_photos_featured
ORDER BY beach_id
LIMIT 10;

-- 7. Verify no deleted photos appear in the view
-- (Should return 0 rows)
SELECT f.beach_id, p.deleted_at
FROM public.beach_photos_featured f
JOIN public.beach_photos p ON f.beach_id = p.beach_id
  AND f.image_url = p.image_url
WHERE p.deleted_at IS NOT NULL;
