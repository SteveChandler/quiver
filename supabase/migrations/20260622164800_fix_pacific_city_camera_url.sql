-- Fix Pacific City (Cape Kiwanda) camera URL
--
-- The current owner-page webcam sources render branded splash content rather
-- than a clean live cam in Quiver's generic iframe flow. Replace them with the
-- direct embeddable StreamingVideoProvider player URL that the site owner
-- approved for use.

BEGIN;

INSERT INTO beach_sources (beach_id, camera_url)
SELECT
  b.id,
  'https://play.streamingvideoprovider.com/popplayer.php?it=7lkrdo2ropkw&w=720&h=405&autoplay=1&muted=1'
FROM beaches b
WHERE b.slug = 'pacific-city-cape-kiwanda'
ON CONFLICT (beach_id) DO UPDATE
SET camera_url = EXCLUDED.camera_url
WHERE
  beach_sources.camera_url = 'https://pelicanbrewing.com/webcam/'
  OR beach_sources.camera_url = 'https://webcam.pacificcity.org/'
  OR beach_sources.camera_url IS NULL
  OR beach_sources.camera_url = '';

COMMIT;
