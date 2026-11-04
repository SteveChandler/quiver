-- Match forecasts to buoy readings when they are read, instead of Seaside's
-- backfill-observations writing observed_m back onto every ml_predictions_log
-- row (2026-11-03 incident: 2-3 PostgREST calls per row, ~13.7k rows a day,
-- backlog and 8 s timeouts since Oct 30).
--
-- 68% of matched beach-hours come through get_beach_observation_station, not
-- the station's nearest_beach_id, and that function costs ~0.4 s a call. So the
-- beach -> station mapping is resolved once a day into a materialized view and
-- matching joins on station_id, which reproduced 99% of stored matches for
-- Oct 22-28. Existing observed_m values are left in place; nothing writes back.

BEGIN;

CREATE MATERIALIZED VIEW public.beach_observation_stations AS
SELECT mapped.beach_id, mapped.station_id
FROM (
  SELECT b.id AS beach_id, public.get_beach_observation_station(b.id) AS station_id
  FROM public.beaches b
) mapped
WHERE mapped.station_id IS NOT NULL
WITH DATA;

CREATE UNIQUE INDEX beach_observation_stations_beach_id_idx ON public.beach_observation_stations (beach_id);

REVOKE ALL ON public.beach_observation_stations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.beach_observation_stations TO service_role;

COMMENT ON MATERIALIZED VIEW public.beach_observation_stations IS
  'Daily snapshot of get_beach_observation_station per beach, so read-time buoy matching never calls the ~0.4 s resolver per row. Refreshed by refresh_beach_observation_stations().';

CREATE OR REPLACE FUNCTION public.refresh_beach_observation_stations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.beach_observation_stations;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_beach_observation_stations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_beach_observation_stations() TO service_role;

-- One prediction row per match: the nearest reading at the beach's station
-- within ±12 hours of predicted_at (earlier reading on a tie). Predictions with
-- no station or no reading are omitted. NULL p_beach_id means all beaches.
CREATE OR REPLACE FUNCTION public.get_prediction_observations(
  p_beach_id uuid,
  p_since timestamptz,
  p_until timestamptz
)
RETURNS TABLE (
  prediction_id uuid,
  beach_id uuid,
  predicted_at timestamptz,
  forecast_horizon_hours integer,
  forecast_horizon_bucket text,
  raw_display_height_m numeric,
  offset_corrected_display_height_m numeric,
  v5_shadow_height_m numeric,
  wave_height_om real,
  station_id text,
  observed_at timestamptz,
  observed_m numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- PostgREST cancels at 8 s; a month of all beaches is ~18 s, so callers page by beach.
  IF p_until - p_since > interval '31 days' THEN
    RAISE EXCEPTION 'get_prediction_observations: range % to % exceeds 31 days', p_since, p_until
      USING ERRCODE = '22023';
  END IF;

  -- Each beach-hour is logged once per horizon bucket (3 rows), so look the
  -- reading up once per slot and join it back: 33 ms vs 1.4 s for one beach-month.
  RETURN QUERY
  WITH slots AS MATERIALIZED (
    SELECT DISTINCT p.beach_id, p.predicted_at, s.station_id
    FROM public.ml_predictions_log p
    JOIN public.beach_observation_stations s ON s.beach_id = p.beach_id
    WHERE p.predicted_at >= p_since
      AND p.predicted_at < p_until
      AND (p_beach_id IS NULL OR p.beach_id = p_beach_id)
  ),
  matched AS (
    SELECT sl.beach_id, sl.predicted_at, sl.station_id, o.observed_at, o.wave_height_m
    FROM slots sl
    CROSS JOIN LATERAL (
      SELECT u.observed_at, u.wave_height_m
      FROM public.unified_wave_observations u
      WHERE u.station_id = sl.station_id
        AND u.wave_height_m > 0
        AND u.observed_at >= sl.predicted_at - interval '12 hours'
        AND u.observed_at <= sl.predicted_at + interval '12 hours'
      ORDER BY abs(extract(epoch from (u.observed_at - sl.predicted_at))), u.observed_at
      LIMIT 1
    ) o
  )
  SELECT
    p.id,
    p.beach_id,
    p.predicted_at,
    p.forecast_horizon_hours,
    p.forecast_horizon_bucket,
    p.raw_display_height_m,
    p.offset_corrected_display_height_m,
    p.v5_shadow_height_m,
    p.wave_height_om,
    m.station_id,
    m.observed_at,
    m.wave_height_m
  FROM public.ml_predictions_log p
  JOIN matched m ON m.beach_id = p.beach_id AND m.predicted_at = p.predicted_at
  WHERE p.predicted_at >= p_since
    AND p.predicted_at < p_until
    AND (p_beach_id IS NULL OR p.beach_id = p_beach_id)
  ORDER BY p.predicted_at, p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_prediction_observations(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_prediction_observations(uuid, timestamptz, timestamptz) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'refresh-beach-observation-stations';

    PERFORM cron.schedule(
      'refresh-beach-observation-stations',
      '15 9 * * *',
      $cron$SELECT public.refresh_beach_observation_stations();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; beach observation station refresh was not scheduled';
  END IF;
END $$;

COMMIT;
