-- Optimize auto-assign beach trigger to use indexed geography column
-- Addresses code review findings from 2026-01-14
--
-- Changes:
-- 1. Use pre-computed geog column with GiST index (idx_beaches_geog_gist)
-- 2. Add GRANT statements for function execution permissions
-- 3. Add COMMENT ON FUNCTION documentation
-- 4. Document SECURITY DEFINER rationale
--
-- See: docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md

BEGIN;

-- 1. Optimized function using pre-computed geography column with GiST index
-- This is significantly faster than computing ST_MakePoint on every row
CREATE OR REPLACE FUNCTION find_nearest_beach_id(
  post_lat DECIMAL(10,8),
  post_lon DECIMAL(11,8),
  max_distance_meters DOUBLE PRECISION DEFAULT 3218.69  -- 2 miles in meters
) RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  nearest_id UUID;
BEGIN
  -- Validate input coordinates
  -- Returns NULL for: NULL values, 0/0 (null island), out-of-range values
  IF post_lat IS NULL OR post_lon IS NULL
     OR post_lat = 0 OR post_lon = 0
     OR post_lat < -90 OR post_lat > 90
     OR post_lon < -180 OR post_lon > 180 THEN
    RETURN NULL;
  END IF;

  -- Use the pre-computed geog column which has a GiST index (idx_beaches_geog_gist)
  -- This is faster than computing ST_MakePoint(lon, lat) for each beach row
  SELECT b.id INTO nearest_id
  FROM public.beaches b
  WHERE b.geog IS NOT NULL
    AND ST_DWithin(
      b.geog,
      ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography,
      max_distance_meters
    )
  ORDER BY ST_Distance(
    b.geog,
    ST_SetSRID(ST_MakePoint(post_lon, post_lat), 4326)::geography
  )
  LIMIT 1;

  RETURN nearest_id;
END;
$$;

-- 2. Trigger function uses SECURITY DEFINER to bypass RLS when reading beaches
-- RATIONALE: The beaches table may have RLS policies that restrict access based on
-- user context. The trigger fires during INSERT operations where we need to read
-- all beaches regardless of the inserting user's permissions. Using DEFINER ensures
-- the nearest beach lookup succeeds. The function only READS from beaches and only
-- WRITES to NEW.beach_id, limiting the privilege escalation surface.
CREATE OR REPLACE FUNCTION assign_nearest_beach_to_intel_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Required to read beaches table bypassing RLS
SET search_path = public
AS $$
BEGIN
  -- Only assign if beach_id is not already set (preserves explicit assignments)
  IF NEW.beach_id IS NULL THEN
    NEW.beach_id := find_nearest_beach_id(NEW.latitude, NEW.longitude);
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Grant execution permissions (matching other functions in codebase)
GRANT EXECUTE ON FUNCTION find_nearest_beach_id(DECIMAL, DECIMAL, DOUBLE PRECISION)
  TO authenticated, service_role, anon;

GRANT EXECUTE ON FUNCTION assign_nearest_beach_to_intel_post()
  TO authenticated, service_role;

-- 4. Add function documentation
COMMENT ON FUNCTION find_nearest_beach_id(DECIMAL, DECIMAL, DOUBLE PRECISION) IS
'Finds the nearest beach within a given radius of the specified coordinates.
Uses the pre-computed geog column with GiST index for optimal performance.
Returns NULL if no beach is found within the radius or if coordinates are invalid.
Default radius is 2 miles (3218.69 meters).
See: docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md';

COMMENT ON FUNCTION assign_nearest_beach_to_intel_post() IS
'Trigger function that automatically assigns the nearest beach to intel posts on INSERT.
Only assigns if beach_id is NULL (preserves explicit assignments).
Uses SECURITY DEFINER to bypass RLS when reading beaches table.
See: docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md';

COMMENT ON TRIGGER set_intel_post_beach_id ON public.intel_posts IS
'Auto-assigns nearest beach (within 2 miles) to intel posts on insert.
Fixes "Unknown Beach" display issue for quick check-ins.
See: docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md';

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (for emergency use)
-- ============================================================================
-- To rollback this migration and the original trigger:
--
-- DROP TRIGGER IF EXISTS set_intel_post_beach_id ON public.intel_posts;
-- DROP FUNCTION IF EXISTS assign_nearest_beach_to_intel_post();
-- DROP FUNCTION IF EXISTS find_nearest_beach_id(DECIMAL, DECIMAL, DOUBLE PRECISION);
--
-- Note: Backfilled beach_id values will remain (no harm, preserves data integrity).
-- To revert backfilled data (NOT recommended):
-- UPDATE public.intel_posts SET beach_id = NULL WHERE beach_id IS NOT NULL;
-- ============================================================================
