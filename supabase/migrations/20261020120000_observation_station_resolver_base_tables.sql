BEGIN;

-- get_beach_observation_station checked "recent wave data" through the
-- unified_wave_observations view (UNION ALL of two joined observation tables).
-- Postgres cannot push the station predicate into it, so every EXISTS hashed the
-- last 7 days of both tables (~46k rows, ~16k buffers, ~60 ms) per tier. The
-- function is DB time sink #1 (930k RPC calls, ~99,700 s) and the 364-beach
-- refresh of observable_beaches / mv_nowcast_anchors (hourly, mean 33 s, max
-- 115 s) is that cost times the beach count, which starves visitor queries into
-- statement timeouts (57014).
--
-- Same station choice, read from the base tables whose (station_id, observed_at)
-- indexes serve each EXISTS. Verified equal on live data: the set of stations
-- passing the old view check and the new check is identical (174 = 174, no
-- station_id exists in both ioos_stations and ndbc_direct_stations).
SET LOCAL lock_timeout = '5s';

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
    FROM public.ioos_observations o
    JOIN public.ioos_stations s ON s.station_id = o.station_id
    WHERE o.station_id = preferred_cdip_station.station_id
      AND s.active = true
      AND o.observed_at >= now() - interval '7 days'
      AND o.wave_height_m > 0
  ) OR EXISTS (
    SELECT 1
    FROM public.ndbc_direct_observations o
    JOIN public.ndbc_direct_stations s ON s.station_id = o.station_id
    WHERE o.station_id = preferred_cdip_station.station_id
      AND s.active = true
      AND (
        s.ioos_station_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.ioos_stations iss
          WHERE iss.station_id = s.ioos_station_id AND iss.active = true
        )
      )
      AND o.observed_at >= now() - interval '7 days'
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
      SELECT 1 FROM public.ioos_observations o
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
      SELECT 1 FROM public.ioos_observations o
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
      SELECT 1 FROM public.ndbc_direct_observations o
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
      SELECT 1 FROM public.ndbc_direct_observations o
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
