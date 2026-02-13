-- Fix Cardiff Reef camera URL
--
-- The current URL (hansensurf.com) returns X-Frame-Options: SAMEORIGIN,
-- preventing iframe embedding. Replace with the HDOnTap portal embed URL
-- that Hansen's page itself uses — this is the actual camera source and
-- is designed for iframe embedding (no X-Frame-Options restriction).

BEGIN;

UPDATE beach_sources
SET camera_url = 'https://portal.hdontap.com/s/embed?stream=cardiffreef_hs-CUST'
WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'cardiff-reef')
  AND camera_url = 'https://www.hansensurf.com/pages/live-surf-cams-cardiff-reef-san-diego';

COMMIT;
