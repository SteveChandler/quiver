BEGIN;

-- Runtime fix for get_beach_observation_station after widening the station
-- radius to 50km. The function is SECURITY DEFINER with search_path=public,
-- while PostGIS lives in extensions, so spatial tiers must qualify geography
-- casts and PostGIS functions explicitly.

CREATE OR REPLACE FUNCTION get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  -- Tier 1: IOOS station whose nearest_beach_id matches directly
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 2: IOOS station within 50km with compatible swell (>= 30 degrees)
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND extensions.ST_DWithin(b.geog, s.coordinates::extensions.geography, 50000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY extensions.ST_Distance(b.geog, s.coordinates::extensions.geography)
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 3: NDBC direct station whose nearest_beach_id matches (exclusive only)
  SELECT s.station_id INTO v_station_id
  FROM ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
  ORDER BY s.distance_to_beach_km
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 4: NDBC direct station within 50km with compatible swell (>= 30 degrees)
  SELECT s.station_id INTO v_station_id
  FROM ndbc_direct_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND extensions.ST_DWithin(b.geog, s.coordinates::extensions.geography, 50000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY extensions.ST_Distance(b.geog, s.coordinates::extensions.geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_beach_observation_station(UUID) IS
  'Returns the active wave station used for ML observation matching. Direct mappings are preferred, then IOOS/NDBC-direct spatial fallback within 50km and >= 30 degrees swell overlap. PostGIS calls are schema-qualified for search_path=public runtime safety.';

GRANT EXECUTE ON FUNCTION get_beach_observation_station(UUID)
TO authenticated, anon, service_role;

COMMIT;
