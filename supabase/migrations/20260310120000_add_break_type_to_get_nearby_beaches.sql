-- =============================================================================
-- Add break_type to get_nearby_beaches
-- =============================================================================
-- Bug: Map page break type filters ("beach", "point", "reef", etc.) return 0
--      results because get_nearby_beaches doesn't return break_type. The filter
--      logic in use-beach-search.ts checks b.break_type which is undefined.
-- Fix: Add break_type to RETURNS TABLE and SELECT clause.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_nearby_beaches(
    input_lat DOUBLE PRECISION,
    input_lng DOUBLE PRECISION,
    max_distance_meters INTEGER DEFAULT 80467,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    location TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_meters DOUBLE PRECISION,
    slug TEXT,
    city TEXT,
    state TEXT,
    skill_level TEXT,
    break_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    target_lat DOUBLE PRECISION := input_lat;
    target_lng DOUBLE PRECISION := input_lng;
    capped_distance INTEGER := LEAST(GREATEST(max_distance_meters, 0), 160934);
    capped_limit INTEGER := LEAST(GREATEST(limit_count, 1), 200);
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
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
        ) AS distance_meters,
        b.slug,
        b.city,
        b.state,
        b.skill_level,
        b.break_type
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

-- Permissions
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS
'Returns beaches within specified distance of given coordinates.

Includes URL generation fields (slug, city, state), skill_level, and break_type for display and filtering.

Parameters:
- input_lat/input_lng: Search center coordinates
- max_distance_meters: Max radius (default 50mi, capped 100mi)
- limit_count: Max results (default 50, capped 200)

Returns: Beaches sorted by distance with id, name, location, lat, lon, is_private,
distance_meters, slug, city, state, skill_level, break_type.

Version: 2026-03-10 - Added break_type for map filter support';

COMMIT;
