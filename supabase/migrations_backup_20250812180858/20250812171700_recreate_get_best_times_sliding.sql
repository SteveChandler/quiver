-- Recreate RPC using 30-min sliding candidate windows

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
WITH hrs AS (
  SELECT ts_utc, score_0_100
  FROM public.v_beach_hourly_scores
  WHERE beach_id = p_beach
    AND ts_utc >= p_start
    AND ts_utc <= p_end
),
cand AS (
  -- 30-minute stepping start times within the range, ensuring room for 2h window
  SELECT gs AS start_ts
  FROM generate_series(
    date_trunc('minute', p_start),
    date_trunc('minute', p_end - interval '2 hour'),
    interval '30 minutes'
  ) AS gs
),
win AS (
  SELECT
    c.start_ts,
    c.start_ts + interval '2 hour' AS end_ts,
    ROUND(AVG(h.score_0_100))::int AS score,
    COUNT(*) AS ct
  FROM cand c
  JOIN hrs h
    ON h.ts_utc BETWEEN c.start_ts AND c.start_ts + interval '1 hour'
  GROUP BY c.start_ts
  HAVING COUNT(*) >= 2
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
),
dedup AS (
  SELECT r.*, row_number() OVER (ORDER BY r.score DESC, r.start_ts) AS rn
  FROM ranked r
)
SELECT
  d.start_ts,
  d.end_ts,
  d.grade || ' (' || d.score || ')' AS label,
  d.score
FROM dedup d
ORDER BY d.score DESC, d.start_ts
LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_best_times(uuid, timestamptz, timestamptz, int) TO anon, authenticated, service_role;

COMMIT;


