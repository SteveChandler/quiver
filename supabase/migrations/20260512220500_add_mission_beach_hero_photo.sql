BEGIN;

WITH photo_candidate (
  slug,
  city,
  state,
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
  VALUES (
    'mission-beach',
    'San Diego',
    'CA',
    'File:Mission Beach-San Diego-California.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/4/4c/Mission_Beach-San_Diego-California.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Mission_Beach-San_Diego-California.jpg/1280px-Mission_Beach-San_Diego-California.jpg',
    'Mission Beach, San Diego, California',
    'Vlastula',
    'https://en.wikipedia.org/wiki/User:Vlastula',
    'Public domain',
    'https://commons.wikimedia.org/wiki/File:Mission_Beach-San_Diego-California.jpg#Licensing',
    'Photo by Vlastula, public domain via Wikimedia Commons.'
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
FROM photo_candidate AS photo
JOIN public.beaches AS b
  ON b.slug = photo.slug
  AND b.city = photo.city
  AND b.state = photo.state
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
