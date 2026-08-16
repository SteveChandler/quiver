BEGIN;

-- Camera embeds approved for Quiver. Bob Hall and Mustang Island use nearby
-- shoreline cameras whose fields of view cover representative local conditions.
WITH cam_updates(
  slug,
  camera_url,
  thumbnail_url,
  youtube_channel_handle,
  youtube_stream_title_hint
) AS (
  VALUES
    (
      'galveston-61st-street-pier-galveston-tx',
      'https://relay.ozolio.com/pub.api?cmd=embed&oid=EMB_CTOK0000018D',
      NULL,
      NULL,
      NULL
    ),
    (
      'galveston-pleasure-pier-galveston-tx',
      'https://v.angelcam.com/iframe?v=4oxyn1pr8v&autoplay=1',
      NULL,
      NULL,
      NULL
    ),
    (
      'packery-channel-jetties-corpus-christi-tx',
      'https://www.youtube.com/watch?v=81CHMT174Vk',
      'https://img.youtube.com/vi/81CHMT174Vk/hqdefault.jpg',
      '@packerysurfcam',
      'Packery Surf Cam'
    ),
    (
      'bob-hall-pier-corpus-christi-tx',
      'https://relay.ozolio.com/pub.cgi?cmd=iframe&oid=CID_XCLW000002D1&app_mode=view&disp_name=Whitecap+Beach&disp_desc=Whitecap+beach+towards+Bob+Hall+pier',
      NULL,
      NULL,
      NULL
    ),
    (
      'mustang-island-state-park-corpus-christi-tx',
      'https://www.youtube.com/watch?v=5WgzklycfO4',
      'https://img.youtube.com/vi/5WgzklycfO4/hqdefault.jpg',
      '@gulfwatersofficestaff',
      'Boardwalk Cam'
    ),
    (
      'padre-island-national-seashore-south-beach-corpus-christi-tx',
      'https://www.nps.gov/webcams-pais/camera.jpg',
      'https://www.nps.gov/webcams-pais/camera.jpg',
      NULL,
      NULL
    ),
    (
      'crystal-beach-crystal-beach-tx',
      'https://player.brownrice.com/embed/coastalsurfcam',
      NULL,
      NULL,
      NULL
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
  AND b.state = 'TX'
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id)
DO UPDATE SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  youtube_channel_handle = EXCLUDED.youtube_channel_handle,
  youtube_stream_title_hint = EXCLUDED.youtube_stream_title_hint
WHERE public.beach_sources.camera_url IS NULL
   OR public.beach_sources.camera_url = ''
   OR public.beach_sources.camera_url = EXCLUDED.camera_url;

-- Exact-location images with licenses that permit commercial reuse.
WITH photo_candidates(
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
      'galveston-61st-street-pier-galveston-tx',
      'File:Galveston''s 61 Street Fishing Pier.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/f/f2/Galveston%27s_61_Street_Fishing_Pier.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Galveston%27s_61_Street_Fishing_Pier.jpg/1280px-Galveston%27s_61_Street_Fishing_Pier.jpg',
      'Galveston''s 61st Street Fishing Pier',
      'Jim Evans',
      'https://commons.wikimedia.org/wiki/User:Jim_Evans',
      'CC BY-SA 4.0',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'Photo by Jim Evans, licensed CC BY-SA 4.0 via Wikimedia Commons.'
    ),
    (
      'galveston-pleasure-pier-galveston-tx',
      'File:Pleasure Pier in Galveston, Texas.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/0/08/Pleasure_Pier_in_Galveston%2C_Texas.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Pleasure_Pier_in_Galveston%2C_Texas.jpg/1280px-Pleasure_Pier_in_Galveston%2C_Texas.jpg',
      'Pleasure Pier in Galveston, Texas',
      'Matthew T Rader',
      'https://matthewtrader.com',
      'CC BY-SA 4.0',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'Photo by Matthew T Rader, licensed CC BY-SA 4.0 via Wikimedia Commons.'
    ),
    (
      'bob-hall-pier-corpus-christi-tx',
      'File:Bob Hall Pier on South Padre Island.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/7/7f/Bob_Hall_Pier_on_South_Padre_Island.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Bob_Hall_Pier_on_South_Padre_Island.jpg/1280px-Bob_Hall_Pier_on_South_Padre_Island.jpg',
      'Bob Hall Pier at Padre Balli Park',
      'Matthew T Rader',
      'https://matthewtrader.com',
      'CC BY-SA 4.0',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'Photo by Matthew T Rader, licensed CC BY-SA 4.0 via Wikimedia Commons.'
    ),
    (
      'mustang-island-state-park-corpus-christi-tx',
      'File:Mustang Island State Park, the beach, Nueces Co. TX; 22 Apr 2025.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/2/2c/Mustang_Island_State_Park%2C_the_beach%2C_Nueces_Co._TX%3B_22_Apr_2025.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Mustang_Island_State_Park%2C_the_beach%2C_Nueces_Co._TX%3B_22_Apr_2025.jpg/1280px-Mustang_Island_State_Park%2C_the_beach%2C_Nueces_Co._TX%3B_22_Apr_2025.jpg',
      'Mustang Island State Park beach',
      'William L. Farr',
      'https://commons.wikimedia.org/wiki/User:Wilafa',
      'CC BY 4.0',
      'https://creativecommons.org/licenses/by/4.0/',
      'Photo by William L. Farr, licensed CC BY 4.0 via Wikimedia Commons.'
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
  AND b.state = 'TX'
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
