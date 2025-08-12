-- Recreate mv_best_times with edge-case handling
-- - Skips incomplete 2h windows
-- - Applies strong onshore wind hard penalty
-- - Flags advanced_only when wave height is high and beach skill != advanced

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.mv_best_times;

CREATE MATERIALIZED VIEW public.mv_best_times AS
WITH base AS (
  SELECT
    m.beach_id,
    m.ts AS ts_utc,
    -- raw hourly score from view
    v.score_0_100,
    -- wind data
    m.wind_direction_deg,
    (m.wind_speed_ms * 1.94384449) AS wind_speed_kt,
    -- wave height in ft (for advanced flag)
    (m.wave_height_m * 3.28084) AS wave_height_ft,
    -- beach prefs
    b.wind_offshore_deg,
    b.wind_onshore_bad_kt,
    COALESCE(b.skill_level, 'intermediate') AS skill_level
  FROM public.marine_forecasts m
  JOIN public.v_beach_hourly_scores v
    ON v.beach_id = m.beach_id AND v.ts_utc = m.ts
  JOIN public.beaches b
    ON b.id = m.beach_id
  WHERE m.ts >= now() AND m.ts < (now() + interval '72 hours')
), penalized AS (
  SELECT
    beach_id,
    ts_utc,
    -- Strong onshore penalty: if angle ~ onshore (>=150° from offshore) AND speed > onshore_bad_kt, zero out contribution
    CASE
      WHEN ABS(MOD((wind_direction_deg - wind_offshore_deg + 540)::int, 360) - 180) >= 150
           AND wind_speed_kt > COALESCE(wind_onshore_bad_kt, 12)
      THEN 0
      ELSE score_0_100
    END AS score_0_100_adj,
    wave_height_ft,
    skill_level
  FROM base
), win AS (
  SELECT
    h1.beach_id,
    h1.ts_utc AS start_ts,
    h1.ts_utc + interval '2 hour' AS end_ts,
    ROUND(AVG(h2.score_0_100_adj))::int AS score,
    COUNT(*) AS ct
  FROM penalized h1
  JOIN penalized h2
    ON h2.beach_id = h1.beach_id
   AND h2.ts_utc BETWEEN h1.ts_utc AND h1.ts_utc + interval '1 hour'
  GROUP BY h1.beach_id, h1.ts_utc
  HAVING COUNT(*) = 2 -- require complete window
), ranked AS (
  SELECT
    w.beach_id,
    w.start_ts,
    w.end_ts,
    CASE
      WHEN w.score >= 85 THEN 'epic'
      WHEN w.score >= 70 THEN 'good'
      WHEN w.score >= 55 THEN 'fair'
      ELSE 'poor'
    END AS grade,
    w.score
  FROM win w
), advanced_flag AS (
  -- Determine if at the window start the height is high for non-advanced spots
  SELECT
    p.beach_id,
    p.ts_utc AS start_ts,
    (p.wave_height_ft > 6.0 AND LOWER(p.skill_level) <> 'advanced') AS advanced_only
  FROM penalized p
)
SELECT
  r.beach_id,
  r.start_ts,
  r.end_ts,
  r.grade,
  r.score,
  COALESCE(a.advanced_only, false) AS advanced_only,
  now() AS updated_at
FROM ranked r
LEFT JOIN advanced_flag a
  ON a.beach_id = r.beach_id AND a.start_ts = r.start_ts;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_best_times_beach_start
  ON public.mv_best_times (beach_id, start_ts);
CREATE INDEX IF NOT EXISTS idx_mv_best_times_beach_score
  ON public.mv_best_times (beach_id, score DESC);

-- Refresh function (recreate idempotently)
CREATE OR REPLACE FUNCTION public.refresh_mv_best_times()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_best_times;
END;
$$;

COMMIT;
