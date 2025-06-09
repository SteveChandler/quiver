-- Function to find nearby buoys within a specified distance
-- Matches Ruby Buoy.nearby(coordinates, limit:, max_distance:) functionality

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
      'wind_direction_name', CASE 
        WHEN b.wind_direction IS NULL THEN NULL
        WHEN b.wind_direction > 348.75 OR b.wind_direction <= 11.25 THEN 'N'
        WHEN b.wind_direction > 11.25 AND b.wind_direction <= 33.75 THEN 'NNE'
        WHEN b.wind_direction > 33.75 AND b.wind_direction <= 56.25 THEN 'NE'
        WHEN b.wind_direction > 56.25 AND b.wind_direction <= 78.75 THEN 'ENE'
        WHEN b.wind_direction > 78.75 AND b.wind_direction <= 101.25 THEN 'E'
        WHEN b.wind_direction > 101.25 AND b.wind_direction <= 123.75 THEN 'ESE'
        WHEN b.wind_direction > 123.75 AND b.wind_direction <= 146.25 THEN 'SE'
        WHEN b.wind_direction > 146.25 AND b.wind_direction <= 168.75 THEN 'SSE'
        WHEN b.wind_direction > 168.75 AND b.wind_direction <= 191.25 THEN 'S'
        WHEN b.wind_direction > 191.25 AND b.wind_direction <= 213.75 THEN 'SSW'
        WHEN b.wind_direction > 213.75 AND b.wind_direction <= 236.25 THEN 'SW'
        WHEN b.wind_direction > 236.25 AND b.wind_direction <= 258.75 THEN 'WSW'
        WHEN b.wind_direction > 258.75 AND b.wind_direction <= 281.25 THEN 'W'
        WHEN b.wind_direction > 281.25 AND b.wind_direction <= 303.75 THEN 'WNW'
        WHEN b.wind_direction > 303.75 AND b.wind_direction <= 326.25 THEN 'NW'
        WHEN b.wind_direction > 326.25 AND b.wind_direction <= 348.75 THEN 'NNW'
        ELSE NULL
      END,
      'tides', b.tides,
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

-- Add function documentation
COMMENT ON FUNCTION get_nearby_buoys(FLOAT, FLOAT, INT, INT) IS 
'Find active buoys within specified distance, ordered by proximity. Returns buoy details with weather conditions and spatial data.'; 