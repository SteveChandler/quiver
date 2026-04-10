-- Combined migration: Expand observable radius (15km -> 25km) + add NDBC direct to ML pipeline
--
-- Changes:
--   1. unified_wave_observations: Add UNION ALL for ndbc_direct_observations (NDBC-exclusive only)
--   2. observable_beaches: Expand spatial radius 15km -> 25km, tighten swell overlap >= 30°,
--      relax spatial recency 24h -> 48h, add NDBC direct station branch
--   3. get_beach_observation_station: Expand to 25km/30° + add NDBC direct fallback tiers
--
-- Expected impact: ~134 observable beaches -> 200+ (41 from radius expansion + NDBC direct stations)
--
-- Dry-run validation (run before applying):
--   SELECT COUNT(*) FROM observable_beaches;  -- should be ~134 before
--   -- After applying, re-run to confirm increase

BEGIN;

-- =============================================================================
-- 1. Update unified_wave_observations to include NDBC direct observations
-- =============================================================================

CREATE OR REPLACE VIEW public.unified_wave_observations
WITH (security_invoker = true) AS
-- Existing IOOS observations
SELECT
  'ioos' AS source,
  o.station_id,
  o.observed_at,
  o.wave_height_m,
  o.wave_period_s,
  o.wave_direction_deg,
  o.water_temp_c,
  s.latitude,
  s.longitude,
  s.nearest_beach_id,
  s.distance_to_beach_km,
  s.source_network
FROM public.ioos_observations o
JOIN public.ioos_stations s USING (station_id)
WHERE s.active = true
  AND o.wave_height_m IS NOT NULL

UNION ALL

-- NDBC direct observations (only for stations NOT actively covered by IOOS)
SELECT
  'ndbc_direct' AS source,
  o.station_id,
  o.observed_at,
  o.wave_height_m,
  o.wave_period_s,
  o.wave_direction_deg,
  o.water_temp_c,
  s.latitude,
  s.longitude,
  s.nearest_beach_id,
  s.distance_to_beach_km,
  'NDBC' AS source_network
FROM public.ndbc_direct_observations o
JOIN public.ndbc_direct_stations s USING (station_id)
WHERE s.active = true
  AND o.wave_height_m IS NOT NULL
  AND (
    s.ioos_station_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.ioos_stations iss
      WHERE iss.station_id = s.ioos_station_id
        AND iss.active = true
    )
  );

GRANT SELECT ON public.unified_wave_observations TO authenticated;
GRANT SELECT ON public.unified_wave_observations TO service_role;

COMMENT ON VIEW public.unified_wave_observations IS
  'Unified view of wave observations from IOOS and NDBC direct sources for ML training. '
  'NDBC direct observations are only included for stations not actively covered by IOOS (dedup via ioos_station_id cross-reference).';


-- =============================================================================
-- 2. Recreate observable_beaches with 25km radius + NDBC direct
-- =============================================================================

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

-- Path B: IOOS spatial proximity (25km, >= 30° swell overlap, 48h recency)
SELECT DISTINCT b.id AS beach_id
FROM beaches b
WHERE b.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ioos_stations s
    JOIN beaches nb ON nb.id = s.nearest_beach_id
    WHERE s.active = true
      AND s.has_wave_data = true
      AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
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

-- Path D: NDBC direct spatial proximity (25km, >= 30° swell overlap, 48h recency)
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
      AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
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
  '(B) IOOS spatial proximity 25km with >= 30° swell overlap (48h recency), '
  '(C) NDBC direct station mapping, NDBC-exclusive only (24h recency), '
  '(D) NDBC direct spatial proximity 25km with >= 30° swell overlap (48h recency). '
  'Expanded Apr 2026 from 15km/IOOS-only to 25km/IOOS+NDBC. '
  'Refreshed every 2h by /api/cron/ioos-sync?phase=observations.';


-- =============================================================================
-- 3. Update get_beach_observation_station with 25km + NDBC fallback
-- =============================================================================

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

  -- Tier 2: IOOS station within 25km with compatible swell (>= 30°)
  SELECT s.station_id INTO v_station_id
  FROM ioos_stations s
  JOIN beaches b ON b.id = p_beach_id
  JOIN beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
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

  -- Tier 4: NDBC direct station within 25km with compatible swell (>= 30°)
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
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 4. Refresh the materialized view
-- =============================================================================

REFRESH MATERIALIZED VIEW observable_beaches;

COMMIT;
