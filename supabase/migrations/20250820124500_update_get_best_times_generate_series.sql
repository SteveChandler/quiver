-- Improve get_best_times to generate hourly series and use nearest marine/tide within a window
-- This avoids requiring dense hourly marine rows and works with sparse observed data only.

BEGIN;

DROP FUNCTION IF EXISTS public.get_best_times(uuid, timestamptz, timestamptz, int);

CREATE OR REPLACE FUNCTION public.get_best_times(
  p_beach uuid,
  p_start timestamptz,
  p_end   timestamptz,
  p_limit int DEFAULT 6
)
RETURNS TABLE (
  start_ts timestamptz,
  end_ts   timestamptz,
  label    text,
  score    int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
  SELECT 
    b.id AS beach_id,
    b.wind_offshore_deg,
    b.wind_cross_shore_ok_kt,
    b.preferred_tide_ft_min,
    b.preferred_tide_ft_max,
    ((b.swell_window_max_deg - b.swell_window_min_deg + 360) % 360) AS swell_span,
    b.swell_window_min_deg AS swell_min
  FROM public.beaches b
  WHERE b.id = p_beach
),
hrs AS (
  SELECT generate_series(
           date_trunc('hour', p_start),
           date_trunc('hour', p_end),
           interval '1 hour'
         ) AS ts_utc
),
nearest AS (
  SELECT
    h.ts_utc,
    -- nearest marine within ±6 hours
    (
      SELECT m.ts FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS m_ts,
    (
      SELECT m.wave_height_m FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_height_m,
    (
      SELECT m.wave_period_s FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_period_s,
    (
      SELECT m.wave_direction_deg FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wave_direction_deg,
    (
      SELECT m.wind_speed_ms FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wind_speed_ms,
    (
      SELECT m.wind_direction_deg FROM public.marine_forecasts m
      WHERE m.beach_id = p_beach
        AND m.ts BETWEEN h.ts_utc - interval '6 hours' AND h.ts_utc + interval '6 hours'
      ORDER BY ABS(EXTRACT(EPOCH FROM (m.ts - h.ts_utc)))
      LIMIT 1
    ) AS wind_direction_deg,
    -- nearest tide within ±90 minutes
    (
      SELECT t.tide_height_m FROM public.tide_forecasts t
      WHERE t.beach_id = p_beach
        AND t.ts BETWEEN h.ts_utc - interval '90 minutes' AND h.ts_utc + interval '90 minutes'
      ORDER BY ABS(EXTRACT(EPOCH FROM (t.ts - h.ts_utc)))
      LIMIT 1
    ) AS tide_height_m
  FROM hrs h
),
scored AS (
  SELECT
    n.ts_utc,
    -- Wind score
    GREATEST(
      0,
      (1 + COS(RADIANS(ABS(MOD(((n.wind_direction_deg)::int - p.wind_offshore_deg + 540),360) - 180))))/2
      * (1 - GREATEST(0, ((COALESCE(n.wind_speed_ms,0) * 1.94384449) - p.wind_cross_shore_ok_kt)::float / 10.0))
    ) AS wind_score,
    -- Tide score (ft band triangle)
    COALESCE(
      GREATEST(
        0,
        1 - ABS(((n.tide_height_m * 3.28084)) - ((p.preferred_tide_ft_min + p.preferred_tide_ft_max)/2.0))
              / NULLIF((p.preferred_tide_ft_max - p.preferred_tide_ft_min)/2.0,0)
      ), 0
    )::numeric AS tide_score,
    -- Swell direction score
    GREATEST(
      0,
      1 - GREATEST(
            0,
            ABS(MOD(((n.wave_direction_deg)::int - ((p.swell_min + p.swell_span/2.0)) + 540)::int, 360) - 180) - (p.swell_span/2.0)
          )::float / 30.0
    ) AS swell_dir_score,
    0.0 AS period_score,
    0.0 AS height_score,
    -- Total score
    ROUND(
      100 * GREATEST(
        0,
        (0.4 * GREATEST(0,
          (1 + COS(RADIANS(ABS(MOD(((n.wind_direction_deg)::int - p.wind_offshore_deg + 540),360) - 180))))/2
          * (1 - GREATEST(0, ((COALESCE(n.wind_speed_ms,0) * 1.94384449) - p.wind_cross_shore_ok_kt)::float / 10.0))
        ))
        + (0.2 * COALESCE(
          GREATEST(
            0,
            1 - ABS(((n.tide_height_m * 3.28084)) - ((p.preferred_tide_ft_min + p.preferred_tide_ft_max)/2.0))
                  / NULLIF((p.preferred_tide_ft_max - p.preferred_tide_ft_min)/2.0,0)
          ), 0
        ))
        + (0.4 * GREATEST(
          0,
          1 - GREATEST(0, ABS(MOD(((n.wave_direction_deg)::int - ((p.swell_min + p.swell_span/2.0)) + 540)::int, 360) - 180) - (p.swell_span/2.0))::float / 30.0
        ))
      )
    )::int AS score_0_100
  FROM nearest n
  JOIN params p ON TRUE
  WHERE n.m_ts IS NOT NULL -- require a marine reference within window
),
win AS (
  SELECT
    h1.ts_utc                       AS start_ts,
    h1.ts_utc + interval '2 hour'   AS end_ts,
    round(avg(h2.score_0_100))::int AS score
  FROM scored h1
  JOIN scored h2
    ON h2.ts_utc BETWEEN h1.ts_utc AND h1.ts_utc + interval '1 hour'
  GROUP BY h1.ts_utc
),
ranked AS (
  SELECT
    w.*,
    CASE
      WHEN w.score >= 85 THEN 'epic'
      WHEN w.score >= 70 THEN 'good'
      WHEN w.score >= 55 THEN 'fair'
      ELSE 'poor'
    END AS grade
  FROM win w
  WHERE w.score >= 55
)
SELECT
  r.start_ts,
  r.end_ts,
  (r.grade || ' (' || r.score || ')')::text AS label,
  r.score
FROM ranked r
ORDER BY r.score DESC, r.start_ts
LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_best_times(uuid, timestamptz, timestamptz, int) TO anon, authenticated, service_role;

COMMIT;


