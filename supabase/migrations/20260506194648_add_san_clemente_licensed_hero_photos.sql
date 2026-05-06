BEGIN;

WITH photo_candidates (
  slug,
  source_id,
  image_url,
  thumb_url,
  title,
  creator_name,
  creator_url,
  license_code,
  license_url,
  attribution_html
) AS (
  VALUES
    (
      'church',
      'File:Trestles lifeguard tower.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/a/a0/Trestles_lifeguard_tower.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Trestles_lifeguard_tower.jpg/1280px-Trestles_lifeguard_tower.jpg',
      'Trestles lifeguard tower',
      'Sewageboy',
      'https://commons.wikimedia.org/wiki/User:Sewageboy',
      'CC BY-SA 4.0',
      'https://creativecommons.org/licenses/by-sa/4.0',
      'Photo by Sewageboy, licensed CC BY-SA 4.0 via Wikimedia Commons.'
    ),
    (
      'riviera',
      'File:Surfer in San Clemente CA (Unsplash).jpg',
      'https://upload.wikimedia.org/wikipedia/commons/7/77/Surfer_in_San_Clemente_CA_%28Unsplash%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Surfer_in_San_Clemente_CA_%28Unsplash%29.jpg/1280px-Surfer_in_San_Clemente_CA_%28Unsplash%29.jpg',
      'Surfer in San Clemente CA',
      'Jeremy Bishop',
      'https://unsplash.com/@tidesinourveins',
      'CC0',
      'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
      'Photo by Jeremy Bishop, public domain CC0 via Wikimedia Commons.'
    )
)
INSERT INTO public.beach_photos (
  beach_id,
  source,
  source_id,
  image_url,
  thumb_url,
  title,
  creator_name,
  creator_url,
  license_code,
  license_url,
  attribution_html,
  approved,
  deleted_at
)
SELECT
  b.id,
  'wikimedia',
  photo.source_id,
  photo.image_url,
  photo.thumb_url,
  photo.title,
  photo.creator_name,
  photo.creator_url,
  photo.license_code,
  photo.license_url,
  photo.attribution_html,
  true,
  NULL::timestamptz
FROM photo_candidates AS photo
JOIN public.beaches AS b
  ON b.slug = photo.slug
 AND b.deleted_at IS NULL
ON CONFLICT (beach_id, source, source_id)
DO UPDATE SET
  image_url = EXCLUDED.image_url,
  thumb_url = EXCLUDED.thumb_url,
  title = EXCLUDED.title,
  creator_name = EXCLUDED.creator_name,
  creator_url = EXCLUDED.creator_url,
  license_code = EXCLUDED.license_code,
  license_url = EXCLUDED.license_url,
  attribution_html = EXCLUDED.attribution_html,
  approved = true,
  deleted_at = NULL,
  fetched_at = now();

COMMIT;
