-- Fix mv_beach_hourly_scores scoring: materialized views are not updatable
--
-- Problem:
-- - Postgres materialized views cannot be updated (INSERT/UPDATE/DELETE).
-- - refresh_mv_beach_hourly_scores() previously attempted UPDATE ... SET score_0_100 = ...
--   which fails with:
--     ERROR: 42809: cannot change materialized view "mv_beach_hourly_scores"
--
-- Solution:
-- - Rebuild mv_beach_hourly_scores so score_0_100 is computed in the MV SELECT itself.
-- - Recreate refresh_mv_beach_hourly_scores() to only REFRESH MATERIALIZED VIEW (no UPDATE).
--
-- Notes:
-- - Uses nearest tide within ±90 minutes (same strategy as v_beach_hourly_scores).
-- - Uses constant weights (wind 0.4, tide 0.2, swell dir 0.4) to avoid relying on missing w_* columns.
-- - Null safety: if any signal is missing, its component contributes 0.
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
    -- Computed score (0-100)
    ROUND(
      100 * GREATEST(
        0,
        -- wind (40%)
        (0.40 * COALESCE(
          GREATEST(
            0,
            (1 + COS(RADIANS(ABS(MOD(((m.wind_direction_deg)::int - b.wind_offshore_deg + 540)::int, 360) - 180))))/2
            * (1 - GREATEST(0, ((m.wind_speed_ms * 1.94384449)) - COALESCE(b.wind_cross_shore_ok_kt, 8))::float / 10.0)
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
                    ABS(MOD(((m.wave_direction_deg)::int - ((min_deg + span/2.0)) + 540)::int, 360) - 180) - (span/2.0)
                  )::float / 30.0
            )
            FROM params
          ),
          0
        ))
      )
    )::int AS score_0_100
  FROM public.marine_forecasts m
  JOIN public.beaches b
    ON b.id = m.beach_id
  LEFT JOIN LATERAL (
    SELECT t.ts, t.tide_height_m
    FROM public.tide_forecasts t
    WHERE t.beach_id = m.beach_id
      AND t.ts BETWEEN m.ts - INTERVAL '90 minutes' AND m.ts + INTERVAL '90 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - m.ts)))
    LIMIT 1
  ) t_near ON TRUE
  WHERE b.is_private = false;

  CREATE INDEX IF NOT EXISTS idx_mv_vbhs_beach_ts
    ON public.mv_beach_hourly_scores (beach_id, ts_utc);

  COMMENT ON MATERIALIZED VIEW public.mv_beach_hourly_scores IS
    'Precomputed marine rows joined to nearest tide (±90m) with computed score_0_100. Keyed by (beach_id, ts_utc).';

  GRANT SELECT ON public.mv_beach_hourly_scores TO anon;
  GRANT SELECT ON public.mv_beach_hourly_scores TO authenticated;
  GRANT SELECT ON public.mv_beach_hourly_scores TO service_role;

  -- Refresh function should only refresh the MV (materialized views are not updatable).
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
    'Refresh mv_beach_hourly_scores (score_0_100 computed in MV definition).';
COMMIT;

