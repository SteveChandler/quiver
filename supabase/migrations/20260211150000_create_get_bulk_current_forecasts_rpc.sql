BEGIN;

-- RPC function: get the "current" forecast wave_height for multiple beaches in one call.
-- Returns exactly 1 row per beach (max rows = array length), eliminating the risk of
-- hitting Supabase's default 1,000-row PostgREST limit that previously caused silent
-- truncation in the bulk forecast API.
--
-- Selection logic mirrors lib/utils/current-forecast-utils.ts getCurrentForecast():
--   1. Today's forecast at or after current time (earliest first)
--   2. Tomorrow's earliest forecast (fallback if no future forecast today)
--   3. Today's most recent past forecast (last resort)

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
      ef.wave_height,
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
  'Returns the current/next forecast wave_height for each beach. '
  'Used by /api/forecasts/bulk to avoid PostgREST row-limit truncation.';

COMMIT;
