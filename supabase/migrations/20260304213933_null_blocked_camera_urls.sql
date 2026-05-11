-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- Null out camera URLs that block iframe embedding via X-Frame-Options
-- or CSP frame-ancestors headers. These show blank/error iframes on beach pages.
-- Affected beaches will fall back to map or photo gallery hero.
UPDATE beach_sources
SET camera_url = NULL
WHERE camera_url IN (
  'https://www.portofbandon.com/coquille-river-bar-cam',
  'https://www.driftwoodshores.com/live-webcam/',
  'https://research.oregonstate.edu/port-orford/webcam-and-sea-conditions',
  'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/city_pier_webcam.php',
  'https://oceanbeachsandiego.com/media/ob-beach-cam',
  'https://www.canterburyinn.com/beach-cam',
  'https://www.parrishkauai.com/kauai-webcam/',
  'https://www.oceaninnatmanzanita.com/oregon-coast-webcam/',
  'https://www.parkshorewaikiki.com/gallery/webcam'
);

COMMIT;
