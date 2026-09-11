BEGIN;
CREATE OR REPLACE FUNCTION public.get_beach_observation_station(p_beach_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_station_id TEXT;
BEGIN
  -- Tier 0: explicit CDIP station override with recent usable wave observations.
  WITH preferred_cdip_station AS (
    SELECT
      'edu_ucsd_cdip_' || lpad(
        nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), ''),
        3,
        '0'
      ) AS station_id
    FROM public.beaches b
    WHERE b.id = p_beach_id
      AND b.cdip_station IS NOT NULL
      AND nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), '') IS NOT NULL
  )
  SELECT preferred_cdip_station.station_id INTO v_station_id
  FROM preferred_cdip_station
  WHERE EXISTS (
    SELECT 1
    FROM public.unified_wave_observations o
    WHERE o.station_id = preferred_cdip_station.station_id
      AND o.observed_at >= now() - interval '7 days'
      AND o.wave_height_m IS NOT NULL
      AND o.wave_height_m > 0
  )
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 1: IOOS station whose nearest_beach_id matches directly.
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND EXISTS (
      SELECT 1 FROM public.unified_wave_observations o
      WHERE o.station_id = s.station_id
        AND o.observed_at >= now() - interval '7 days'
        AND o.wave_height_m > 0
    )
    AND s.nearest_beach_id = p_beach_id
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 2: IOOS station within 25km with compatible swell (>= 30°).
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND EXISTS (
      SELECT 1 FROM public.unified_wave_observations o
      WHERE o.station_id = s.station_id
        AND o.observed_at >= now() - interval '7 days'
        AND o.wave_height_m > 0
    )
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 3: NDBC direct station whose nearest_beach_id matches.
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND EXISTS (
      SELECT 1 FROM public.unified_wave_observations o
      WHERE o.station_id = s.station_id
        AND o.observed_at >= now() - interval '7 days'
        AND o.wave_height_m > 0
    )
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
  ORDER BY s.distance_to_beach_km
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 4: NDBC direct station within 25km with compatible swell (>= 30°).
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND EXISTS (
      SELECT 1 FROM public.unified_wave_observations o
      WHERE o.station_id = s.station_id
        AND o.observed_at >= now() - interval '7 days'
        AND o.wave_height_m > 0
    )
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$function$;


COMMIT;
