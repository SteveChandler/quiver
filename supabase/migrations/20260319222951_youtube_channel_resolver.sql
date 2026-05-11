-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- 1. Schema changes
ALTER TABLE beach_sources
  ADD COLUMN IF NOT EXISTS youtube_channel_handle text,
  ADD COLUMN IF NOT EXISTS youtube_channel_id text,
  ADD COLUMN IF NOT EXISTS youtube_stream_title_hint text,
  ADD COLUMN IF NOT EXISTS youtube_last_resolved_at timestamptz;

COMMENT ON COLUMN beach_sources.youtube_channel_handle IS
  'YouTube channel handle (e.g. @ExploreOceans). Stable anchor for resolving current live stream video IDs.';
COMMENT ON COLUMN beach_sources.youtube_channel_id IS
  'YouTube channel ID (e.g. UCxxxxxx). Cached from handle lookup to avoid repeated API calls. Populated by resolver on first run.';
COMMENT ON COLUMN beach_sources.youtube_stream_title_hint IS
  'Substring to match against stream titles for multi-cam channels (e.g. "Surf Camera" for @DeerfieldBeachLive). NULL for single-cam channels.';
COMMENT ON COLUMN beach_sources.youtube_last_resolved_at IS
  'Timestamp of last successful resolver run for this cam. Used to detect stale cams.';

-- 2. Backfill channel handles for existing YouTube cams (UPDATE only, no INSERT)
UPDATE beach_sources SET youtube_channel_handle = '@SanDiegoWebCam'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'ocean-beach-pier')
    AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@ChamberlinNature'
  WHERE beach_id IN (
    SELECT id FROM beaches WHERE slug IN ('linda-mar-pacifica-ca', 'rockaway-beach-pacifica-ca')
  ) AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@ExploreOceans'
  WHERE beach_id IN (
    SELECT id FROM beaches WHERE slug IN ('pipeline', 'waimea-bay')
  ) AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@janicezagata3902'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'short-sands-manzanita-or')
    AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@enjoyspi'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'south-padre-island-isla-blanca-park-south-padre-island-tx')
    AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@DeerfieldBeachLive',
       youtube_stream_title_hint = 'Surf Camera'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'deerfield-beach-pier-deerfield-beach-fl')
    AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@VolusiaBeaches'
  WHERE beach_id IN (
    SELECT id FROM beaches WHERE slug IN (
      'new-smyrna-beach-nsb-inlet-new-smyrna-beach-fl',
      'ponce-inlet-ponce-inlet-fl'
    )
  ) AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@JaxpiercamTV'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'jacksonville-beach-pier-jacksonville-beach-fl')
    AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@ScarboroughBeach'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'scarborough-beach-scarborough-me')
    AND camera_url LIKE '%youtube.com%';

UPDATE beach_sources SET youtube_channel_handle = '@SeaChambers'
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'ogunquit-beach-ogunquit-me')
    AND camera_url LIKE '%youtube.com%';

-- 3. Add new cams (upsert — beach_sources rows may already exist from buoy/forecast assignment)
INSERT INTO beach_sources (beach_id, camera_url, youtube_channel_handle)
SELECT b.id, urls.camera_url, urls.channel_handle
FROM (VALUES
  ('satellite-beach-satellite-beach-fl', 'https://www.youtube.com/watch?v=0bv7YxPWRdw', '@SatelliteBeachLive'),
  ('pensacola-pier-pensacola-beach-fl', 'https://www.youtube.com/watch?v=HKIc6CYlMzI', '@SantaRosaIslandAuthority')
) AS urls(slug, camera_url, channel_handle)
JOIN beaches b ON b.slug = urls.slug
ON CONFLICT (beach_id) DO UPDATE SET
  camera_url = EXCLUDED.camera_url,
  youtube_channel_handle = EXCLUDED.youtube_channel_handle
WHERE beach_sources.camera_url IS NULL OR beach_sources.camera_url = '';

-- 4. Null out dead cams (video IDs confirmed dead, no channel to resolve from)
-- Note: Hawaii beaches use short slugs (per migration 20260211060000_fix_hi_pr_beach_slugs.sql)
UPDATE beach_sources SET camera_url = NULL
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'ala-moana-bowls')
    AND camera_url LIKE '%zkKMuhqJKUo%';

UPDATE beach_sources SET camera_url = NULL
  WHERE beach_id IN (SELECT id FROM beaches WHERE slug IN ('waikiki-canoes', 'waikiki-queens'))
    AND camera_url LIKE '%yW0OOEO9usE%';

UPDATE beach_sources SET camera_url = NULL
  WHERE beach_id = (SELECT id FROM beaches WHERE slug = 'higgins-beach-scarborough-me')
    AND camera_url LIKE '%Ae51VMpV6Z4%';

COMMIT;
