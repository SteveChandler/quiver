-- Fix mv_beach_hourly_scores NWS wind join: hourly wind vs off-hour wave timestamps
--
-- Problem:
-- - NWS wind rows (`source='nws_wind'`) are hourly (on-the-hour).
-- - Wave rows (CDIP/NDBC/persistence) are often off-hour (e.g. :30, or with seconds).
-- - Joining wind via nearest timestamp to the wave row can miss due to time axis mismatch and/or
--   insufficient overlap in the selected wind window.
--
-- Solution:
-- - Compute a per-row anchor timestamp rounded to the nearest hour:
--     anchor_ts = date_trunc('hour', m.ts) + (extract(minute from m.ts) >= 30 ? 1h : 0h)
-- - Join NWS wind to anchor_ts (within a small tolerance) so hourly wind matches reliably.
-- - Continue "fill-only": COALESCE(m.wind_*, w_near.wind_*) so NDBC wind is not overridden.
--
-- Notes:
-- - mv_beach_hourly_scores continues to drive off wave rows (exclude source='nws_wind').
-- - refresh_mv_beach_hourly_scores() remains REFRESH-only.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.mv_beach_hourly_scores;

CREATE MATERIALIZED VIEW public.mv_beach_hourly_scores AS
WITH base AS (
  SELECT
    m.*,
    (
      date_trunc('hour', m.ts)
      + CASE WHEN extract(minute from m.ts) >= 30 THEN interval '1 hour' ELSE interval '0 hour' END
    ) AS anchor_ts
  FROM public.marine_forecasts m
  WHERE m.source <> 'nws_wind'
)
SELECT
  bse.beach_id,
  (bse.ts AT TIME ZONE 'UTC') AS ts_utc,
  -- Marine normalized columns (waves from wave rows only)
  bse.wave_height_m AS hs_m,
  bse.wave_period_s AS tp_s,
  bse.wave_direction_deg AS swell_dir_deg,
  (COALESCE(bse.wind_speed_ms, w_near.wind_speed_ms) * 1.94384449)::numeric(6,2) AS wind_spd_kts,
  COALESCE(bse.wind_direction_deg, w_near.wind_direction_deg) AS wind_dir_deg,
  -- Nearest tide within ±90 minutes (feet). Nullable if no tide rows available.
  (t_near.tide_height_m * 3.28084)::numeric(6,2) AS tide_ft,
  -- Computed score (0-100). Uses filled wind signals (fill-only policy).
  ROUND(
    100 * GREATEST(
      0,
      -- wind (40%)
      (0.40 * COALESCE(
        GREATEST(
          0,
          (1 + COS(RADIANS(ABS(MOD(((COALESCE(bse.wind_direction_deg, w_near.wind_direction_deg))::int - b.wind_offshore_deg + 540)::int, 360) - 180))))/2
          * (1 - GREATEST(
              0,
              ((COALESCE(bse.wind_speed_ms, w_near.wind_speed_ms) * 1.94384449)) - COALESCE(b.wind_cross_shore_ok_kt, 8)
            )::float / 10.0)
        ),
        0
      ))
      +
      -- tide (20%)
      (0.20 * COALESCE(
        GREATEST(
          0,
          1 - ABS(((t_near.tide_height_m * 3.28084)) - ((COALESCE(b.preferred_tide_ft_min, 1) + COALESCE(b.preferred_tide_ft_max, 3))/2.0))
                / NULLIF((COALESCE(b.preferred_tide_ft_max, 3) - COALESCE(b.preferred_tide_ft_min, 1))/2.0, 0)
        ),
        0
      ))
      +
      -- swell dir (40%)
      (0.40 * COALESCE(
        (
          WITH params AS (
            SELECT ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
                   b.swell_window_min_deg AS min_deg
          )
          SELECT GREATEST(
            0,
            1 - GREATEST(
                  0,
                  ABS(MOD(((bse.wave_direction_deg)::int - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
                )::float / 30.0
          )
          FROM params
        ),
        0
      ))
    )
  )::int AS score_0_100
FROM base bse
JOIN public.beaches b
  ON b.id = bse.beach_id
LEFT JOIN LATERAL (
  SELECT t.ts, t.tide_height_m
  FROM public.tide_forecasts t
  WHERE t.beach_id = bse.beach_id
    AND t.ts BETWEEN bse.ts - INTERVAL '90 minutes' AND bse.ts + INTERVAL '90 minutes'
  ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - bse.ts)))
  LIMIT 1
) t_near ON TRUE
LEFT JOIN LATERAL (
  SELECT w.ts, w.wind_speed_ms, w.wind_direction_deg
  FROM public.marine_forecasts w
  WHERE w.beach_id = bse.beach_id
    AND w.source = 'nws_wind'
    -- Match hourly wind to the rounded hour anchor (small tolerance)
    AND w.ts BETWEEN bse.anchor_ts - INTERVAL '5 minutes' AND bse.anchor_ts + INTERVAL '5 minutes'
  ORDER BY ABS(EXTRACT(EPOCH FROM (w.ts - bse.anchor_ts)))
  LIMIT 1
) w_near ON TRUE
WHERE b.is_private = false;

CREATE INDEX IF NOT EXISTS idx_mv_vbhs_beach_ts
  ON public.mv_beach_hourly_scores (beach_id, ts_utc);

COMMENT ON MATERIALIZED VIEW public.mv_beach_hourly_scores IS
  'Precomputed wave rows joined to nearest tide (±90m) and hourly nws_wind via rounded-hour anchor (±5m), with computed score_0_100. Keyed by (beach_id, ts_utc).';

GRANT SELECT ON public.mv_beach_hourly_scores TO anon;
GRANT SELECT ON public.mv_beach_hourly_scores TO authenticated;
GRANT SELECT ON public.mv_beach_hourly_scores TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_beach_hourly_scores;
END;
$$;

COMMENT ON FUNCTION public.refresh_mv_beach_hourly_scores() IS
  'Refresh mv_beach_hourly_scores (wind filled from nws_wind via rounded-hour anchor).';

COMMIT;






