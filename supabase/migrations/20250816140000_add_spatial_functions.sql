-- Spatial query functions for optimized buoy location queries
-- Replaces fallback queries with proper PostGIS distance calculations

BEGIN;

-- Safely drop existing versions to allow return type changes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_nearby_buoys'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;

  FOR r IN (
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_nearest_buoy_with_conditions'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;

  FOR r IN (
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_nearby_beaches'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- 1. Function to get nearby buoys with distance calculation
CREATE OR REPLACE FUNCTION get_nearby_buoys(
    target_lat DOUBLE PRECISION,
    target_lng DOUBLE PRECISION,
    max_distance_m INTEGER DEFAULT 100000,
    result_limit INTEGER DEFAULT 4
)
RETURNS TABLE(
    buoy_uuid TEXT,
    buoy_name TEXT,
    active BOOLEAN,
    coordinates GEOMETRY(Point, 4326),
    water_temperature NUMERIC,
    air_temperature NUMERIC,
    wave_height NUMERIC,
    wave_period NUMERIC,
    wind_speed NUMERIC,
    wind_gust NUMERIC,
    wind_direction NUMERIC,
    tides JSONB,
    updated_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.buoy_uuid,
        b.buoy_name,
        b.active,
        b.coordinates,
        b.water_temperature,
        b.air_temperature,
        b.wave_height,
        b.wave_period,
        b.wind_speed,
        b.wind_gust,
        b.wind_direction,
        b.tides,
        b.updated_at,
        ST_Distance(
            b.coordinates,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.buoys b
    WHERE b.active = true
      AND b.coordinates IS NOT NULL
      AND ST_DWithin(
          b.coordinates,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_m
      )
    ORDER BY distance_meters ASC
    LIMIT result_limit;
END;
$$;

-- 2. Function to get nearest buoy with current conditions
CREATE OR REPLACE FUNCTION get_nearest_buoy_with_conditions(
    target_lat DOUBLE PRECISION,
    target_lng DOUBLE PRECISION,
    max_distance_m INTEGER DEFAULT 100000
)
RETURNS TABLE(
    buoy_uuid TEXT,
    buoy_name TEXT,
    active BOOLEAN,
    coordinates GEOMETRY(Point, 4326),
    water_temperature NUMERIC,
    air_temperature NUMERIC,
    wave_height NUMERIC,
    wave_period NUMERIC,
    wind_speed NUMERIC,
    wind_gust NUMERIC,
    wind_direction NUMERIC,
    tides JSONB,
    updated_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.buoy_uuid,
        b.buoy_name,
        b.active,
        b.coordinates,
        b.water_temperature,
        b.air_temperature,
        b.wave_height,
        b.wave_period,
        b.wind_speed,
        b.wind_gust,
        b.wind_direction,
        b.tides,
        b.updated_at,
        ST_Distance(
            b.coordinates,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) AS distance_meters
    FROM public.buoys b
    WHERE b.active = true
      AND b.coordinates IS NOT NULL
      AND (b.water_temperature IS NOT NULL 
           OR b.air_temperature IS NOT NULL 
           OR b.wave_height IS NOT NULL)
      AND ST_DWithin(
          b.coordinates,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_m
      )
    ORDER BY 
        b.updated_at DESC,
        distance_meters ASC
    LIMIT 1;
END;
$$;

-- 3. Function to get beaches within radius (for future use)
CREATE OR REPLACE FUNCTION get_nearby_beaches(
    target_lat DOUBLE PRECISION,
    target_lng DOUBLE PRECISION,
    max_distance_km DOUBLE PRECISION DEFAULT 50.0,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_private BOOLEAN,
    distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
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
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
        ) / 1000.0 AS distance_km
    FROM public.beaches b
    WHERE b.latitude IS NOT NULL 
      AND b.longitude IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
          max_distance_km * 1000
      )
    ORDER BY distance_km ASC
    LIMIT result_limit;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_nearby_buoys(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_buoys(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearest_buoy_with_conditions(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearest_buoy_with_conditions(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_beaches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO service_role;

COMMIT;