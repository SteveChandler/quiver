-- Fix get_nearby_beaches function to match application expectations
-- The app calls it with lat/lng parameters, but we need to avoid column ambiguity
-- Solution: accept lat/lng parameters but use different internal names
-- This resolves PGRST202 errors in spatial queries

BEGIN;

-- Drop all existing versions of get_nearby_beaches function
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

-- Create function with parameter names that match application usage
-- but use internal aliases to avoid column ambiguity
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
SET search_path = public, extensions
AS $$
DECLARE
    target_lat DOUBLE PRECISION := lat;
    target_lng DOUBLE PRECISION := lng;
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
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL 
      AND b.longitude IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
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
'Returns beaches within specified distance (meters) of given coordinates. Fixed parameter names to match application usage (lat, lng). Uses PostGIS for accurate earth-surface distance calculations.';

COMMIT;