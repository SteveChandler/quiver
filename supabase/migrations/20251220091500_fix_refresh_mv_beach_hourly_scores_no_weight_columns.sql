-- Fix refresh_mv_beach_hourly_scores() for schemas without per-beach weight columns
--
-- Problem:
-- - Production beaches schema does not include b.w_wind / b.w_tide / b.w_swell / b.w_period / b.w_height.
-- - refresh_mv_beach_hourly_scores() references those columns, causing runtime failure:
--     ERROR: column b.w_wind does not exist
--
-- Solution:
-- - Recreate refresh_mv_beach_hourly_scores() to compute score_0_100 using constant weights:
--     wind: 0.4, tide: 0.2, swell dir: 0.4
--   This matches the v_beach_hourly_scores scoring weights and keeps behavior consistent across paths.
--
-- Notes:
-- - tide_ft can be NULL (if no tide row exists within ±90m). Tide component COALESCEs to 0.
-- - period/height components remain placeholders (0) until those signals are wired end-to-end.
--
CREATE OR REPLACE FUNCTION public.refresh_mv_beach_hourly_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Rebuild MV rows (marine + nearest tide) first
  REFRESH MATERIALIZED VIEW public.mv_beach_hourly_scores;

  -- Compute per-row score_0_100 using beach-specific configuration fields (no weight columns required)
  UPDATE public.mv_beach_hourly_scores mv
  SET score_0_100 = GREATEST(
    0,
    ROUND(
      100
      * GREATEST(
          0,
          -- wind (40%)
          (0.40 * GREATEST(
            0,
            (1 + COS(RADIANS(ABS(MOD(((mv.wind_dir_deg)::int - b.wind_offshore_deg + 540)::int, 360) - 180))))/2
            * (1 - GREATEST(0, (mv.wind_spd_kts) - COALESCE(b.wind_cross_shore_ok_kt, 8))::float / 10.0)
          ))
          +
          -- tide (20%)
          (0.20 * COALESCE(
            GREATEST(
              0,
              1 - ABS((mv.tide_ft) - ((COALESCE(b.preferred_tide_ft_min, 1) + COALESCE(b.preferred_tide_ft_max, 3))/2.0))
                    / NULLIF((COALESCE(b.preferred_tide_ft_max, 3) - COALESCE(b.preferred_tide_ft_min, 1))/2.0, 0)
            ),
            0
          ))
          +
          -- swell dir (40%)
          (0.40 * (
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
        )
    )::int
  )
  FROM public.beaches b
  WHERE b.id = mv.beach_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_mv_beach_hourly_scores() IS
  'Refresh mv_beach_hourly_scores and compute score_0_100 using constant weights (wind 0.4, tide 0.2, swell 0.4) for schemas without per-beach weight columns.';

