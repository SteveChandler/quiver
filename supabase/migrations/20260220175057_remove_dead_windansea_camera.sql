-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Remove dead Windansea Surfline HLS camera (returns 404 as of Feb 2026)
-- The URL https://hls.cdn-surfline.com/oregon/wc-windansea/playlist.m3u8 was added
-- in migration 20260212054105 but the stream is no longer available.

UPDATE beach_sources
SET camera_url = NULL
WHERE beach_id = '6f42d47d-215b-47cb-ac14-b83bf8c2a797'
  AND camera_url = 'https://hls.cdn-surfline.com/oregon/wc-windansea/playlist.m3u8';
