-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Expand IOOS station matching radius from 10km to 15km
-- Adds ~33 popular beaches (Waikiki, OB SF, Stinson, Hanalei Bay, Hotel del Coronado, etc.)
-- to the ML accuracy pipeline while maintaining swell window compatibility checks.

BEGIN;

-- 1. Recreate observable_beaches with 15km radius
DROP MATERIALIZED VIEW IF EXISTS observable_beaches;

CREATE MATERIALIZED VIEW observable_beaches AS
-- Original nearest_beach_id mapping (preserves existing coverage)
SELECT DISTINCT s.nearest_beach_id AS beach_id
FROM ioos_stations s
WHERE s.active = true
  AND s.has_wave_data = true
  AND s.nearest_beach_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ioos_observations o
    WHERE o.station_id = s.station_id
      AND o.wave_height_m IS NOT NULL
      AND o.observed_at > NOW() - INTERVAL '24 hours'
  )
UNION
-- Spatial proximity (15km) with swell window compatibility
-- Uses JOIN instead of correlated subqueries for station's nearest beach
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ioos_stations s
    JOIN beaches nb ON nb.id = s.nearest_beach_id
    WHERE s.active = true
      AND s.has_wave_data = true
      AND ST_DWithin(b.geog, s.coordinates::geography, 15000)
      AND swell_windows_overlap(
            b.swell_window_min_deg, b.swell_window_max_deg,
            nb.swell_window_min_deg, nb.swell_window_max_deg
          ) > 0
      AND EXISTS (
        SELECT 1 FROM ioos_observations o
        WHERE o.station_id = s.station_id
          AND o.wave_height_m IS NOT NULL
          AND o.observed_at > NOW() - INTERVAL '24 hours'
      )
  )
WITH DATA;

-- Recreate unique index
CREATE UNIQUE INDEX idx_observable_beaches_beach_id ON observable_beaches(beach_id);

-- Grant SELECT access
GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;


-- 2. Replace get_beach_observation_station with 15km radius
CREATE OR REPLACE FUNCTION get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  -- First try: station whose nearest_beach_id matches directly
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Second try: nearest station within 15km with compatible swell
  -- Uses JOIN instead of correlated subqueries
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 15000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) > 0
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Refresh to populate with new radius
REFRESH MATERIALIZED VIEW observable_beaches;

COMMIT;
