INSERT INTO beach_sources (beach_id, camera_url)
SELECT
  b.id,
  'https://beachcam.pelicanbrewing.com/stream/53e4366f-8e2f-4252-a39d-1b4d0139db6a/channel/0/hls/live/index.m3u8'
FROM beaches b
WHERE b.slug = 'pacific-city-cape-kiwanda'
ON CONFLICT (beach_id) DO UPDATE
SET camera_url = EXCLUDED.camera_url
WHERE beach_sources.camera_url = 'https://pelicanbrewing.com/webcam/'
   OR beach_sources.camera_url = 'https://webcam.pacificcity.org/'
   OR beach_sources.camera_url = 'https://play.streamingvideoprovider.com/popplayer.php?it=7lkrdo2ropkw&w=720&h=405&autoplay=1&muted=1'
   OR beach_sources.camera_url IS NULL
   OR beach_sources.camera_url = '';
