-- Fix get_nearby_beaches function to use city and state instead of location
-- Migration created: 2025-11-15
-- Issue: Function references b.location column which was renamed to city/state
-- Migration 20251025000000_restructure_beaches_location_data.sql renamed:
--   - location → city
--   - region → state
-- But migration 20251031235900_fix_all_coordinate_column_references.sql didn't update this
--
-- This migration reconstructs the location display field from city and state

BEGIN;

-- =============================================================================
-- Drop and recreate get_nearby_beaches function
-- Fix: Construct location from city and state columns
-- =============================================================================

DROP FUNCTION IF EXISTS get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

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
        -- FIXED: Construct location display from city and state
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

GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS
'Returns beaches within specified distance (meters) of given coordinates.
Uses city and state columns to construct location display field.
Uses standardized lat/lon column naming.
Utilizes generated geography column with GiST index for performance.';

COMMIT;

-- =============================================================================
-- Verification Tests (commented out - uncomment to test locally)
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

-- Test 2: Verify beaches table has city and state columns (not location/region)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'beaches'
  AND column_name IN ('city', 'state', 'location', 'region', 'lat', 'lon')
ORDER BY column_name;

-- Test 3: Try calling the function (San Diego area coordinates)
SELECT
    name,
    location,
    city,
    state,
    lat,
    lon,
    distance_meters
FROM get_nearby_beaches(32.7157, -117.1611, 50000, 10)
ORDER BY distance_meters
LIMIT 5;

-- Test 4: Verify location display is correctly constructed
SELECT
    name,
    city,
    state,
    CASE
        WHEN city IS NOT NULL AND state IS NOT NULL
            THEN city || ', ' || state
        WHEN city IS NOT NULL THEN city
        WHEN state IS NOT NULL THEN state
        ELSE 'Unknown'
    END AS constructed_location
FROM beaches
WHERE lat IS NOT NULL AND lon IS NOT NULL
LIMIT 10;
*/
