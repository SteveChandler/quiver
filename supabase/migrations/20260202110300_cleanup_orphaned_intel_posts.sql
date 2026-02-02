-- Migration: Cleanup Orphaned Intel Posts
-- Impact: 38 intel posts without beach_id (mostly E2E test data)
-- Priority: P1 (High)
--
-- Analysis shows these are primarily E2E test posts with:
-- - Titles like "E2E Test", "Performance Test", "Beach Assignment Test", "Test"
-- - Coordinates 2.5+ miles from any beach (San Diego bay/downtown area)
-- - Test descriptions like "Test description", "Testing auto-assignment of nearest beach"

BEGIN;

-- Backup orphaned posts before deletion
CREATE TABLE IF NOT EXISTS _backup_orphaned_intel_posts_20260202 AS
SELECT *
FROM intel_posts
WHERE beach_id IS NULL;

-- Delete obvious test posts (E2E tests, performance tests, etc.)
DELETE FROM intel_posts
WHERE beach_id IS NULL
  AND (
    title LIKE 'E2E Test%'
    OR title LIKE 'Performance Test%'
    OR title LIKE 'Beach Assignment Test%'
    OR title = 'Test'
    OR title = 'Valid title'
    OR description = 'Test'
    OR description = 'Test description'
    OR description LIKE 'Testing auto-assignment%'
  );

-- For any remaining orphaned posts, attempt to assign to nearest beach
-- Only assign if within 1 mile of a beach (reasonable range)
WITH nearest_beaches AS (
  SELECT
    ip.id as intel_post_id,
    (
      SELECT b.id
      FROM beaches b
      WHERE b.deleted_at IS NULL
      ORDER BY ST_SetSRID(ST_MakePoint(b.lon, b.lat), 4326)::geography <->
               ST_SetSRID(ST_MakePoint(ip.longitude::float, ip.latitude::float), 4326)::geography
      LIMIT 1
    ) as nearest_beach_id,
    (
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(b.lon, b.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(ip.longitude::float, ip.latitude::float), 4326)::geography
      ) / 1609.34
      FROM beaches b
      WHERE b.deleted_at IS NULL
      ORDER BY ST_SetSRID(ST_MakePoint(b.lon, b.lat), 4326)::geography <->
               ST_SetSRID(ST_MakePoint(ip.longitude::float, ip.latitude::float), 4326)::geography
      LIMIT 1
    ) as distance_miles
  FROM intel_posts ip
  WHERE ip.beach_id IS NULL
    AND ip.latitude IS NOT NULL
    AND ip.longitude IS NOT NULL
)
UPDATE intel_posts ip
SET beach_id = nb.nearest_beach_id
FROM nearest_beaches nb
WHERE ip.id = nb.intel_post_id
  AND nb.distance_miles < 1.0;  -- Only assign if within 1 mile

-- Delete any remaining orphaned posts (too far from any beach)
DELETE FROM intel_posts
WHERE beach_id IS NULL;

COMMIT;

-- Verification query:
-- SELECT COUNT(*) FROM intel_posts WHERE beach_id IS NULL;
-- Should return 0

-- Rollback procedure:
-- BEGIN;
-- DELETE FROM intel_posts WHERE id IN (SELECT id FROM _backup_orphaned_intel_posts_20260202);
-- INSERT INTO intel_posts SELECT * FROM _backup_orphaned_intel_posts_20260202;
-- DROP TABLE _backup_orphaned_intel_posts_20260202;
-- COMMIT;
