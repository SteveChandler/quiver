-- Adds get_nowcast_anchors: batched latest-observation lookup per observable beach.
-- Used by enhanced-forecast-sync cron to anchor the nowcast display on real buoy
-- observations instead of NOAA forecasts (Option B, plan golden-sleeping-steele.md).
--
-- Default max_age_hours=6.0 accommodates CDIP-via-IOOS staleness: the IOOS
-- sync cron runs every 2h, and CDIP data is already 1–3h old when fetched,
-- so total in-DB staleness can reach 5h. 6h catches 99% of observable beaches
-- (coverage measured 2026-04-19). NDBC-direct beaches get fresher (<0.5h).
--
-- Rationale for accepting stale obs: when the forecast is demonstrably wrong
-- (e.g., NOAA NWPS hallucinating a ghost swell — see OB Pier 2026-04-19),
-- even a 4h-old buoy reading is materially closer to present reality than
-- the faulty forecast. Swells don't swing 100% in 6h. Caller is responsible
-- for surfacing observation timestamp so UI can show "observed Xh ago" if
-- the staleness warrants transparency.
--
-- The forecast-side "nowcast window" (±1.5h of build time) stays tight —
-- this freshness window only controls what counts as a valid anchor
-- candidate; the nowcast window controls which forecast rows the anchor
-- is allowed to override.

BEGIN;

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

COMMIT;
