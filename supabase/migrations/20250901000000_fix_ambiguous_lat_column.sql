-- Fix ambiguous column reference "lat" in get_nearby_beaches function
-- This resolves the "column reference 'lat' is ambiguous" error

BEGIN;

-- Drop existing version to allow signature change
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

-- Create function with prefixed parameter names to avoid ambiguity
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
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
            ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(input_lng, input_lat), 4326)::geography
        ) AS distance_meters
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL 
      AND b.longitude IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(input_lng, input_lat), 4326)::geography,
          max_distance_meters
      )
    ORDER BY distance_meters ASC
    LIMIT limit_count;
END;
$$;

-- Grant execute permissions to all roles that need access
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) IS 
'Returns beaches within specified distance (meters) of given coordinates. Uses PostGIS for accurate earth-surface distance calculations. Optimized with spatial indexes for performance.';

COMMIT;