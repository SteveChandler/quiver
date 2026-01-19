-- Add PostGIS function for finding nearby IOOS stations
-- Used by IOOSService.findNearbyStations()

CREATE OR REPLACE FUNCTION find_nearby_ioos_stations(
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_radius_km NUMERIC DEFAULT 100
)
RETURNS SETOF ioos_stations
LANGUAGE sql
STABLE
AS $$
  SELECT s.*
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000  -- Convert km to meters
    )
  ORDER BY ST_Distance(
    s.coordinates::geography,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  )
  LIMIT 10;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_ioos_stations TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_ioos_stations TO service_role;

COMMENT ON FUNCTION find_nearby_ioos_stations IS
  'Find active IOOS wave stations within radius_km of a point, ordered by distance';
