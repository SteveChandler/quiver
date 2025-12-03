-- ROLLBACK MIGRATION - DO NOT APPLY UNLESS REVERTING THE FIX
-- This rolls back the get_nearby_beaches location field fix
--
-- WARNING: Rolling back will restore the BROKEN version that references b.location
-- Only use this if you need to revert to the exact state before the fix
-- and plan to apply a different solution
--
-- Created: 2025-11-15
-- Rolls back: 20251115101930_fix_get_nearby_beaches_location_field.sql

BEGIN;

-- =============================================================================
-- Restore the broken version from 20251031235900
-- WARNING: This version references b.location which doesn't exist!
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
        b.location,  -- BROKEN: This column doesn't exist (was renamed to city)
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
'BROKEN VERSION - Returns beaches within specified distance (meters) of given coordinates.
WARNING: This version references b.location column which does not exist.
This is the rolled-back state from before 20251115101930 fix.';

COMMIT;

-- =============================================================================
-- Post-Rollback Verification
-- =============================================================================

/*
-- This query will FAIL after rollback because b.location doesn't exist:

SELECT
    name,
    location,
    distance_meters
FROM get_nearby_beaches(32.7157, -117.1611, 50000, 10)
ORDER BY distance_meters
LIMIT 5;

-- Error: column "location" does not exist
*/
