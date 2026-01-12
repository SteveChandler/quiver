-- Add NOAA/NWS wind-only rows support and fill missing wind in mv_beach_hourly_scores
--
-- Summary:
-- - Expand allowed `source` values for `marine_forecasts` to include:
--   - cdip_persistence / ndbc_persistence (used by cron)
--   - nws_wind (new wind-only hourly ingest)
-- - Expand allowed `source` values for `tide_forecasts` to include:
--   - noaa_hilo_interpolated (used by cron fallback)
-- - Rebuild mv_beach_hourly_scores to:
--   - drive off wave rows (exclude source='nws_wind')
--   - left join nearest nws_wind row (±90m) and fill wind when wave wind is NULL
--   - keep nearest tide join (±90m) and compute score_0_100 inside the MV
--
-- Notes:
-- - This is a permissive source allowlist (includes legacy 'open-meteo' for compatibility).
-- - refresh_mv_beach_hourly_scores() remains REFRESH-only (materialized views are not updatable).

BEGIN;

-- 1) Expand allowed sources (guarded drops and recreate)
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.marine_forecasts') IS NOT NULL THEN
    -- Drop any existing check constraints that mention source/open-meteo on marine_forecasts
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'marine_forecasts'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%source%'
    LOOP
      -- Only drop constraints that look like the source allowlist; avoid dropping unrelated checks.
      IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = r.conname AND conrelid = 'public.marine_forecasts'::regclass LIMIT 1)) ILIKE '%open-meteo%'
         OR pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = r.conname AND conrelid = 'public.marine_forecasts'::regclass LIMIT 1)) ILIKE '%cdip%'
         OR pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = r.conname AND conrelid = 'public.marine_forecasts'::regclass LIMIT 1)) ILIKE '%ndbc%' THEN
        EXECUTE format('ALTER TABLE public.marine_forecasts DROP CONSTRAINT %I', r.conname);
      END IF;
    END LOOP;

    BEGIN
      ALTER TABLE public.marine_forecasts DROP CONSTRAINT IF EXISTS marine_forecasts_source_chk;
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      ALTER TABLE public.marine_forecasts DROP CONSTRAINT IF EXISTS marine_forecasts_source_check;
    EXCEPTION WHEN others THEN NULL; END;

    ALTER TABLE public.marine_forecasts
      ADD CONSTRAINT marine_forecasts_source_check
      CHECK (
        source IN (
          'open-meteo',
          'cdip',
          'ndbc',
          'cdip_persistence',
          'ndbc_persistence',
          'nws_wind'
        )
      );
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.tide_forecasts') IS NOT NULL THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'tide_forecasts'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%source%'
    LOOP
      IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = r.conname AND conrelid = 'public.tide_forecasts'::regclass LIMIT 1)) ILIKE '%noaa%'
         OR pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = r.conname AND conrelid = 'public.tide_forecasts'::regclass LIMIT 1)) ILIKE '%open-meteo%' THEN
        EXECUTE format('ALTER TABLE public.tide_forecasts DROP CONSTRAINT %I', r.conname);
      END IF;
    END LOOP;

    BEGIN
      ALTER TABLE public.tide_forecasts DROP CONSTRAINT IF EXISTS tide_forecasts_source_chk;
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      ALTER TABLE public.tide_forecasts DROP CONSTRAINT IF EXISTS tide_forecasts_source_check;
    EXCEPTION WHEN others THEN NULL; END;

    ALTER TABLE public.tide_forecasts
      ADD CONSTRAINT tide_forecasts_source_check
      CHECK (source IN ('open-meteo', 'noaa', 'noaa_hilo_interpolated'));
  END IF;
END $$;

-- 2) Rebuild mv_beach_hourly_scores with wind fill from nws_wind
DROP MATERIALIZED VIEW IF EXISTS public.mv_beach_hourly_scores;

CREATE MATERIALIZED VIEW public.mv_beach_hourly_scores AS
SELECT
  m.beach_id,
  (m.ts AT TIME ZONE 'UTC') AS ts_utc,
  -- Marine normalized columns (waves from wave rows only)
  m.wave_height_m AS hs_m,
  m.wave_period_s AS tp_s,
  m.wave_direction_deg AS swell_dir_deg,
  (COALESCE(m.wind_speed_ms, w_near.wind_speed_ms) * 1.94384449)::numeric(6,2) AS wind_spd_kts,
  COALESCE(m.wind_direction_deg, w_near.wind_direction_deg) AS wind_dir_deg,
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
          (1 + COS(RADIANS(ABS(MOD(((COALESCE(m.wind_direction_deg, w_near.wind_direction_deg))::int - b.wind_offshore_deg + 540)::int, 360) - 180))))/2
          * (1 - GREATEST(
              0,
              ((COALESCE(m.wind_speed_ms, w_near.wind_speed_ms) * 1.94384449)) - COALESCE(b.wind_cross_shore_ok_kt, 8)
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
LEFT JOIN LATERAL (
  SELECT w.ts, w.wind_speed_ms, w.wind_direction_deg
  FROM public.marine_forecasts w
  WHERE w.beach_id = m.beach_id
    AND w.source = 'nws_wind'
    AND w.ts BETWEEN m.ts - INTERVAL '90 minutes' AND m.ts + INTERVAL '90 minutes'
  ORDER BY ABS(EXTRACT(EPOCH FROM (w.ts - m.ts)))
  LIMIT 1
) w_near ON TRUE
WHERE b.is_private = false
  AND m.source <> 'nws_wind';

CREATE INDEX IF NOT EXISTS idx_mv_vbhs_beach_ts
  ON public.mv_beach_hourly_scores (beach_id, ts_utc);

COMMENT ON MATERIALIZED VIEW public.mv_beach_hourly_scores IS
  'Precomputed wave rows joined to nearest tide (±90m) and nearest nws_wind (±90m) with computed score_0_100. Keyed by (beach_id, ts_utc).';

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
  'Refresh mv_beach_hourly_scores (score_0_100 computed in MV definition; wind filled from nws_wind when missing).';

COMMIT;











