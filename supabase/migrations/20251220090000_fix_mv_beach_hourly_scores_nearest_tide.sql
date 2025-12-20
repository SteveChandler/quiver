-- Fix mv_beach_hourly_scores empty-result bug
--
-- Problem:
-- - mv_beach_hourly_scores was built with an INNER JOIN on exact (beach_id, ts) between
--   marine_forecasts and tide_forecasts.
-- - In production, marine_forecasts.ts is often not aligned to whole hours (e.g. :30 or even with seconds),
--   while tide_forecasts.ts is typically hourly (:00). This yields 0 matching rows → MV empty.
--
-- Solution:
-- - Rebuild mv_beach_hourly_scores using marine_forecasts as the driving table and attach the nearest tide
--   forecast within ±90 minutes via LEFT JOIN LATERAL (mirrors v_beach_hourly_scores strategy).
-- - Keep the same output column names and types so dependent queries and refresh functions remain compatible.
--
-- Notes:
-- - tide_ft will be NULL when no tide value exists within the window; scoring functions COALESCE to 0.
-- - score_0_100 remains a placeholder column and is computed by refresh_mv_beach_hourly_scores().
--
BEGIN;
  DROP MATERIALIZED VIEW IF EXISTS public.mv_beach_hourly_scores;

  CREATE MATERIALIZED VIEW public.mv_beach_hourly_scores AS
  SELECT
    m.beach_id,
    (m.ts AT TIME ZONE 'UTC') AS ts_utc,
    -- Marine normalized columns
    m.wave_height_m               AS hs_m,
    m.wave_period_s               AS tp_s,
    m.wave_direction_deg          AS swell_dir_deg,
    (m.wind_speed_ms * 1.94384449)::numeric(6,2) AS wind_spd_kts,
    m.wind_direction_deg          AS wind_dir_deg,
    -- Nearest tide within ±90 minutes (feet). Nullable if no tide rows available.
    (t_near.tide_height_m * 3.28084)::numeric(6,2) AS tide_ft,
    0::int AS score_0_100
  FROM public.marine_forecasts m
  LEFT JOIN LATERAL (
    SELECT t.ts, t.tide_height_m
    FROM public.tide_forecasts t
    WHERE t.beach_id = m.beach_id
      AND t.ts BETWEEN m.ts - INTERVAL '90 minutes' AND m.ts + INTERVAL '90 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - m.ts)))
    LIMIT 1
  ) t_near ON TRUE;

  CREATE INDEX IF NOT EXISTS idx_mv_vbhs_beach_ts
    ON public.mv_beach_hourly_scores (beach_id, ts_utc);

  COMMENT ON MATERIALIZED VIEW public.mv_beach_hourly_scores IS
    'Precomputed hourly-ish marine rows joined to nearest tide (±90m). Keyed by (beach_id, ts_utc). score_0_100 is computed via refresh routine.';

  -- Public pages and APIs need read access.
  GRANT SELECT ON public.mv_beach_hourly_scores TO anon;
  GRANT SELECT ON public.mv_beach_hourly_scores TO authenticated;
  GRANT SELECT ON public.mv_beach_hourly_scores TO service_role;
COMMIT;

