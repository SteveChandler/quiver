BEGIN;

-- OM-primary wave-height selection inside get_bulk_current_forecasts.
-- Mirrors the write-site selector at lib/utils/wave-height-selector.ts so the
-- bulk path for /api/forecasts/bulk returns the same height every downstream
-- reader sees. Raw Open-Meteo Hs at >=0.95m beats v3-corrected by ~35% MAE in
-- production matches (n=10,599). Below the gate, OM overshoots observed <0.5m
-- by +0.45m, so small-wave paths keep the existing wave_height string.
--
-- Signature unchanged (beach_id UUID, wave_height TEXT, forecast_date DATE,
-- forecast_time TIME) — callers in app/api/forecasts/bulk don't need to
-- change.

CREATE OR REPLACE FUNCTION public.get_bulk_current_forecasts(
  p_beach_ids UUID[],
  p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  beach_id UUID,
  wave_height TEXT,
  forecast_date DATE,
  forecast_time TIME
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      ef.beach_id,
      CASE
        WHEN ef.wave_height_om IS NOT NULL AND ef.wave_height_om >= 0.95
        THEN ROUND((ef.wave_height_om * 3.28084)::numeric, 1)::text || ' ft'
        ELSE ef.wave_height
      END AS wave_height,
      ef.forecast_date,
      ef.forecast_time,
      ROW_NUMBER() OVER (
        PARTITION BY ef.beach_id
        ORDER BY
          -- Priority bucket: today-future(1), tomorrow(2), today-past(3)
          CASE
            WHEN ef.forecast_date = p_target_date
                 AND ef.forecast_time >= CURRENT_TIME THEN 1
            WHEN ef.forecast_date = p_target_date + 1 THEN 2
            ELSE 3
          END ASC,
          -- Within bucket: future/tomorrow sort earliest-first (ASC),
          -- past-today sort latest-first (DESC via negation)
          CASE
            WHEN ef.forecast_date = p_target_date
                 AND ef.forecast_time < CURRENT_TIME
            THEN -EXTRACT(EPOCH FROM ef.forecast_time)
            ELSE  EXTRACT(EPOCH FROM ef.forecast_time)
          END ASC
      ) AS rn
    FROM enhanced_forecasts ef
    WHERE ef.beach_id = ANY(p_beach_ids)
      AND ef.forecast_date IN (p_target_date, p_target_date + 1)
  )
  SELECT r.beach_id, r.wave_height, r.forecast_date, r.forecast_time
  FROM ranked r
  WHERE r.rn = 1;
$$;

COMMENT ON FUNCTION public.get_bulk_current_forecasts IS
  'Returns the current/next forecast wave_height for each beach, applying '
  'the OM-primary selector (>=0.95m) to match lib/utils/wave-height-selector.ts. '
  'Used by /api/forecasts/bulk to avoid PostgREST row-limit truncation.';

COMMIT;
