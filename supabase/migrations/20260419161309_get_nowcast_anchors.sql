-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE OR REPLACE FUNCTION public.get_nowcast_anchors(max_age_hours NUMERIC DEFAULT 6.0)
RETURNS TABLE (
  beach_id UUID,
  station_id TEXT,
  observed_at TIMESTAMPTZ,
  wave_height_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction_deg NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH resolved AS (
    SELECT
      ob.beach_id,
      get_beach_observation_station(ob.beach_id) AS station_id
    FROM observable_beaches ob
  ),
  latest AS (
    SELECT DISTINCT ON (r.beach_id)
      r.beach_id,
      r.station_id,
      uwo.observed_at,
      uwo.wave_height_m,
      uwo.wave_period_s,
      uwo.wave_direction_deg
    FROM resolved r
    JOIN unified_wave_observations uwo
      ON uwo.station_id = r.station_id
    WHERE r.station_id IS NOT NULL
      AND uwo.observed_at >= NOW() - (max_age_hours || ' hours')::INTERVAL
      AND uwo.wave_height_m IS NOT NULL
    ORDER BY r.beach_id, uwo.observed_at DESC
  )
  SELECT beach_id, station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg
  FROM latest;
$$;

GRANT EXECUTE ON FUNCTION public.get_nowcast_anchors(NUMERIC) TO authenticated, service_role, anon;

COMMENT ON FUNCTION public.get_nowcast_anchors IS
  'Returns the latest buoy observation per observable beach within max_age_hours (default 6h). '
  'Beaches without a matched station or recent observation are omitted. '
  'Used by enhanced-forecast-sync to anchor nowcast wave heights on ground truth.';
