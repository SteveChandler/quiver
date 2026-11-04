-- Read-only postflight for:
--   supabase/migrations/20261104090000_read_time_buoy_matching.sql
--
-- Run after the migration has been applied, before Seaside's
-- backfill-observations retirement deploys:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f scripts/db/read-time-buoy-matching-parity.sql
--
-- Fails (non-zero exit) unless read-time matching reproduces the backfill's
-- stored matches for Oct 24-30 2026: at least 98% of stored matched rows are
-- matched at read time (98.6% in a pre-apply simulation on Nov 3).
--
-- Values are reported, not gated. The backfill stored the EARLIEST reading in
-- the ±12 h window (order by observed_at limit 1), up to 12 h before the
-- forecast time; read time takes the NEAREST. In the simulation only ~9% agreed
-- within 0.01 m (mean difference 0.24 m), and earliest-in-window reproduced
-- 81% of stored values, so the difference is the old job's choice of reading.
-- Those rows age out of ml_predictions_log (30-day retention) after
-- about Nov 23 2026; after that, move the window to the last fully backfilled week.

BEGIN READ ONLY;
-- The all-beach week takes ~80 s; the role default is 2 min.
SET LOCAL statement_timeout = '5min';

SELECT 'expected_objects' AS check_name;
DO $$
BEGIN
  IF to_regclass('public.beach_observation_stations') IS NULL THEN
    RAISE EXCEPTION 'beach_observation_stations is missing';
  END IF;
  IF to_regprocedure('public.get_prediction_observations(uuid, timestamptz, timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'get_prediction_observations is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-beach-observation-stations') THEN
    RAISE EXCEPTION 'refresh-beach-observation-stations is not scheduled';
  END IF;
END $$;

SELECT count(*) AS beaches_with_station FROM public.beach_observation_stations;

SELECT 'parity_oct_24_30' AS check_name;
DO $$
DECLARE
  v_stored integer;
  v_read_time integer;
  v_both integer;
  v_agree integer;
  v_mean_diff numeric;
BEGIN
  WITH stored AS (
    SELECT id, observed_m
    FROM public.ml_predictions_log
    WHERE predicted_at >= '2026-10-24' AND predicted_at < '2026-10-31'
      AND observed_m > 0
  ),
  read_time AS (
    SELECT prediction_id AS id, observed_m
    FROM public.get_prediction_observations(NULL, '2026-10-24', '2026-10-31')
  )
  SELECT
    (SELECT count(*) FROM stored),
    (SELECT count(*) FROM read_time),
    count(*),
    count(*) FILTER (WHERE abs(s.observed_m - r.observed_m) <= 0.01),
    round(avg(abs(s.observed_m - r.observed_m)), 3)
  INTO v_stored, v_read_time, v_both, v_agree, v_mean_diff
  FROM stored s
  JOIN read_time r USING (id);

  RAISE NOTICE 'stored matched %, read-time matched %, both %, agree within 0.01 m %, mean abs difference % m (expected ~0.24: earliest vs nearest reading)',
    v_stored, v_read_time, v_both, v_agree, v_mean_diff;

  IF v_stored = 0 THEN
    RAISE EXCEPTION 'no stored matches in the window; move it to the last backfilled week';
  END IF;
  IF v_both < 0.98 * v_stored THEN
    RAISE EXCEPTION 'read time reproduced % of % stored matches (< 98%%)', v_both, v_stored;
  END IF;
END $$;

SELECT 'beach_without_station_returns_nothing' AS check_name;
DO $$
DECLARE
  v_beach uuid;
  v_rows integer;
BEGIN
  SELECT b.id INTO v_beach
  FROM public.beaches b
  WHERE NOT EXISTS (SELECT 1 FROM public.beach_observation_stations s WHERE s.beach_id = b.id)
    AND EXISTS (
      SELECT 1 FROM public.ml_predictions_log p
      WHERE p.beach_id = b.id AND p.predicted_at > now() - interval '7 days'
    )
  LIMIT 1;
  IF v_beach IS NULL THEN
    RAISE NOTICE 'every logged beach has a station; nothing to check';
    RETURN;
  END IF;
  SELECT count(*) INTO v_rows
  FROM public.get_prediction_observations(v_beach, now() - interval '30 days', now());
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'beach % has no station but returned % rows', v_beach, v_rows;
  END IF;
END $$;

SELECT 'long_range_is_refused' AS check_name;
DO $$
BEGIN
  PERFORM 1 FROM public.get_prediction_observations(NULL, now() - interval '90 days', now());
  RAISE EXCEPTION 'a 90-day range was not refused';
EXCEPTION
  WHEN invalid_parameter_value THEN
    RAISE NOTICE '90-day range refused as expected';
END $$;

-- Manual check: one beach-month (the height-offset job's call) should take
-- well under 1 s. Read the Time line psql prints.
SELECT 'one_beach_month_timing' AS check_name;
\timing on
SELECT count(*) AS rows_one_beach_30d
FROM public.get_prediction_observations(
  (SELECT beach_id FROM public.beach_observation_stations ORDER BY beach_id LIMIT 1),
  now() - interval '30 days',
  now()
);
\timing off

ROLLBACK;
