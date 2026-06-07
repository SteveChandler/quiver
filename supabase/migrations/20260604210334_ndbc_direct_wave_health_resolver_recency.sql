BEGIN;

-- Add explicit wave-source health metadata for NDBC direct stations. The
-- existing has_wave_data flag represents station capability; these fields track
-- the latest observation-fetch outcome used by resolver/audit logic.

ALTER TABLE public.ndbc_direct_stations
  ADD COLUMN IF NOT EXISTS last_wave_fetch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_wave_fetch_status TEXT
    CHECK (
      last_wave_fetch_status IS NULL
      OR last_wave_fetch_status IN ('ok', 'no_wave_data', 'not_found', 'error')
    ),
  ADD COLUMN IF NOT EXISTS last_wave_observed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ndbc_direct_stations_wave_health
  ON public.ndbc_direct_stations(active, has_wave_data, last_wave_observed_at DESC);

WITH latest_wave AS (
  SELECT station_id, MAX(observed_at) AS latest_observed_at
  FROM public.ndbc_direct_observations
  WHERE wave_height_m IS NOT NULL
  GROUP BY station_id
)
UPDATE public.ndbc_direct_stations s
SET
  last_wave_observed_at = latest_wave.latest_observed_at,
  last_wave_fetch_status = COALESCE(s.last_wave_fetch_status, 'ok')
FROM latest_wave
WHERE latest_wave.station_id = s.station_id
  AND (
    s.last_wave_observed_at IS NULL
    OR latest_wave.latest_observed_at > s.last_wave_observed_at
  );

CREATE OR REPLACE FUNCTION get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  -- Tier 1: IOOS station whose nearest_beach_id matches directly and has fresh waves
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND EXISTS (
      SELECT 1 FROM public.ioos_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '24 hours'
    )
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 2: IOOS station within 50km with compatible swell and fresh waves
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND extensions.ST_DWithin(b.geog, s.coordinates::extensions.geography, 50000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
    AND EXISTS (
      SELECT 1 FROM public.ioos_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '48 hours'
    )
  ORDER BY extensions.ST_Distance(b.geog, s.coordinates::extensions.geography)
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 3: NDBC direct station whose nearest_beach_id matches and has fresh waves
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.ndbc_direct_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '24 hours'
    )
  ORDER BY s.distance_to_beach_km
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 4: NDBC direct station within 50km with compatible swell and fresh waves
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND extensions.ST_DWithin(b.geog, s.coordinates::extensions.geography, 50000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
    AND EXISTS (
      SELECT 1 FROM public.ndbc_direct_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '48 hours'
    )
  ORDER BY extensions.ST_Distance(b.geog, s.coordinates::extensions.geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_beach_observation_station(UUID) IS
  'Returns the active wave station used for ML observation matching. Direct mappings are preferred, then IOOS/NDBC-direct spatial fallback within 50km and >= 30 degrees swell overlap. Each tier requires recent positive source observations so stale/no-wave stations are not selected.';

GRANT EXECUTE ON FUNCTION get_beach_observation_station(UUID)
TO authenticated, anon, service_role;

COMMIT;
