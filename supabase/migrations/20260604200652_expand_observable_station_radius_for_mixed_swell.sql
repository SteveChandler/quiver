BEGIN;

-- Expand the shared ML station-selection radius for mixed-swell ground-truth
-- matching. A read-only sentinel audit on 2026-06-04 showed 50km is the
-- smallest tested radius with enough active, recent, swell-compatible station
-- candidates to move 121-168h mixed-swell observation coverage toward the 80%
-- readiness gate. Direct mappings and source-recency gates are preserved.

DROP MATERIALIZED VIEW IF EXISTS observable_beaches;

CREATE MATERIALIZED VIEW observable_beaches AS

-- Path A: IOOS direct station mapping (preserves existing coverage, 24h recency)
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

-- Path B: IOOS spatial proximity (50km, >= 30 degrees swell overlap, 48h recency)
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ioos_stations s
    JOIN beaches nb ON nb.id = s.nearest_beach_id
    WHERE s.active = true
      AND s.has_wave_data = true
      AND ST_DWithin(b.geog, s.coordinates::geography, 50000)
      AND swell_windows_overlap(
            b.swell_window_min_deg, b.swell_window_max_deg,
            nb.swell_window_min_deg, nb.swell_window_max_deg
          ) >= 30
      AND EXISTS (
        SELECT 1 FROM ioos_observations o
        WHERE o.station_id = s.station_id
          AND o.wave_height_m IS NOT NULL
          AND o.observed_at > NOW() - INTERVAL '48 hours'
      )
  )

UNION

-- Path C: NDBC direct station mapping (NDBC-exclusive only, 24h recency)
SELECT DISTINCT s.nearest_beach_id AS beach_id
FROM ndbc_direct_stations s
WHERE s.active = true
  AND s.has_wave_data = true
  AND s.nearest_beach_id IS NOT NULL
  AND (
    s.ioos_station_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM ioos_stations iss
      WHERE iss.station_id = s.ioos_station_id
        AND iss.active = true
    )
  )
  AND EXISTS (
    SELECT 1 FROM ndbc_direct_observations o
    WHERE o.station_id = s.station_id
      AND o.wave_height_m IS NOT NULL
      AND o.observed_at > NOW() - INTERVAL '24 hours'
  )

UNION

-- Path D: NDBC direct spatial proximity (50km, >= 30 degrees swell overlap, 48h recency)
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ndbc_direct_stations s
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
      AND ST_DWithin(b.geog, s.coordinates::geography, 50000)
      AND swell_windows_overlap(
            b.swell_window_min_deg, b.swell_window_max_deg,
            nb.swell_window_min_deg, nb.swell_window_max_deg
          ) >= 30
      AND EXISTS (
        SELECT 1 FROM ndbc_direct_observations o
        WHERE o.station_id = s.station_id
          AND o.wave_height_m IS NOT NULL
          AND o.observed_at > NOW() - INTERVAL '48 hours'
      )
  )

WITH DATA;

CREATE UNIQUE INDEX idx_observable_beaches_beach_id ON observable_beaches(beach_id);

GRANT SELECT ON observable_beaches TO authenticated, anon, service_role;

COMMENT ON MATERIALIZED VIEW observable_beaches IS
  'Beaches with ground truth observation sources for ML training. Four paths: '
  '(A) IOOS direct station mapping (24h recency), '
  '(B) IOOS spatial proximity 50km with >= 30 degrees swell overlap (48h recency), '
  '(C) NDBC direct station mapping, NDBC-exclusive only (24h recency), '
  '(D) NDBC direct spatial proximity 50km with >= 30 degrees swell overlap (48h recency). '
  'Expanded Jun 2026 from 25km to 50km for mixed-swell sentinel recovery. '
  'Refreshed every 2h by /api/cron/ioos-sync?phase=observations.';

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
    AND ST_DWithin(b.geog, s.coordinates::geography, 50000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
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
    AND ST_DWithin(b.geog, s.coordinates::geography, 50000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_beach_observation_station(UUID) IS
  'Returns the active wave station used for ML observation matching. Direct mappings are preferred, then IOOS/NDBC-direct spatial fallback within 50km and >= 30 degrees swell overlap.';

GRANT EXECUTE ON FUNCTION get_beach_observation_station(UUID)
TO authenticated, anon, service_role;

COMMIT;
