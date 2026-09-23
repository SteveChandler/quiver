\set ON_ERROR_STOP on
-- Standalone disposable PostgreSQL fixture; run scripts/test-week-scout-match-postgres.sh.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'service_role')
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, experience_level text);
CREATE TABLE public.beaches (
  id uuid PRIMARY KEY, break_type text, swell_window_min_deg numeric, swell_window_max_deg numeric,
  wind_offshore_deg numeric, wind_offshore_tol_deg numeric,
  preferred_tide_ft_min numeric, preferred_tide_ft_max numeric
);
CREATE TABLE public.boards (id uuid PRIMARY KEY, board_type text, name text, dimensions text);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY, user_id uuid, beach_id uuid, board_id uuid,
  board_snapshot jsonb, rating integer, status text, arrival_time timestamptz,
  deleted_at timestamptz, session_decomposition jsonb
);
CREATE TABLE public.session_forecast_snapshots (session_id uuid PRIMARY KEY, forecast_snapshot jsonb);
CREATE TABLE public.user_entitlements (user_id uuid PRIMARY KEY, is_pro boolean, is_trialing boolean, billing_issue boolean, expires_at timestamptz);
CREATE TABLE public.user_surf_preferences (user_id uuid PRIMARY KEY, confidence numeric, sample_size integer);
CREATE TABLE public.user_implicit_preferences (user_id uuid PRIMARY KEY, confidence numeric);
CREATE TABLE public.user_beach_affinity (user_id uuid, beach_id uuid, affinity_score numeric);
\ir ../migrations/20260420180000_add_parse_numeric_from_text.sql
\ir ../migrations/20260609201625_session_fit_match_score.sql
\ir ../migrations/20260504023658_add_compute_user_match_score_batch_rpc.sql
\ir ../migrations/20260811183000_fix_match_score_core_board_aliases.sql

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
INSERT INTO public.beaches
SELECT fixture_id(100+n), (ARRAY['beach','reef','point',NULL])[n], 200, 300,
  CASE WHEN n = 4 THEN NULL ELSE 90 END, 45, 1, CASE WHEN n = 4 THEN NULL ELSE 5 END
FROM generate_series(1,4) n;
INSERT INTO public.boards VALUES
  (fixture_id(201), 'longboard-2-plus-1', 'Southpoint longboard 2+1', '9 ft'),
  (fixture_id(202), 'mini-mid', 'Egg', NULL),
  (fixture_id(203), 'thruster', 'Unknown', ''),
  (fixture_id(204), 'shortboard', 'Shortboard', '6 ft');
-- Empty/starter, learned confidence boundaries, neutral, avoidance, and board/skill fallbacks.
INSERT INTO public.profiles
SELECT fixture_id(n), (ARRAY['Advanced','beginner',NULL,'expert','intermediate','unknown'])[1+n%6]
FROM generate_series(1,12) n;
INSERT INTO public.user_entitlements SELECT id, true, false, false, NULL FROM public.profiles;
INSERT INTO public.sessions
SELECT fixture_id(10000+u*100+n), fixture_id(u), fixture_id(101+n%4), fixture_id(201+u%4),
  CASE WHEN n%3=0 THEN jsonb_build_object('board_type','long-board','name','Snapshot log') ELSE NULL END,
  CASE WHEN u=10 THEN 3 WHEN u=11 THEN 1 WHEN n%5=0 THEN 2 ELSE 4+n%2 END,
  'completed', now()- n*interval '1 day', NULL,
  jsonb_build_object('version',1,'skill_fit',(ARRAY['dialed','under','over_my_head',NULL])[1+n%4],
    'board_fit',(ARRAY['right','too_small','too_much_board','wrong_type','na'])[1+n%5])
FROM generate_series(2,12) u
CROSS JOIN LATERAL generate_series(1,(ARRAY[0,1,4,5,9,10,15,25,30,8,8,12])[u]) n;
INSERT INTO public.session_forecast_snapshots
SELECT id, jsonb_build_object('wave_height', (1+rating/2.0)::text||' ft',
  'wave_period','10s','wind_speed','6 mph','wind_direction_deg','90','tide_height','2.3')
FROM public.sessions;
-- Board-tip-only population: old/deleted rows still count there, but never in aggregates.
INSERT INTO public.sessions VALUES
  (fixture_id(90001),fixture_id(8),fixture_id(101),fixture_id(201),NULL,5,'completed',now()-interval '2 years',now(),NULL),
  (fixture_id(90002),fixture_id(8),fixture_id(101),fixture_id(201),NULL,5,'completed',now(),NULL,NULL),
  (fixture_id(90003),fixture_id(8),fixture_id(101),fixture_id(201),NULL,5,'planned',now(),NULL,NULL),
  (fixture_id(90004),fixture_id(9),fixture_id(104),fixture_id(202),NULL,NULL,'completed',now(),NULL,NULL);
INSERT INTO public.session_forecast_snapshots VALUES
  (fixture_id(90001),'{}'), (fixture_id(90003),'{}'), (fixture_id(90004),'{}');
-- Malformed/missing snapshot fields follow parse_numeric_from_text's existing zero behavior.
UPDATE public.session_forecast_snapshots SET forecast_snapshot='{"wave_height":"unknown","wind_direction_deg":359}'
WHERE session_id=fixture_id(10901);

CREATE TEMP TABLE slots AS
SELECT b.id AS beach_id, ('2026-09-23T00:00:00Z'::timestamptz + n*interval '1 hour')::text AS forecast_at,
  (ARRAY[NULL,'unknown','0','0.5 ft','1.5','2.4 ft','-3','8','1000','20'])[1+n%11] AS wave_height,
  (ARRAY[NULL,'6s','10','18'])[1+n%4] AS wave_period,
  (ARRAY['0','5 mph','25',NULL])[1+n%4] AS wind_speed,
  (ARRAY['0','90','359','E',NULL,'-90','360','720','-360'])[1+n%9] AS wind_direction,
  (ARRAY['-1','0','2.3','6',NULL])[1+n%5] AS tide_height
FROM public.beaches b CROSS JOIN generate_series(0,69) n;
-- Same 400-session heavy user and 20 beaches as the independent validator.
INSERT INTO public.beaches
SELECT fixture_id(100+n), (ARRAY['beach','reef','point',NULL])[1+n%4], 200, 300,
  CASE WHEN n%3=0 THEN NULL ELSE 90 END,45,1,5
FROM generate_series(5,20) n;
INSERT INTO public.profiles VALUES (fixture_id(13),'advanced');
INSERT INTO public.user_entitlements VALUES (fixture_id(13),true,false,false,NULL);
INSERT INTO public.sessions
SELECT fixture_id(200000+n), fixture_id(13), fixture_id(101+(n%20)),fixture_id(201+(n%4)),
  CASE WHEN n%3=0 THEN jsonb_build_object('board_type','fish','name','Fish') ELSE NULL END,
  CASE WHEN n%7=0 THEN 1 WHEN n%5=0 THEN 2 ELSE 4+n%2 END,
  'completed', now()-(n%300)*interval '1 day', NULL,
  jsonb_build_object('version',1,'skill_fit',(ARRAY['dialed','under','over_my_head',NULL])[1+n%4],
    'board_fit',(ARRAY['right','too_small','too_much_board','wrong_type','na'])[1+n%5])
FROM generate_series(1,400) n;
INSERT INTO public.session_forecast_snapshots
SELECT id,jsonb_build_object('wave_height',(1+(right(id::text,4)::int%90)/10.0)::text||' ft',
 'wave_period',(5+(right(id::text,4)::int%15))::text||'s',
 'wind_speed',(right(id::text,4)::int%30)::text||' mph',
 'wind_direction_deg',(right(id::text,4)::int%360)::text,
 'tide_height',CASE WHEN right(id::text,4)::int%11=0 THEN NULL ELSE ((right(id::text,4)::int%70)/10.0)::text END)
FROM public.sessions WHERE user_id=fixture_id(13);

-- Exercise equal-count board tips as well as snapshot/current-board aliases.
UPDATE public.sessions SET board_id = CASE WHEN right(id::text, 1)::integer % 2 = 0
  THEN fixture_id(202) ELSE fixture_id(204) END
WHERE user_id = fixture_id(12);
-- Keep statistics identical across legacy, bcdcdfae4 and set-based benchmarks.
ANALYZE public.sessions;
ANALYZE public.session_forecast_snapshots;
ANALYZE public.beaches;
ANALYZE public.boards;
ANALYZE public.profiles;
ANALYZE public.user_entitlements;
BEGIN;
DO $$
DECLARE before_scans bigint; after_scans bigint;
BEGIN
  SELECT seq_scan+idx_scan INTO before_scans FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  PERFORM public.compute_user_match_score(fixture_id(8),s.beach_id,s.wave_height,
    s.wave_period,s.wind_speed,s.wind_direction,s.tide_height) FROM slots s;
  SELECT seq_scan+idx_scan INTO after_scans FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  IF after_scans-before_scans < 7*280 THEN RAISE EXCEPTION 'Legacy repeated reads not exercised: %', after_scans-before_scans; END IF;
  RAISE NOTICE 'PASS: legacy 280 slots execute % sessions scans', after_scans-before_scans;
END $$;
COMMIT;
-- Freeze the pre-refactor wrapper output, not a second call through the new scorer.
CREATE TEMP TABLE expected AS
SELECT p.id AS user_id, s.*, public.compute_user_match_score(
  p.id,s.beach_id,s.wave_height,s.wave_period,s.wind_speed,s.wind_direction,s.tide_height
) AS result FROM public.profiles p CROSS JOIN slots s;

CREATE TEMP TABLE edge_expected AS
SELECT p.id AS user_id, b.id AS beach_id, public.compute_user_match_score(
  p.id,b.id,NULL,NULL,NULL,NULL,NULL) AS result
FROM (VALUES (NULL::uuid),(fixture_id(1)),(fixture_id(8))) p(id)
CROSS JOIN (VALUES (NULL::uuid),(fixture_id(99999))) b(id);

CREATE TEMP TABLE batch_edge_expected AS
SELECT * FROM public.compute_user_match_score_batch(fixture_id(8),fixture_id(101),
  '[null,[],"unknown",42,{"wave_height":3,"wind_direction":-90}]');

\if :benchmark
\ir week_scout_match_benchmark_setup.sql
\if :benchmark_legacy
\set benchmark_version legacy
\ir week_scout_match_benchmark.sql
\endif
\if :baseline
\i :baseline_core
\i :baseline_scout
\set benchmark_version bcdcdfae4
\ir week_scout_match_benchmark.sql
\endif
\endif

\ir ../migrations/20260923040000_share_match_score_inputs.sql
\ir ../migrations/20260923041000_week_scout_personalization_context.sql
-- Repeat deployment to check idempotency.
\ir ../migrations/20260923040000_share_match_score_inputs.sql
\ir ../migrations/20260923041000_week_scout_personalization_context.sql

\if :benchmark
\set benchmark_version set_based
\ir week_scout_match_benchmark.sql
TABLE benchmark_results;
\endif

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
CREATE TEMP TABLE actual AS
SELECT p.id AS user_id, m->>'forecast_at' AS forecast_at, (m->>'beach_id')::uuid AS beach_id,
  m->'result' AS result
FROM public.profiles p CROSS JOIN LATERAL jsonb_array_elements(
  public.get_week_scout_personalization(p.id,
    ARRAY(SELECT id FROM public.beaches), (SELECT jsonb_agg(to_jsonb(s)) FROM slots s)) -> 'matches'
) m;
DO $$
DECLARE failures integer; example jsonb;
BEGIN
  SELECT count(*) INTO failures FROM expected e FULL JOIN actual a USING (user_id,beach_id,forecast_at)
  WHERE a.result IS DISTINCT FROM e.result;
  IF failures <> 0 THEN
    SELECT jsonb_build_object('expected',e,'actual',a) INTO example
    FROM expected e FULL JOIN actual a USING (user_id,beach_id,forecast_at)
    WHERE a.result IS DISTINCT FROM e.result LIMIT 1;
    RAISE EXCEPTION 'Batch differs from frozen legacy output: % failures; %', failures, example;
  END IF;
  SELECT count(*) INTO failures FROM expected e WHERE e.result IS DISTINCT FROM public.compute_user_match_score(
    e.user_id,e.beach_id,e.wave_height,e.wave_period,e.wind_speed,e.wind_direction,e.tide_height);
  IF failures <> 0 THEN RAISE EXCEPTION 'Single-slot wrapper changed: % failures', failures; END IF;
  IF EXISTS (SELECT 1 FROM edge_expected e WHERE result IS DISTINCT FROM
    public.compute_user_match_score(e.user_id,e.beach_id,NULL,NULL,NULL,NULL,NULL))
  THEN RAISE EXCEPTION 'NULL/missing-user/beach legacy behavior changed'; END IF;
  IF (SELECT count(*) FROM actual) <> 3640 THEN RAISE EXCEPTION 'Incomplete slot coverage'; END IF;
  IF (SELECT count(DISTINCT result->>'state') FROM expected) <> 3 THEN RAISE EXCEPTION 'Missing starter/learned/avoidance coverage'; END IF;
  RAISE NOTICE 'PASS: 3640 complete JSON results equal frozen legacy and single-slot outputs';
END $$;
-- This fixture has no user-history index: one materialized history load is one
-- heap scan. After ANALYZE, PostgreSQL also probes sessions_pkey twice while
-- planning the snapshot join; these constant boundary probes are not loads.
BEGIN;
DO $$
DECLARE scans_before bigint; scans_after bigint; indexes_before bigint; indexes_after bigint; result jsonb;
BEGIN
  SELECT seq_scan,idx_scan INTO scans_before,indexes_before FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  result := public.get_week_scout_personalization(fixture_id(8), ARRAY(SELECT id FROM public.beaches),
    (SELECT jsonb_agg(to_jsonb(s)) FROM slots s));
  SELECT seq_scan,idx_scan INTO scans_after,indexes_after FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  IF scans_after-scans_before <> 1 OR indexes_after-indexes_before > 2
  THEN RAISE EXCEPTION 'Expected one history load plus at most two planner probes, got heap=% index=%',
    scans_after-scans_before,indexes_after-indexes_before; END IF;
  IF jsonb_array_length(result->'matches') <> 280 THEN RAISE EXCEPTION 'Missing matches'; END IF;
  RAISE NOTICE 'PASS: 280 slots execute one history scan; % constant planner index probes', indexes_after-indexes_before;
END $$;
COMMIT;
DO $$
BEGIN
  IF has_function_privilege('anon','public.compute_user_match_scores(uuid,uuid[],jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.compute_user_match_scores(uuid,uuid[],jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.user_match_access_result(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.compute_user_match_score_core(uuid,uuid,text,text,text,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.compute_user_match_score_batch(uuid,uuid,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.get_week_scout_personalization(uuid,uuid[],jsonb)','EXECUTE')
    OR has_table_privilege('authenticated','public.week_scout_ranking_context','SELECT')
  THEN RAISE EXCEPTION 'Private match inputs exposed'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE before_scans bigint; after_scans bigint; result jsonb;
BEGIN
  SELECT seq_scan+idx_scan INTO before_scans FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  result := public.get_week_scout_personalization(fixture_id(8),ARRAY[fixture_id(101)],'[]');
  SELECT seq_scan+idx_scan INTO after_scans FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  IF result->'matches' <> '[]'::jsonb OR before_scans <> after_scans
  THEN RAISE EXCEPTION 'Empty paid request must not load sessions'; END IF;
END $$;
RESET ROLE;

INSERT INTO public.user_surf_preferences VALUES (fixture_id(8),0.8,25);
INSERT INTO public.user_implicit_preferences VALUES (fixture_id(8),0.7);
INSERT INTO public.user_beach_affinity VALUES
  (fixture_id(8),fixture_id(101),42), (fixture_id(9),fixture_id(101),999);
SET ROLE service_role;
DO $$
DECLARE ranking record; result jsonb; scans_before bigint; scans_after bigint;
BEGIN
  SELECT * INTO ranking FROM public.week_scout_ranking_context WHERE user_id=fixture_id(8);
  IF ranking.learned_prefs->>'sample_size' <> '25'
    OR ranking.implicit_prefs->>'confidence' <> '0.7'
    OR ranking.affinity_rows <> jsonb_build_array(jsonb_build_object('beach_id',fixture_id(101),'affinity_score',42))
  THEN RAISE EXCEPTION 'Ranking view lost inputs or crossed users'; END IF;
  BEGIN
    PERFORM public.get_week_scout_personalization(fixture_id(8),ARRAY[fixture_id(101)],
      jsonb_build_array(jsonb_build_object('beach_id',fixture_id(102),'forecast_at',now())));
    RAISE EXCEPTION 'Expected candidate scope rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Match slots must belong to the requested beaches' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
UPDATE public.user_entitlements SET is_pro=false, is_trialing=true WHERE user_id=fixture_id(8);
DO $$
DECLARE result jsonb; scans_before bigint; scans_after bigint;
BEGIN
  result := public.get_week_scout_personalization(fixture_id(8),ARRAY(SELECT id FROM public.beaches),
    (SELECT jsonb_agg(to_jsonb(s)) FROM slots s));
  IF jsonb_array_length(result->'matches') <> 280 THEN RAISE EXCEPTION 'Trial lost match evidence'; END IF;
  UPDATE public.user_entitlements SET is_trialing=false WHERE user_id=fixture_id(8);
  SELECT seq_scan+idx_scan INTO scans_before FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  result := public.get_week_scout_personalization(fixture_id(8),ARRAY(SELECT id FROM public.beaches),
    (SELECT jsonb_agg(to_jsonb(s)) FROM slots s));
  SELECT seq_scan+idx_scan INTO scans_after FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
  IF scans_after <> scans_before OR result->'matches' <> '[]'::jsonb
  THEN RAISE EXCEPTION 'Free request read sessions or returned match evidence'; END IF;
  RAISE NOTICE 'PASS: private ranking view, scope validation, trial and zero-read free gate';
END $$;

-- Expired flags must not read sessions; billing grace still requires a paid flag.
DO $$
DECLARE flags record; result jsonb; before_scans bigint; after_scans bigint; before_indexes bigint; after_indexes bigint;
BEGIN
  FOR flags IN SELECT * FROM (VALUES
    (true,false,false,now()-interval '1 day',false),
    (false,true,false,now()-interval '1 day',false),
    (true,false,true,now()-interval '1 day',true),
    (false,true,true,now()-interval '1 day',true),
    (false,false,true,now()-interval '1 day',false),
    (true,false,false,now()+interval '1 day',true),
    (false,true,false,NULL::timestamptz,true)
  ) v(pro,trial,billing,expiry,allowed) LOOP
    UPDATE public.user_entitlements SET is_pro=flags.pro,is_trialing=flags.trial,
      billing_issue=flags.billing,expires_at=flags.expiry WHERE user_id=fixture_id(8);
    SELECT seq_scan,idx_scan INTO before_scans,before_indexes FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
    result := public.get_week_scout_personalization(fixture_id(8), ARRAY(SELECT id FROM public.beaches),
      (SELECT jsonb_agg(to_jsonb(s)) FROM slots s));
    SELECT seq_scan,idx_scan INTO after_scans,after_indexes FROM pg_stat_xact_user_tables WHERE relid='public.sessions'::regclass;
    IF jsonb_array_length(result->'matches') <> (CASE WHEN flags.allowed THEN 280 ELSE 0 END)
      OR after_scans-before_scans <> (CASE WHEN flags.allowed THEN 1 ELSE 0 END)
      OR after_indexes-before_indexes > (CASE WHEN flags.allowed THEN 2 ELSE 0 END)
    THEN RAISE EXCEPTION 'Entitlement gate mismatch: %', flags; END IF;
  END LOOP;
  RAISE NOTICE 'PASS: seven entitlement expiry/grace cases, including zero-read expired paid and trial';
END $$;

-- The public beach batch preserves ordinal indexes, duplicate slots and exact JSON.
DO $$
DECLARE failures integer;
BEGIN
  WITH batch_actual AS (
    SELECT p.id AS user_id,b.id AS beach_id,m.*
    FROM public.profiles p CROSS JOIN (SELECT DISTINCT beach_id AS id FROM slots) b
    CROSS JOIN LATERAL public.compute_user_match_score_batch(p.id,b.id,
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.forecast_at) FROM slots s WHERE s.beach_id=b.id)) m
  )
  SELECT count(*) INTO failures FROM batch_actual a FULL JOIN expected e
    ON e.user_id=a.user_id AND e.beach_id=a.beach_id AND e.forecast_at::timestamptz=a.forecast_at
  WHERE e.result IS DISTINCT FROM a.result;
  IF failures <> 0 THEN RAISE EXCEPTION 'Public batch differs: %',failures; END IF;
  IF EXISTS (SELECT 1 FROM public.compute_user_match_score_batch(fixture_id(13),fixture_id(101),
    '[{"forecast_at":"2026-09-23T00:00:00Z","wave_height":"3"},{"forecast_at":"2026-09-23T00:00:00Z","wave_height":"3"}]')
    HAVING count(*) <> 2 OR min(slot_idx) <> 0 OR max(slot_idx) <> 1 OR count(DISTINCT result) <> 1)
  THEN RAISE EXCEPTION 'Duplicate slot/index contract changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM batch_edge_expected e FULL JOIN public.compute_user_match_score_batch(
      fixture_id(8),fixture_id(101),'[null,[],"unknown",42,{"wave_height":3,"wind_direction":-90}]') a
      USING (slot_idx)
    WHERE e.result IS DISTINCT FROM a.result OR e.forecast_at IS DISTINCT FROM a.forecast_at
  ) THEN RAISE EXCEPTION 'Legacy permissive slot parsing changed'; END IF;
  RAISE NOTICE 'PASS: public batch equality and duplicate slot ordinals';
END $$;

-- Authenticated callers retain the legacy locked shapes and cannot cross users.
GRANT USAGE ON SCHEMA auth TO authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub',fixture_id(8)::text,false);
SET ROLE authenticated;
DO $$
DECLARE single_result jsonb; batch_result jsonb;
BEGIN
  single_result := public.compute_user_match_score(fixture_id(9),fixture_id(101),'3','10','5','90','2');
  SELECT result INTO batch_result FROM public.compute_user_match_score_batch(fixture_id(9),fixture_id(101),
    '[{"wave_height":"3","wave_period":"10","wind_speed":"5","wind_direction":"90","tide_height":"2"}]');
  IF single_result->>'lock_reason' <> 'forbidden' OR single_result IS DISTINCT FROM batch_result
  THEN RAISE EXCEPTION 'Cross-user batch authorization changed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);

DO $$
DECLARE result jsonb; batch_result jsonb; flags record;
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  FOR flags IN SELECT * FROM (VALUES
    (false,false,false,NULL::timestamptz,'free'),
    (true,false,false,now()-interval '1 day','free'),
    (true,false,true,now()-interval '1 day','billing_issue'),
    (false,true,false,now()+interval '1 day',NULL)
  ) v(pro,trial,billing,expiry,reason) LOOP
    UPDATE public.user_entitlements SET is_pro=flags.pro,is_trialing=flags.trial,
      billing_issue=flags.billing,expires_at=flags.expiry WHERE user_id=fixture_id(8);
    result := public.compute_user_match_score(fixture_id(8),fixture_id(101),'3','10','5','90','2');
    SELECT m.result INTO batch_result FROM public.compute_user_match_score_batch(fixture_id(8),fixture_id(101),
      '[{"wave_height":"3","wave_period":"10","wind_speed":"5","wind_direction":"90","tide_height":"2"}]') m;
    IF result->>'lock_reason' IS DISTINCT FROM flags.reason OR result IS DISTINCT FROM batch_result
    THEN RAISE EXCEPTION 'Public wrapper lock contract changed: %',flags; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  IF EXISTS (SELECT 1 FROM public.compute_user_match_score_batch(fixture_id(8),fixture_id(101),'[]'))
  THEN RAISE EXCEPTION 'Empty public batch must be empty'; END IF;
  BEGIN
    PERFORM public.compute_user_match_score_batch(fixture_id(8),fixture_id(101),'{}');
    RAISE EXCEPTION 'Expected invalid array rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'compute_user_match_score_batch: p_slots must be a jsonb array%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: public wrapper authorization, locks, empty batch and invalid array';
END $$;
