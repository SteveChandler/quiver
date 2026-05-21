BEGIN;

WITH photo_candidate (
  slug,
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
    'marine-street-beach',
    'CA',
    'File:San Diego La Jolla Marine Street Beach.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9d/San_Diego_La_Jolla_Marine_Street_Beach.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/San_Diego_La_Jolla_Marine_Street_Beach.jpg/1280px-San_Diego_La_Jolla_Marine_Street_Beach.jpg',
    'San Diego - La Jolla, Marine Street Beach',
    'JiriMatejicek',
    'https://commons.wikimedia.org/wiki/User:JiriMatejicek',
    'CC BY-SA 4.0',
    'https://creativecommons.org/licenses/by-sa/4.0',
    'Photo by JiriMatejicek, licensed CC BY-SA 4.0 via Wikimedia Commons.'
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
