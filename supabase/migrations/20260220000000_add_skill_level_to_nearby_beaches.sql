-- =============================================================================
-- Add skill_level to get_nearby_beaches + fix 3 SD beach skill ratings
-- =============================================================================
-- Bug: All "Nearby Surf Spots" cards show "All levels" because get_nearby_beaches
--      doesn't return the skill_level column. SurfSpotCard gets undefined and
--      falls back to "All levels".
-- Fix: Add skill_level to RETURNS TABLE and SELECT clause.
-- Also: Correct 3 San Diego beach skill level ratings.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART A: Recreate get_nearby_beaches with skill_level column
-- =============================================================================

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
    skill_level TEXT
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
        b.skill_level
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

Includes URL generation fields (slug, city, state) and skill_level for display.

Parameters:
- input_lat/input_lng: Search center coordinates
- max_distance_meters: Max radius (default 50mi, capped 100mi)
- limit_count: Max results (default 50, capped 200)

Returns: Beaches sorted by distance with id, name, location, lat, lon, is_private,
distance_meters, slug, city, state, skill_level.

Version: 2026-02-20 - Added skill_level for nearby spots display';

-- =============================================================================
-- PART B: Fix 3 San Diego beach skill levels
-- =============================================================================

-- Ocean Beach Pier: intermediate -> advanced (heavy shore break, strong currents)
UPDATE beaches
SET skill_level = 'advanced'
WHERE slug = 'ocean-beach-pier' AND city = 'San Diego' AND state = 'CA';

-- Swami's: intermediate-advanced -> advanced (reef break, shallow)
UPDATE beaches
SET skill_level = 'advanced'
WHERE slug = 'swamis' AND city = 'Encinitas' AND state = 'CA';

-- Avalanche: beginner-intermediate -> intermediate-advanced (powerful reef break)
UPDATE beaches
SET skill_level = 'intermediate-advanced'
WHERE slug = 'avalanche' AND city = 'San Diego' AND state = 'CA';

COMMIT;
