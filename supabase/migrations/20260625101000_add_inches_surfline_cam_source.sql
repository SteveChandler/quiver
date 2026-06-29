-- Add approved Surfline cam link for Inches.

BEGIN;

WITH cam_updates (
  slug,
  city,
  state,
  camera_url,
  thumbnail_url
) AS (
  VALUES
    (
      'inches-patillas-pr',
      'Patillas',
      'PR',
      'https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8',
      'https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg'
    )
)
INSERT INTO public.beach_sources (
  beach_id,
  camera_url,
  thumbnail_url
)
SELECT
  b.id,
  cam_updates.camera_url,
  cam_updates.thumbnail_url
FROM cam_updates
JOIN public.beaches AS b
  ON b.slug = cam_updates.slug
  AND b.city = cam_updates.city
  AND b.state = cam_updates.state
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id)
DO UPDATE SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = COALESCE(NULLIF(public.beach_sources.thumbnail_url, ''), EXCLUDED.thumbnail_url)
WHERE public.beach_sources.camera_url IS NULL
   OR public.beach_sources.camera_url = ''
   OR public.beach_sources.camera_url = EXCLUDED.camera_url
   OR public.beach_sources.camera_url = 'https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67'
   OR public.beach_sources.camera_url ILIKE '%click2stream%'
   OR public.beach_sources.camera_url ILIKE '%comoestaeso%';

UPDATE public.beaches
SET real_takeaways = array_replace(
  real_takeaways,
  'No validated public live camera found',
  'Approved Surfline cam link available'
)
WHERE slug = 'inches-patillas-pr'
  AND city = 'Patillas'
  AND state = 'PR'
  AND deleted_at IS NULL
  AND real_takeaways @> ARRAY['No validated public live camera found']::text[];

COMMIT;
