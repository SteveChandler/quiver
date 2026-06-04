BEGIN;

-- Use the official Surfline widgets published on Scripps' Pier Cam page so
-- La Jolla Shores and Scripps no longer share the same roaming overlook cam.
WITH cam_updates(slug, camera_url, thumbnail_url) AS (
  VALUES
    (
      'la-jolla-shores',
      'https://embed.cdn-surfline.com/cams/58349b9b3421b20545c4b54d/199ae31e65bf748a7c7d928332998440490cd979',
      'https://camstills.cdn-surfline.com/58349b9b3421b20545c4b54d/latest_small.jpg'
    ),
    (
      'scripps',
      'https://embed.cdn-surfline.com/cams/5834a0733421b20545c4b584/64ba68ebf1c960a93d1faba8f86cc16a3ed05913',
      'https://camstills.cdn-surfline.com/5834a0733421b20545c4b584/latest_small.jpg'
    )
)
INSERT INTO public.beach_sources (beach_id, camera_url, thumbnail_url)
SELECT b.id, cam_updates.camera_url, cam_updates.thumbnail_url
FROM cam_updates
JOIN public.beaches b ON b.slug = cam_updates.slug
ON CONFLICT (beach_id) DO UPDATE
SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = EXCLUDED.thumbnail_url;

COMMIT;
