-- =============================================================================
-- ROLLBACK for: 20251208000000_add_url_fields_to_get_nearby_beaches.sql
-- =============================================================================
-- Created: 2025-12-08
-- Purpose: Rollback the addition of slug, city, state fields to get_nearby_beaches
--
-- WARNING: Only run this if you need to revert the changes made by the migration
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Drop the updated version of the function
-- =============================================================================

DROP FUNCTION IF EXISTS get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

-- =============================================================================
-- STEP 2: Restore the original version (without slug, city, state)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_nearby_beaches(
    input_lat DOUBLE PRECISION,
    input_lng DOUBLE PRECISION,
    max_distance_meters INTEGER DEFAULT 80467, -- 50 miles in meters
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    location TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    target_lat DOUBLE PRECISION := input_lat;
    target_lng DOUBLE PRECISION := input_lng;
    capped_distance INTEGER := LEAST(GREATEST(max_distance_meters, 0), 160934); -- 0..100 miles
    capped_limit INTEGER := LEAST(GREATEST(limit_count, 1), 200); -- 1..200
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        -- Construct location display from city and state columns
        CASE
            WHEN b.city IS NOT NULL AND b.state IS NOT NULL
                THEN b.city || ', ' || b.state
            WHEN b.city IS NOT NULL THEN b.city
            WHEN b.state IS NOT NULL THEN b.state
            ELSE 'Unknown'
        END AS location,
        b.lat,
        b.lon,
        b.is_private,
        ST_Distance(
            b.geog,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.beaches b
    WHERE b.lat IS NOT NULL
      AND b.lon IS NOT NULL
      AND ST_DWithin(
          b.geog,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          capped_distance
      )
    ORDER BY distance_meters ASC
    LIMIT capped_limit;
END;
$$;

-- =============================================================================
-- STEP 3: Restore permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

-- =============================================================================
-- STEP 4: Update documentation
-- =============================================================================

COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS
'Returns beaches within specified distance (meters) of given coordinates.

Parameters:
- input_lat: Latitude of search center
- input_lng: Longitude of search center
- max_distance_meters: Maximum search radius (default 50 miles, capped at 100 miles)
- limit_count: Maximum results to return (default 50, capped at 200)

Returns: Beaches sorted by distance ascending with:
- id, name, location, lat, lon, is_private, distance_meters

Version: Original (pre-2025-12-08) - WITHOUT slug, city, state fields';

COMMIT;

-- =============================================================================
-- POST-ROLLBACK VERIFICATION
-- =============================================================================

/*
-- Test: Verify old columns are returned (no slug, city, state)
SELECT
    name,
    location,
    ROUND(distance_meters::NUMERIC, 0) AS distance_m
FROM get_nearby_beaches(32.7941, -117.2340, 16093, 5)
ORDER BY distance_meters
LIMIT 5;

-- Expected: Should return 7 columns (id, name, location, lat, lon, is_private, distance_meters)
--           Should NOT have slug, city, state columns
*/
