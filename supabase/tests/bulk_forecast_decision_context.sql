-- Runs inside the disposable match harness, after true-legacy equivalence.
ALTER TABLE public.beaches ADD COLUMN name text;
ALTER TABLE public.beaches ADD COLUMN slug text;
ALTER TABLE public.beaches ADD COLUMN lat numeric;
ALTER TABLE public.beaches ADD COLUMN lon numeric;
ALTER TABLE public.beaches ADD COLUMN city text;
ALTER TABLE public.beaches ADD COLUMN state text;
ALTER TABLE public.beaches ADD COLUMN country text;
ALTER TABLE public.beaches ADD COLUMN region text;
ALTER TABLE public.beaches ADD COLUMN timezone text;
ALTER TABLE public.beaches ADD COLUMN skill_level text;
ALTER TABLE public.beaches ADD COLUMN cdip_station text;
ALTER TABLE public.beaches ADD COLUMN cdip_eligible boolean;
ALTER TABLE public.beaches ADD COLUMN wind_cross_shore_ok_kt numeric;
ALTER TABLE public.beaches ADD COLUMN wind_onshore_bad_kt numeric;
ALTER TABLE public.beaches ADD COLUMN swell_window_center_deg numeric;
ALTER TABLE public.beaches ADD COLUMN swell_window_halfwidth_deg numeric;
ALTER TABLE public.beaches ADD COLUMN swell_access_factors jsonb;
ALTER TABLE public.beaches ADD COLUMN wind_exposure_factors jsonb;
ALTER TABLE public.beaches ADD COLUMN preferred_tide_direction text;
ALTER TABLE public.beaches ADD COLUMN tide_direction_sensitivity text;
ALTER TABLE public.beaches ADD COLUMN preference_model jsonb;
ALTER TABLE public.beaches ADD COLUMN features jsonb;
ALTER TABLE public.beaches ADD COLUMN hazards jsonb;
ALTER TABLE public.beaches ADD COLUMN average_rating numeric;
ALTER TABLE public.beaches ADD COLUMN review_count numeric;
ALTER TABLE public.beaches ADD COLUMN shoaling_factors jsonb;
ALTER TABLE public.beaches ADD COLUMN is_private boolean DEFAULT false;
ALTER TABLE public.beaches ADD COLUMN owner_id uuid;
ALTER TABLE public.boards ADD COLUMN user_id uuid;
UPDATE public.boards SET user_id=fixture_id(13);
UPDATE public.beaches SET name='Test beach', timezone='America/Los_Angeles', skill_level='beginner';
CREATE TABLE public.sun_times(beach_id uuid,date date,sunrise_utc timestamptz,sunset_utc timestamptz);
INSERT INTO public.sun_times SELECT id,'2026-09-23','2026-09-23T13:40Z','2026-09-24T01:45Z' FROM public.beaches;
CREATE TABLE public.beach_water_quality(beach_id uuid,status text,total_samples_30d integer,latest_sample_date date);
CREATE TABLE public.water_quality_held_beaches(beach_id uuid);
CREATE TABLE public.county_beach_advisory_runs(id uuid,source_identifier text,status text,fetched_at timestamptz);
CREATE TABLE public.county_beach_advisories(run_id uuid,beach_id uuid,advisory_type text);
INSERT INTO public.county_beach_advisory_runs VALUES(fixture_id(700),'county-san-diego-dehq-sdbeachinfo','completed',now());
INSERT INTO public.county_beach_advisories SELECT fixture_id(700),id,'warning' FROM public.beaches LIMIT 1;
\ir ../migrations/20260924010000_bulk_forecast_decision_context.sql
\ir ../migrations/20260924010000_bulk_forecast_decision_context.sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
SET ROLE service_role;
DO $$
DECLARE result jsonb; expected jsonb; slots jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('beach_id',id,'forecast_at','2026-09-23T18:00Z',
    'wave_height','3 ft','wave_period','12s','wind_speed','5 mph','wind_direction','90','tide_height','2.3'))
    INTO slots FROM public.beaches;
  result:=public.get_bulk_forecast_decision_context(fixture_id(13),ARRAY(SELECT id FROM public.beaches),slots,'2026-09-23','2026-09-23');
  expected:=public.get_week_scout_personalization(fixture_id(13),ARRAY(SELECT id FROM public.beaches),slots);
  IF result->'personalization' IS DISTINCT FROM expected OR jsonb_array_length(result->'beaches')<>20
    OR jsonb_array_length(result->'sun_times')<>20 OR jsonb_array_length(result->'boards')<>4
    OR result#>>'{profile,experience_level}'<>'advanced'
    OR jsonb_array_length(result#>'{water_quality,county_beach_advisories}')<>1
  THEN RAISE EXCEPTION 'Bulk context or match parity failed'; END IF;
  result:=public.get_bulk_forecast_decision_context(NULL,ARRAY(SELECT id FROM public.beaches),slots,'2026-09-24','2026-09-24');
  IF result->'personalization'<>'null'::jsonb OR result->'profile'<>'null'::jsonb
    OR result->'boards'<>'[]'::jsonb OR result->'sun_times'<>'[]'::jsonb
  THEN RAISE EXCEPTION 'Anonymous context/date filtering failed'; END IF;
  RAISE NOTICE 'PASS: bulk context matches shared scorer, boards/profile/sun/safety snapshot and anonymous isolation';
END $$;
RESET ROLE;
UPDATE public.beaches SET is_private=true,owner_id=fixture_id(13) WHERE id=fixture_id(101);
DO $$
DECLARE allowed boolean; result jsonb;
BEGIN
  FOREACH allowed IN ARRAY ARRAY[false,true] LOOP
    result:=public.get_bulk_forecast_decision_context(CASE WHEN allowed THEN fixture_id(13) ELSE fixture_id(12) END,
      ARRAY[fixture_id(101)],'[]','2026-09-23','2026-09-23');
    IF jsonb_array_length(result->'beaches')<>(CASE WHEN allowed THEN 1 ELSE 0 END)
    THEN RAISE EXCEPTION 'Private beach ownership failed'; END IF;
  END LOOP;
  IF has_function_privilege('anon','public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date)','execute')
    OR has_function_privilege('authenticated','public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date)','execute')
  THEN RAISE EXCEPTION 'Untrusted caller can read bulk personalization'; END IF;
  RAISE NOTICE 'PASS: bulk context service-only and private beach ownership';
END $$;
UPDATE public.beaches SET is_private=false;
\if :benchmark
-- Server-side cost of the reads replaced by the RPC; excludes transport/auth and unchanged forecast work.
SELECT pg_temp.benchmark_match('bulk_before_context',20,$q$
SELECT jsonb_build_object('profile',(SELECT experience_level FROM public.profiles WHERE id=fixture_id(13)),
  'boards',(SELECT jsonb_agg(board_type) FROM public.boards WHERE user_id=fixture_id(13)),
  'beaches',(SELECT jsonb_agg(to_jsonb(b)) FROM public.beaches b),
  'sun_times',(SELECT jsonb_agg(to_jsonb(s)) FROM public.sun_times s WHERE date='2026-09-23'))$q$);
SELECT pg_temp.benchmark_match('bulk_after_context',20,$q$
SELECT public.get_bulk_forecast_decision_context(fixture_id(13),ARRAY(SELECT id FROM public.beaches),
  (SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT * FROM perf_slots ORDER BY forecast_at,beach_id LIMIT 20) s),
  '2026-09-23','2026-09-23')$q$);
SELECT pg_temp.benchmark_match('bulk_after_timeline',252,$q$
SELECT public.get_bulk_forecast_decision_context(fixture_id(13),ARRAY(SELECT id FROM public.beaches),
  (SELECT jsonb_agg(to_jsonb(s)) FROM perf_252 s),'2026-09-23','2026-09-24')$q$);
SELECT version,slots,median_ms,explain_ms FROM benchmark_results WHERE version LIKE 'bulk_%';
\endif
