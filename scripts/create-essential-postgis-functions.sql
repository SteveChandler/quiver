-- Essential PostGIS functions for Quiver buoy API
-- Run this in your Supabase SQL editor to enable the API endpoints

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Function to find nearby buoys (required by /api/buoys/nearby)
CREATE OR REPLACE FUNCTION get_nearby_buoys(
  lat FLOAT,
  lng FLOAT,
  max_distance_meters INT DEFAULT 100000,
  limit_count INT DEFAULT 4
)
RETURNS TABLE (
  buoy_uuid TEXT,
  latitude FLOAT,
  longitude FLOAT,
  buoy_name TEXT,
  kind TEXT,
  active BOOLEAN,
  conditions JSONB,
  distance_meters FLOAT,
  direction_degrees FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.buoy_uuid,
    ST_Y(b.coordinates::geometry) as latitude,
    ST_X(b.coordinates::geometry) as longitude,
    b.buoy_name,
    b.kind,
    b.active,
    json_build_object(
      'air_temperature', b.air_temperature,
      'water_temperature', b.water_temperature,
      'wave_period', b.wave_period,
      'wave_height', b.wave_height,
      'wind_speed', b.wind_speed,
      'wind_gust', b.wind_gust,
      'wind_direction', b.wind_direction,
      'updated_at', EXTRACT(EPOCH FROM b.updated_at)
    ) as conditions,
    ST_Distance(b.coordinates, ST_Point(lng, lat)::geography) as distance_meters,
    degrees(ST_Azimuth(ST_Point(lng, lat)::geometry, b.coordinates::geometry)) as direction_degrees
  FROM buoys b
  WHERE b.active = true
    AND b.coordinates IS NOT NULL
    AND ST_Distance(b.coordinates, ST_Point(lng, lat)::geography) <= max_distance_meters
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to consolidate buoy conditions (required by /api/buoys/conditions)
CREATE OR REPLACE FUNCTION consolidate_buoy_conditions(
  lat FLOAT,
  lng FLOAT,
  limit_count INT DEFAULT 50,
  max_distance_meters INT DEFAULT 200000
)
RETURNS TABLE (
  buoy_uuid TEXT,
  latitude FLOAT,
  longitude FLOAT,
  buoy_name TEXT,
  conditions JSONB,
  source_count INT,
  consolidation_radius_meters FLOAT
) AS $$
DECLARE
  first_buoy_record RECORD := NULL;
BEGIN
  -- Get the nearest active buoy with data
  SELECT * INTO first_buoy_record
  FROM get_nearby_buoys(lat, lng, max_distance_meters, 1)
  WHERE active = true 
  LIMIT 1;
  
  -- Return the first buoy found (simplified version)
  IF first_buoy_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      first_buoy_record.buoy_uuid,
      first_buoy_record.latitude,
      first_buoy_record.longitude,
      first_buoy_record.buoy_name,
      first_buoy_record.conditions,
      1 as source_count,
      first_buoy_record.distance_meters as consolidation_radius_meters;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Create spatial index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_buoys_coordinates ON buoys USING GIST (coordinates);

-- Test the functions
SELECT 'PostGIS functions created successfully!' as status; 