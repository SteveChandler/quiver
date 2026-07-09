-- Upsert approved Jersey Shore camera sources discovered during Costa Viva review.
-- Costa Viva is used only as a discovery source; stored URLs point to public
-- provider embeds, provider pages, or YouTube watch URLs. Existing non-empty
-- camera URLs are not overwritten unless they already equal the proposed URL.

BEGIN;

WITH cam_updates (
  slug,
  city,
  state,
  camera_url,
  thumbnail_url,
  youtube_channel_handle,
  youtube_stream_title_hint
) AS (
  VALUES
    (
      'sandy-hook-sandy-hook-nj',
      'Sandy Hook',
      'NJ',
      'https://www.youtube.com/watch?v=IDITVhzT9hM',
      'https://img.youtube.com/vi/IDITVhzT9hM/hqdefault.jpg',
      NULL,
      'Bahrs Landing Highlands NJ waterfront / Sandy Hook'
    ),
    (
      'asbury-park-asbury-park-nj',
      'Asbury Park',
      'NJ',
      'https://v.angelcam.com/iframe?v=oxrndg4dl8&autoplay=1',
      NULL,
      NULL,
      NULL
    ),
    (
      'long-branch-long-branch-nj',
      'Long Branch',
      'NJ',
      'https://www.youtube.com/watch?v=4ICZWsqnuP8',
      'https://img.youtube.com/vi/4ICZWsqnuP8/hqdefault.jpg',
      NULL,
      'Promenade Beach Club live stream'
    ),
    (
      'belmar-belmar-nj',
      'Belmar',
      'NJ',
      'https://www.youtube.com/watch?v=Brz7t3AQaGQ',
      'https://img.youtube.com/vi/Brz7t3AQaGQ/hqdefault.jpg',
      NULL,
      'Live Beach Cam: Belmar, New Jersey'
    ),
    (
      'kook-bay-spring-lake-nj',
      'Spring Lake',
      'NJ',
      'https://www.youtube.com/watch?v=pf-Qrjm1__Y',
      'https://img.youtube.com/vi/pf-Qrjm1__Y/hqdefault.jpg',
      NULL,
      'Live Beach Cam: Spring Lake, New Jersey'
    )
)
INSERT INTO public.beach_sources (
  beach_id,
  camera_url,
  thumbnail_url,
  youtube_channel_handle,
  youtube_stream_title_hint
)
SELECT
  b.id,
  cam_updates.camera_url,
  cam_updates.thumbnail_url,
  cam_updates.youtube_channel_handle,
  cam_updates.youtube_stream_title_hint
FROM cam_updates
JOIN public.beaches AS b
  ON b.slug = cam_updates.slug
  AND b.city = cam_updates.city
  AND b.state = cam_updates.state
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id)
DO UPDATE SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = COALESCE(NULLIF(public.beach_sources.thumbnail_url, ''), EXCLUDED.thumbnail_url),
  youtube_channel_handle = COALESCE(NULLIF(public.beach_sources.youtube_channel_handle, ''), EXCLUDED.youtube_channel_handle),
  youtube_stream_title_hint = COALESCE(NULLIF(public.beach_sources.youtube_stream_title_hint, ''), EXCLUDED.youtube_stream_title_hint)
WHERE public.beach_sources.camera_url IS NULL
   OR public.beach_sources.camera_url = ''
   OR public.beach_sources.camera_url = EXCLUDED.camera_url;

COMMIT;
