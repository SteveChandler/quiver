BEGIN;

WITH cam_updates(
  slug,
  camera_url,
  thumbnail_url,
  youtube_channel_handle,
  youtube_stream_title_hint
) AS (
  VALUES
    (
      'ocean-beach',
      'https://www.obhotel.com/Webcam-Oceanbeach.php',
      NULL,
      NULL,
      NULL
    ),
    (
      'san-clemente-state-beach',
      'https://www.youtube.com/watch?v=2c7NV66YzKA',
      'https://img.youtube.com/vi/2c7NV66YzKA/hqdefault.jpg',
      '@CityofSanClementeVideos',
      'San Clemente Beach Camera'
    ),
    (
      '204s',
      'https://www.youtube.com/watch?v=2c7NV66YzKA',
      'https://img.youtube.com/vi/2c7NV66YzKA/hqdefault.jpg',
      '@CityofSanClementeVideos',
      'San Clemente Beach Camera'
    ),
    (
      'cottons',
      'https://www.youtube.com/watch?v=2c7NV66YzKA',
      'https://img.youtube.com/vi/2c7NV66YzKA/hqdefault.jpg',
      '@CityofSanClementeVideos',
      'San Clemente Beach Camera'
    ),
    (
      'huntington-beach-pier',
      'https://www.youtube.com/watch?v=mhQjsLBfOoY',
      'https://img.youtube.com/vi/mhQjsLBfOoY/hqdefault.jpg',
      '@cityofhb',
      'View from Huntington Beach Pier'
    ),
    (
      'huntington-beach-pier-northside',
      'https://www.youtube.com/watch?v=mhQjsLBfOoY',
      'https://img.youtube.com/vi/mhQjsLBfOoY/hqdefault.jpg',
      '@cityofhb',
      'View from Huntington Beach Pier'
    ),
    (
      'huntington-beach-pier-southside',
      'https://www.youtube.com/watch?v=mhQjsLBfOoY',
      'https://img.youtube.com/vi/mhQjsLBfOoY/hqdefault.jpg',
      '@cityofhb',
      'View from Huntington Beach Pier'
    ),
    (
      'goldenwest',
      'https://www.youtube.com/watch?v=mhQjsLBfOoY',
      'https://img.youtube.com/vi/mhQjsLBfOoY/hqdefault.jpg',
      '@cityofhb',
      'View from Huntington Beach Pier'
    ),
    (
      'huntington-state-beach',
      'https://www.youtube.com/watch?v=mhQjsLBfOoY',
      'https://img.youtube.com/vi/mhQjsLBfOoY/hqdefault.jpg',
      '@cityofhb',
      'View from Huntington Beach Pier'
    ),
    (
      'del-mar',
      'https://hdontap.com/stream/399483/del-mar-beach-south-roaming-live-webcam/',
      'https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb6lo_hdontap_17th_st-delmar-4k-ptz.stream.jpg',
      NULL,
      NULL
    ),
    (
      'del-mar-rivermouth',
      'https://hdontap.com/stream/399483/del-mar-beach-south-roaming-live-webcam/',
      'https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb6lo_hdontap_17th_st-delmar-4k-ptz.stream.jpg',
      NULL,
      NULL
    ),
    (
      'torrey-pines-state-beach',
      'https://hdontap.com/stream/399483/del-mar-beach-south-roaming-live-webcam/',
      'https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb6lo_hdontap_17th_st-delmar-4k-ptz.stream.jpg',
      NULL,
      NULL
    ),
    (
      'la-jolla-shores',
      'https://hdontap.com/stream/532541/la-jolla-shores-live-surf-cam/',
      'https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb1_hdontap-la_jolla_shores_surf.stream.jpg',
      NULL,
      NULL
    ),
    (
      'blackies',
      'https://g1.ipcamlive.com/player/player.php?alias=blackiessurfcam2&skin=white',
      NULL,
      NULL,
      NULL
    ),
    (
      '8th-avenue-jetty-belmar-nj',
      'https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/',
      NULL,
      NULL,
      NULL
    ),
    (
      'long-beach-long-beach-ny',
      'https://thesurfersview.com/live-cams/new-york/long-beach-ny-skudin-surf-cam/',
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
JOIN public.beaches b ON b.slug = cam_updates.slug
ON CONFLICT (beach_id) DO UPDATE
SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  youtube_channel_handle = EXCLUDED.youtube_channel_handle,
  youtube_stream_title_hint = EXCLUDED.youtube_stream_title_hint
WHERE public.beach_sources.camera_url IS NULL
   OR public.beach_sources.camera_url = ''
   OR public.beach_sources.camera_url = EXCLUDED.camera_url
   OR public.beach_sources.camera_url IN (
     'https://embed.cdn-surfline.com/cams/58349b9b3421b20545c4b54d/199ae31e65bf748a7c7d928332998440490cd979'
   );

COMMIT;
