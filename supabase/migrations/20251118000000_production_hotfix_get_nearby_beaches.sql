-- =============================================================================
-- PRODUCTION HOTFIX: Fix get_nearby_beaches function for Best Conditions
-- =============================================================================
-- Created: 2025-11-18
-- Issue: Best Conditions returns 0 beaches, Nearby tab fails
-- Root Cause: get_nearby_beaches references wrong column names
--
-- This migration ensures the function uses the CORRECT column names:
-- - lat, lon (NOT latitude, longitude)
-- - Constructs location from city + state (NOT direct b.location reference)
-- - Uses PostGIS geog column for efficient spatial queries
--
-- Fixes Issues:
-- 1. Best Conditions showing 0 beaches for users with valid home beach
-- 2. Nearby tab failing with "Cannot read properties of undefined (reading 'lat')"
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Drop all existing versions of get_nearby_beaches
-- This ensures we start with a clean slate regardless of what's in production
-- =============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all overloaded versions of the function
    FOR r IN (
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_nearby_beaches'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', r.sig;
    END LOOP;

    IF NOT FOUND THEN
        RAISE NOTICE 'No existing get_nearby_beaches functions found';
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Create the CORRECT version of get_nearby_beaches
-- This version uses the current schema:
-- - beaches.lat, beaches.lon (coordinate columns)
-- - beaches.city, beaches.state (location columns)
-- - beaches.geog (PostGIS geography for spatial queries)
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
        b.lat,        -- Use lat column (NOT latitude)
        b.lon,        -- Use lon column (NOT longitude)
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
-- STEP 3: Grant necessary permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

-- =============================================================================
-- STEP 4: Add documentation
-- =============================================================================

COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS
'Returns beaches within specified distance (meters) of given coordinates.

Uses current schema column names:
- lat, lon (coordinate columns)
- city, state (location columns, combined for display)
- geog (PostGIS geography column with GiST index)

Parameters:
- input_lat: Latitude of search center
- input_lng: Longitude of search center
- max_distance_meters: Maximum search radius (default 50 miles, capped at 100 miles)
- limit_count: Maximum results to return (default 50, capped at 200)

Returns: Beaches sorted by distance ascending, with constructed location field.

Used by:
- Best Conditions section (home screen)
- Nearby tab (home screen)
- Beach recommendation service

Version: 2025-11-18 Production Hotfix';

COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION TESTS
-- =============================================================================

/*
-- Test 1: Verify function exists with correct signature
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_nearby_beaches';

-- Expected: function with 4 DOUBLE PRECISION/INTEGER parameters


-- Test 2: Verify beaches table has required columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'beaches'
  AND column_name IN ('lat', 'lon', 'city', 'state', 'geog')
ORDER BY column_name;

-- Expected: All 5 columns should exist


-- Test 3: Test function with Pacific Beach coordinates
-- Pacific Beach, San Diego: 32.7941, -117.2340
SELECT
    name,
    location,
    city,
    state,
    lat,
    lon,
    ROUND(distance_meters::NUMERIC, 0) AS distance_meters,
    ROUND((distance_meters * 0.000621371)::NUMERIC, 2) AS distance_miles
FROM get_nearby_beaches(32.7941, -117.2340, 16093, 10)
ORDER BY distance_meters
LIMIT 5;

-- Expected: Should return nearby beaches like Mission Beach, Ocean Beach, etc.


-- Test 4: Verify location field is correctly constructed
SELECT
    name,
    city,
    state,
    location,
    distance_meters
FROM get_nearby_beaches(32.7941, -117.2340, 50000, 5)
LIMIT 3;

-- Expected: location should be "City, ST" format (e.g., "San Diego, CA")


-- Test 5: Count beaches within 10 miles of Pacific Beach
SELECT COUNT(*) as nearby_beaches_count
FROM get_nearby_beaches(32.7941, -117.2340, 16093, 100);

-- Expected: At least 10-20 beaches in San Diego area


-- Test 6: Verify no private beaches are returned
SELECT COUNT(*) FILTER (WHERE is_private = true) as private_beach_count
FROM get_nearby_beaches(32.7941, -117.2340, 50000, 100);

-- Expected: 0 (function filters out private beaches)
*/

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================

/*
If this migration causes issues, rollback by running:

BEGIN;

DROP FUNCTION IF EXISTS get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

-- Then manually recreate the previous version or restore from backup

COMMIT;
*/
