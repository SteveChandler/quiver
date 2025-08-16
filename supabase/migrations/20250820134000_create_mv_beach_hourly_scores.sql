-- Materialized view to precompute hourly marine+tide join for speed
-- Does not include scoring logic; score_0_100 is a placeholder to allow future refresh-based computation

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_beach_hourly_scores AS
SELECT
  m.beach_id,
  (m.ts AT TIME ZONE 'UTC') AS ts_utc,
  -- Marine normalized columns
  m.wave_height_m               AS hs_m,
  m.wave_period_s               AS tp_s,
  m.wave_direction_deg          AS swell_dir_deg,
  (m.wind_speed_ms * 1.94384449)::numeric(6,2) AS wind_spd_kts,
  m.wind_direction_deg          AS wind_dir_deg,
  -- Tide normalized to feet
  (t.tide_height_m * 3.28084)::numeric(6,2) AS tide_ft,
  0::int AS score_0_100
FROM public.marine_forecasts m
JOIN public.tide_forecasts t
  ON t.beach_id = m.beach_id AND t.ts = m.ts;

CREATE INDEX IF NOT EXISTS idx_mv_vbhs_beach_ts
  ON public.mv_beach_hourly_scores (beach_id, ts_utc);

COMMENT ON MATERIALIZED VIEW public.mv_beach_hourly_scores IS
  'Precomputed hourly marine+tide join keyed by (beach_id, ts_utc). score_0_100 is placeholder; computed via separate refresh routine.';

