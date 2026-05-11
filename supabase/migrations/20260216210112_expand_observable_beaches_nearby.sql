-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

DROP MATERIALIZED VIEW IF EXISTS observable_beaches;

CREATE MATERIALIZED VIEW observable_beaches AS
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ioos_stations s
    WHERE s.active = true
      AND s.has_wave_data = true
      AND ST_DWithin(
            b.geog,
            s.coordinates::geography,
            3000
          )
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
'Beaches within 3km of an active IOOS station with compatible swell windows and recent observations (24h).
Expanded Feb 2026 from nearest_beach_id-only to spatial proximity + swell overlap.
Refresh daily via refresh_observable_beaches() or after adding new sources.';

CREATE OR REPLACE FUNCTION get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(
          b.geog,
          s.coordinates::geography,
          3000
        )
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

COMMENT ON FUNCTION get_beach_observation_station(UUID) IS
'Returns the nearest active IOOS station_id for a beach, filtered by 3km proximity and swell window compatibility. Used by backfill to find observation sources.';

GRANT EXECUTE ON FUNCTION get_beach_observation_station(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_beach_observation_station(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_beach_observation_station(UUID) TO service_role;

REFRESH MATERIALIZED VIEW observable_beaches;
