-- Add generated geography column and GiST index
-- Update get_nearby_beaches to cap inputs and use indexed geography

BEGIN;

-- Add generated geography column for efficient spatial queries
ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED;

-- Ensure GiST index exists on the generated geography column
CREATE INDEX IF NOT EXISTS beaches_geog_gist ON public.beaches USING GIST (geog);

-- Drop all existing versions of get_nearby_beaches function to avoid ambiguity
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_nearby_beaches'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- Recreate function with input caps and optimized geography usage
CREATE OR REPLACE FUNCTION get_nearby_beaches(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    max_distance_meters INTEGER DEFAULT 80467, -- 50 miles in meters
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    target_lat DOUBLE PRECISION := lat;
    target_lng DOUBLE PRECISION := lng;
    capped_distance INTEGER := LEAST(GREATEST(max_distance_meters, 0), 160934); -- 0..100 miles
    capped_limit INTEGER := LEAST(GREATEST(limit_count, 1), 200); -- 1..200
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.location,
        b.latitude,
        b.longitude,
        b.is_private,
        ST_Distance(
            b.geog,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL 
      AND b.longitude IS NOT NULL
      AND ST_DWithin(
          b.geog,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          capped_distance
      )
    ORDER BY distance_meters ASC
    LIMIT capped_limit;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

-- Documentation
COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS 
'Returns beaches within specified distance (meters) of given coordinates. Adds input caps and uses generated geography column with GiST index for performance.';

COMMIT;


