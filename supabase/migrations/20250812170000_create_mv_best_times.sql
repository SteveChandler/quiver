-- Materialized view for precomputed best-times windows per beach

BEGIN;

-- Create materialized view with rolling 2-hour windows (next 72h)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_best_times AS
WITH hrs AS (
  SELECT beach_id, ts_utc, score_0_100
  FROM public.v_beach_hourly_scores
  WHERE ts_utc >= now() AND ts_utc < (now() + interval '72 hours')
),
win AS (
  SELECT
    h1.beach_id,
    h1.ts_utc AS start_ts,
    h1.ts_utc + interval '2 hour' AS end_ts,
    round(avg(h2.score_0_100))::int AS score
  FROM hrs h1
  JOIN hrs h2
    ON h2.beach_id = h1.beach_id
   AND h2.ts_utc BETWEEN h1.ts_utc AND h1.ts_utc + interval '1 hour'
  GROUP BY h1.beach_id, h1.ts_utc
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
)
SELECT
  beach_id,
  start_ts,
  end_ts,
  grade,
  score,
  now() AS updated_at
FROM ranked;

-- Indexes to support concurrent refresh and fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_best_times_beach_start
  ON public.mv_best_times (beach_id, start_ts);
CREATE INDEX IF NOT EXISTS idx_mv_best_times_beach_score
  ON public.mv_best_times (beach_id, score DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_mv_best_times()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_best_times;
END;
$$;

-- pg_cron schedule (hourly at minute 7)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_best_times_hourly'
  ) THEN
    PERFORM cron.schedule(
      'refresh_mv_best_times_hourly',
      '7 * * * *',
      'SELECT public.refresh_mv_best_times();'
    );
  END IF;
END;
$$;

COMMIT;
