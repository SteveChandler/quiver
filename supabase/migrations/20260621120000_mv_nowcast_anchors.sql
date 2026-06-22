-- Materialize get_nowcast_anchors.
-- It was 39.5% of total DB time: ~20k request-path calls @ 1.87s each, every one
-- rescanning all ~300 observable beaches (get_beach_observation_station per beach +
-- DISTINCT ON over unified_wave_observations). The underlying obs only change hourly,
-- so recomputing per request is waste. Materialize it; the RPC becomes an indexed read.
-- Refreshed inside the existing refresh_observable_beaches() — no new cron.
BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_nowcast_anchors AS
WITH resolved AS (
  SELECT ob.beach_id, get_beach_observation_station(ob.beach_id) AS station_id
  FROM observable_beaches ob
)
SELECT DISTINCT ON (r.beach_id)
  r.beach_id,
  r.station_id,
  uwo.observed_at,
  uwo.wave_height_m,
  uwo.wave_period_s,
  uwo.wave_direction_deg
FROM resolved r
JOIN unified_wave_observations uwo ON uwo.station_id = r.station_id
WHERE r.station_id IS NOT NULL
  -- ponytail: 48h cap bounds matview size; read-time filter trims to max_age_hours.
  -- Widen only if a caller ever needs anchors older than 48h.
  AND uwo.observed_at >= NOW() - INTERVAL '48 hours'
  AND uwo.wave_height_m IS NOT NULL
ORDER BY r.beach_id, uwo.observed_at DESC
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_nowcast_anchors_beach_id_idx
  ON mv_nowcast_anchors (beach_id);

GRANT SELECT ON mv_nowcast_anchors TO authenticated, anon, service_role;

-- Same signature + return shape => callers and generated types unchanged.
-- Age filter now runs at read time against the stored observed_at (real observation
-- age, independent of refresh time), so freshness semantics are identical.
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
  SELECT beach_id, station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg
  FROM mv_nowcast_anchors
  WHERE observed_at >= NOW() - (max_age_hours || ' hours')::INTERVAL;
$$;

-- Refresh anchors right after observable_beaches (anchors read it, so order matters).
-- Mirrors the CONCURRENTLY pattern already proven in this function.
CREATE OR REPLACE FUNCTION public.refresh_observable_beaches()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_nowcast_anchors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON MATERIALIZED VIEW mv_nowcast_anchors IS
  'Latest buoy anchor per observable beach (<=48h). Backs get_nowcast_anchors() as an '
  'indexed read instead of a per-request ~1.9s scan. Refreshed by refresh_observable_beaches().';

COMMIT;
