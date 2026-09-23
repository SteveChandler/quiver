-- This matches the validator: 252 slots PER beach, 5,040 total.
CREATE TEMP TABLE perf_slots AS
SELECT b.id AS beach_id, ('2026-09-23T00:00:00Z'::timestamptz+n*interval '1 hour')::text AS forecast_at,
 (ARRAY['1.5 ft','3 ft','5 ft','8 ft'])[1+n%4] AS wave_height,
 (ARRAY['8s','12s','16s'])[1+n%3] AS wave_period,
 (ARRAY['4 mph','12 mph','24 mph'])[1+n%3] AS wind_speed,
 (ARRAY['0','90','180','359'])[1+n%4] AS wind_direction,
 (ARRAY['0','2.3','5'])[1+n%3] AS tide_height
FROM public.beaches b CROSS JOIN generate_series(0,251) n;
CREATE TEMP TABLE perf_252 AS SELECT * FROM perf_slots ORDER BY forecast_at,beach_id LIMIT 252;
ANALYZE perf_slots;
ANALYZE perf_252;
CREATE TEMP TABLE benchmark_results(version text, slots integer, median_ms numeric, explain_ms numeric, shared_hits integer, explain jsonb);
CREATE FUNCTION pg_temp.benchmark_match(version text, slots integer, query text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE started timestamptz; times numeric[] := '{}'; plan jsonb; median_ms numeric;
BEGIN
  EXECUTE query; -- warm the function/query plans and buffers
  FOR n IN 1..5 LOOP
    started := clock_timestamp();
    EXECUTE query;
    times := array_append(times, extract(epoch FROM clock_timestamp()-started)*1000);
  END LOOP;
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t) INTO median_ms FROM unnest(times) t;
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || query INTO plan;
  INSERT INTO benchmark_results VALUES(version, slots, median_ms,
    (plan->0->>'Execution Time')::numeric, (plan->0->'Plan'->>'Shared Hit Blocks')::integer, plan);
  RAISE NOTICE 'BENCH % slots=% median5=% ms explain=% ms hits=%',version,slots,median_ms,
    plan->0->>'Execution Time',plan->0->'Plan'->>'Shared Hit Blocks';
END $$;
