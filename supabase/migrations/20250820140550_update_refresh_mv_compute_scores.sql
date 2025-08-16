-- Refresh function now also computes score_0_100 using beach preferences & weights
-- Mirrors TS weights with DB-stored per-beach weights when available

CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_beach_hourly_scores;

  UPDATE public.mv_beach_hourly_scores mv
  SET score_0_100 = GREATEST(
    0,
    (
      ROUND((100 * (
        -- wind
        (COALESCE(b.w_wind, 0.30) * GREATEST(
          0,
          (1 + COS(RADIANS(ABS(MOD(((mv.wind_dir_deg)::int - b.wind_offshore_deg + 540)::int, 360) - 180))))/2
          * (1 - GREATEST(0, (mv.wind_spd_kts) - COALESCE(b.wind_cross_shore_ok_kt, 8))::float / 10.0)
        )))
        +
        -- tide
        (COALESCE(b.w_tide, 0.20) * COALESCE(
          GREATEST(
            0,
            1 - ABS((mv.tide_ft) - ((COALESCE(b.preferred_tide_ft_min, 1) + COALESCE(b.preferred_tide_ft_max, 3))/2.0))
                  / NULLIF((COALESCE(b.preferred_tide_ft_max, 3) - COALESCE(b.preferred_tide_ft_min, 1))/2.0, 0)
          ),
          0
        )))
        +
        -- swell dir
        (COALESCE(b.w_swell, 0.25) * (
          WITH params AS (
            SELECT ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS span,
                   b.swell_window_min_deg AS min_deg
          )
          SELECT GREATEST(
            0,
            1 - GREATEST(
                  0,
                  ABS(MOD(((mv.swell_dir_deg)::int - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
                )::float / 30.0
          )
          FROM params
        ))
        + (COALESCE(b.w_period, 0.15) * 0)
        + (COALESCE(b.w_height, 0.10) * 0)
      ))::int
    )
  FROM public.beaches b
  WHERE b.id = mv.beach_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_mv_beach_hourly_scores() IS 'Refresh + compute scores for mv_beach_hourly_scores (mirrors TS weights; period/height placeholders)';

