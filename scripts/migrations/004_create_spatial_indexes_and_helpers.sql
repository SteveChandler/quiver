-- Create spatial indexes and helper functions for optimal geographic queries
-- Ensures fast spatial lookups and integrates beaches table with buoy system

-- Ensure beaches table has proper spatial column and indexes
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS coordinates GEOGRAPHY(POINT, 4326);

-- Update beaches coordinates from lat/lng if needed
UPDATE beaches 
SET coordinates = ST_Point(longitude, latitude)::geography 
WHERE coordinates IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_buoys_coordinates ON buoys USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_beaches_coordinates ON beaches USING GIST (coordinates);

-- Create additional indexes for buoy queries
CREATE INDEX IF NOT EXISTS idx_buoys_active ON buoys (active);
CREATE INDEX IF NOT EXISTS idx_buoys_updated_at ON buoys (updated_at);
CREATE INDEX IF NOT EXISTS idx_buoys_kind ON buoys (kind);
CREATE INDEX IF NOT EXISTS idx_buoys_uuid ON buoys (buoy_uuid);

-- Helper function to get nearby beaches (matches Ruby Location.nearby)
CREATE OR REPLACE FUNCTION get_nearby_beaches(
  lat FLOAT,
  lng FLOAT,
  max_distance_meters INT DEFAULT 50000,
  limit_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  latitude FLOAT,
  longitude FLOAT,
  location TEXT,
  distance_meters FLOAT,
  direction_degrees FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    ST_Y(b.coordinates::geometry) as latitude,
    ST_X(b.coordinates::geometry) as longitude,
    b.location,
    ST_Distance(b.coordinates, ST_Point(lng, lat)::geography) as distance_meters,
    degrees(ST_Azimuth(ST_Point(lng, lat)::geometry, b.coordinates::geometry)) as direction_degrees
  FROM beaches b
  WHERE b.coordinates IS NOT NULL
    AND ST_Distance(b.coordinates, ST_Point(lng, lat)::geography) <= max_distance_meters
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function to create geographic point (matches Ruby Geography.point)
CREATE OR REPLACE FUNCTION create_geographic_point(
  latitude FLOAT,
  longitude FLOAT
)
RETURNS GEOGRAPHY AS $$
BEGIN
  RETURN ST_Point(longitude, latitude)::geography;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get distance between two points
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 FLOAT,
  lng1 FLOAT,
  lat2 FLOAT,
  lng2 FLOAT
)
RETURNS FLOAT AS $$
BEGIN
  RETURN ST_Distance(
    ST_Point(lng1, lat1)::geography,
    ST_Point(lng2, lat2)::geography
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to format coordinates as string (matches Ruby coordinates_to_s)
CREATE OR REPLACE FUNCTION format_coordinates(
  latitude FLOAT,
  longitude FLOAT,
  precision_digits INT DEFAULT 5
)
RETURNS TEXT AS $$
DECLARE
  lat_dir TEXT := CASE WHEN latitude >= 0 THEN 'N' ELSE 'S' END;
  lng_dir TEXT := CASE WHEN longitude >= 0 THEN 'E' ELSE 'W' END;
  lat_abs FLOAT := abs(latitude);
  lng_abs FLOAT := abs(longitude);
BEGIN
  RETURN round(lat_abs, precision_digits) || '°' || lat_dir || '  ' || 
         round(lng_abs, precision_digits) || '°' || lng_dir;
END;
$$ LANGUAGE plpgsql;

-- Helper function to convert direction degrees to compass name
CREATE OR REPLACE FUNCTION direction_to_compass(
  degrees FLOAT,
  precision_level TEXT DEFAULT 'high'
)
RETURNS TEXT AS $$
BEGIN
  IF degrees IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Normalize degrees to 0-360 range
  degrees := degrees % 360;
  IF degrees < 0 THEN
    degrees := degrees + 360;
  END IF;
  
  IF precision_level = 'low' THEN
    -- 4-point compass
    IF degrees > 315 OR degrees <= 45 THEN RETURN 'N';
    ELSIF degrees > 45 AND degrees <= 135 THEN RETURN 'E';
    ELSIF degrees > 135 AND degrees <= 225 THEN RETURN 'S';
    ELSIF degrees > 225 AND degrees <= 315 THEN RETURN 'W';
    END IF;
  ELSE
    -- 16-point compass (high precision)
    IF degrees > 348.75 OR degrees <= 11.25 THEN RETURN 'N';
    ELSIF degrees > 11.25 AND degrees <= 33.75 THEN RETURN 'NNE';
    ELSIF degrees > 33.75 AND degrees <= 56.25 THEN RETURN 'NE';
    ELSIF degrees > 56.25 AND degrees <= 78.75 THEN RETURN 'ENE';
    ELSIF degrees > 78.75 AND degrees <= 101.25 THEN RETURN 'E';
    ELSIF degrees > 101.25 AND degrees <= 123.75 THEN RETURN 'ESE';
    ELSIF degrees > 123.75 AND degrees <= 146.25 THEN RETURN 'SE';
    ELSIF degrees > 146.25 AND degrees <= 168.75 THEN RETURN 'SSE';
    ELSIF degrees > 168.75 AND degrees <= 191.25 THEN RETURN 'S';
    ELSIF degrees > 191.25 AND degrees <= 213.75 THEN RETURN 'SSW';
    ELSIF degrees > 213.75 AND degrees <= 236.25 THEN RETURN 'SW';
    ELSIF degrees > 236.25 AND degrees <= 258.75 THEN RETURN 'WSW';
    ELSIF degrees > 258.75 AND degrees <= 281.25 THEN RETURN 'W';
    ELSIF degrees > 281.25 AND degrees <= 303.75 THEN RETURN 'WNW';
    ELSIF degrees > 303.75 AND degrees <= 326.25 THEN RETURN 'NW';
    ELSIF degrees > 326.25 AND degrees <= 348.75 THEN RETURN 'NNW';
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION get_nearby_beaches(FLOAT, FLOAT, INT, INT) IS 
'Find beaches within specified distance, ordered by proximity. Matches Ruby Location.nearby functionality.';

COMMENT ON FUNCTION create_geographic_point(FLOAT, FLOAT) IS 
'Create PostGIS geography point from latitude/longitude coordinates.';

COMMENT ON FUNCTION calculate_distance_meters(FLOAT, FLOAT, FLOAT, FLOAT) IS 
'Calculate distance in meters between two geographic points.';

COMMENT ON FUNCTION format_coordinates(FLOAT, FLOAT, INT) IS 
'Format coordinates as human-readable string with cardinal directions.';

COMMENT ON FUNCTION direction_to_compass(FLOAT, TEXT) IS 
'Convert degrees to compass direction name. Supports low (4-point) and high (16-point) precision.'; 