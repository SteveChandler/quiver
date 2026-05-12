-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Fix: 3km was too restrictive (only 16 beaches). Use combined approach:
-- 1. Keep original nearest_beach_id mapping (preserves existing 45 beaches)
-- 2. Add spatial proximity (10km) with swell compatibility for additional coverage
-- Result: ~100 beaches (up from 45)

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
-- Spatial proximity (10km) with swell window compatibility
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ioos_stations s
    WHERE s.active = true
      AND s.has_wave_data = true
      AND ST_DWithin(b.geog, s.coordinates::geography, 10000)
      AND swell_windows_overlap(
            b.swell_window_min_deg, b.swell_window_max_deg,
            (SELECT b2.swell_window_min_deg FROM beaches b2 WHERE b2.id = s.nearest_beach_id),
            (SELECT b2.swell_window_max_deg FROM beaches b2 WHERE b2.id = s.nearest_beach_id)
          ) > 0
      AND EXISTS (
        SELECT 1 FROM ioos_observations o
        WHERE o.station_id = s.station_id
          AND o.wave_height_m IS NOT NULL
          AND o.observed_at > NOW() - INTERVAL '24 hours'
      )
  )
WITH DATA;

CREATE UNIQUE INDEX idx_observable_beaches_beach_id ON observable_beaches(beach_id);

GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW observable_beaches IS
'Beaches with ground truth observation sources. Uses combined approach:
1. Direct station mapping via nearest_beach_id (original ~45 beaches)
2. Spatial proximity (10km) with swell window compatibility (additional ~55 beaches)
Expanded Feb 2026 to ~100 beaches. Refresh daily via refresh_observable_beaches().';

-- Also update helper function to use 10km radius
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
  
  -- Second try: nearest station within 10km with compatible swell
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 10000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          (SELECT b2.swell_window_min_deg FROM beaches b2 WHERE b2.id = s.nearest_beach_id),
          (SELECT b2.swell_window_max_deg FROM beaches b2 WHERE b2.id = s.nearest_beach_id)
        ) > 0
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;
  
  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REFRESH MATERIALIZED VIEW observable_beaches;
