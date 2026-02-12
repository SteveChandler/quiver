-- Replace dead SurfOutlook camera URLs + add Surfline HLS streams
--
-- SurfOutlook (larrysvacationwebcams.com) is defunct — all URLs 404.
-- Surfline HLS streams are CORS-blocked, so they route through our
-- /api/hls-proxy server-side proxy (cam-embed.ts rewrites the URL).
--
-- This migration:
--   1. Replaces 3 SD dead SurfOutlook URLs with Surfline HLS streams
--   2. Replaces 1 Ventura dead SurfOutlook URL with Surfline HLS
--   3. NULLs 7 remaining dead SurfOutlook URLs (no replacement found yet)
--   4. Adds Surfline HLS cams to 4 beaches that had no camera

BEGIN;

-- ─── 1. Replace SD SurfOutlook URLs with Surfline HLS ───────────────────────

UPDATE beach_sources
SET camera_url = 'https://hls.cdn-surfline.com/oregon/wc-blacksov/playlist.m3u8'
WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'blacks')
  AND camera_url LIKE '%surfoutlook.com%';

UPDATE beach_sources
SET camera_url = 'https://hls.cdn-surfline.com/oregon/wc-tourmaline/playlist.m3u8'
WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'tourmaline')
  AND camera_url LIKE '%surfoutlook.com%';

-- ─── 2. Replace Ventura SurfOutlook with Surfline HLS ───────────────────────

UPDATE beach_sources
SET camera_url = 'https://hls.cdn-surfline.com/oregon/wc-cstreet/playlist.m3u8'
WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'c-street-ventura-ca')
  AND camera_url LIKE '%surfoutlook.com%';

-- ─── 3. NULL remaining dead SurfOutlook URLs ────────────────────────────────
-- Santa Cruz (steamer-lane, pleasure-point, capitola),
-- SF (ocean-beach x3), Santa Barbara (leadbetter), OC (newport-56th-st)

UPDATE beach_sources
SET camera_url = NULL
WHERE camera_url LIKE '%surfoutlook.com%';

-- ─── 4. Add Surfline HLS cams to beaches with no camera ─────────────────────

INSERT INTO beach_sources (beach_id, camera_url)
SELECT id, 'https://hls.cdn-surfline.com/oregon/wc-windansea/playlist.m3u8'
FROM beaches WHERE slug = 'windansea'
AND NOT EXISTS (SELECT 1 FROM beach_sources WHERE beach_id = beaches.id);

INSERT INTO beach_sources (beach_id, camera_url)
SELECT id, 'https://hls.cdn-surfline.com/oregon/wc-sunsetcliffs/playlist.m3u8'
FROM beaches WHERE slug = 'sunset-cliffs-garbage'
AND NOT EXISTS (SELECT 1 FROM beach_sources WHERE beach_id = beaches.id);

INSERT INTO beach_sources (beach_id, camera_url)
SELECT id, 'https://hls.cdn-surfline.com/oregon/wc-sunsetcliffs/playlist.m3u8'
FROM beaches WHERE slug = 'sunset-cliffs-garbage-san-diego-ca'
AND NOT EXISTS (SELECT 1 FROM beach_sources WHERE beach_id = beaches.id);

INSERT INTO beach_sources (beach_id, camera_url)
SELECT id, 'https://hls.cdn-surfline.com/oregon/wc-sunsetcliffs/playlist.m3u8'
FROM beaches WHERE slug = 'sunset-cliffs-luscombs-san-diego-ca'
AND NOT EXISTS (SELECT 1 FROM beach_sources WHERE beach_id = beaches.id);

COMMIT;
