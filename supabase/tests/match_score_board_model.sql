\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-match-score-board-model-postgres.sh.
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
  id uuid PRIMARY KEY, break_type text, wind_offshore_deg numeric,
  preferred_tide_ft_min numeric, preferred_tide_ft_max numeric
);
CREATE TABLE public.boards (id uuid PRIMARY KEY, board_type text, name text, dimensions text);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY, user_id uuid, beach_id uuid, board_id uuid,
  board_snapshot jsonb, rating integer, status text, arrival_time timestamptz,
  deleted_at timestamptz, session_decomposition jsonb
);
CREATE TABLE public.session_forecast_snapshots (session_id uuid PRIMARY KEY, forecast_snapshot jsonb);
\ir ../migrations/20260420180000_add_parse_numeric_from_text.sql
\ir ../migrations/20260609201625_session_fit_match_score.sql
\ir ../migrations/20260923040000_share_match_score_inputs.sql
\ir ../migrations/20260927230000_board_model_merge_match_score.sql
\ir ../migrations/20260927230000_board_model_merge_match_score.sql

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
INSERT INTO public.profiles VALUES (fixture_id(1),'advanced'),(fixture_id(2),'advanced'),(fixture_id(3),'advanced');
INSERT INTO public.beaches VALUES
  (fixture_id(101),'beach',90,1,5),
  (fixture_id(102),'beach/reef break',90,1,5),
  (fixture_id(103),'reef',90,1,5);
INSERT INTO public.boards VALUES
  (fixture_id(201),'thruster','Twin pin',NULL),
  (fixture_id(202),'twin-pin','Other pin',NULL),
  (fixture_id(203),'fish','Far board',NULL);
INSERT INTO public.sessions
SELECT fixture_id(1000+u*10+n), fixture_id(u),
  CASE WHEN u=1 AND n=1 THEN fixture_id(102)
    WHEN u=1 THEN fixture_id(103) ELSE fixture_id(101) END,
  fixture_id(200+u), CASE WHEN u=1 THEN '{"board_type":"twin-pin","name":"Twin pin"}'::jsonb
    WHEN u=2 THEN '{"board_type":"thruster","name":"Other pin"}'::jsonb END,
  5, 'completed', now()-n*interval '1 day', NULL, NULL
FROM generate_series(1,3) u CROSS JOIN generate_series(1,5) n;
INSERT INTO public.session_forecast_snapshots
SELECT id, CASE WHEN user_id=fixture_id(3) THEN
  '{"wave_height":"10 ft","wave_period":"3s","wind_speed":"30 mph","wind_direction_deg":"270","tide_height":"3 ft","tide_status":"outgoing"}'::jsonb
  WHEN user_id=fixture_id(1) AND beach_id=fixture_id(102) THEN
  '{"wave_height":"4 ft","wave_period":"12s","wind_speed":"4 mph","wind_direction_deg":"90","tide_height":"3 ft","tide_status":"incoming"}'::jsonb
  ELSE '{"wave_height":"3 ft","wave_period":"12s","wind_speed":"4 mph","wind_direction_deg":"90","tide_height":"3 ft","tide_status":"incoming"}'::jsonb END
FROM public.sessions;

DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('beach',ARRAY['beach']::text[]), ('Beach ',ARRAY['beach']),
    ('beach/reef break',ARRAY['beach','reef']), ('reef/point',ARRAY['reef','point']),
    ('jetty/beach',ARRAY['beach']), ('pier',ARRAY['beach']), ('jetty',ARRAY['beach']),
    ('breakwater',ARRAY['beach']), ('inlet',ARRAY['beach']), ('river-mouth',ARRAY['beach']),
    ('reef',ARRAY['reef']), ('point',ARRAY['point']), ('slab',ARRAY['slab']),
    ('',NULL::text[]), (NULL::text,NULL::text[])
  ) AS fixture(raw,families) LOOP
    IF public.break_type_families(row.raw) IS DISTINCT FROM row.families THEN
      RAISE EXCEPTION 'Families for %: got %, expected %',row.raw,public.break_type_families(row.raw),row.families;
    END IF;
  END LOOP;
  FOR row IN SELECT * FROM (VALUES
    ('beach','beach/reef break',true),('beach','reef',false),
    (NULL::text,'reef',true),('jetty','beach',true),('point','reef/point',true)
  ) AS fixture(a,b,expected) LOOP
    IF public.break_types_match(row.a,row.b) IS DISTINCT FROM row.expected THEN
      RAISE EXCEPTION 'Break match for % and %',row.a,row.b;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE row record; actual numeric;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('identical',3::numeric,12::numeric,4::numeric,90::numeric,0::numeric,'incoming','beach',1::numeric),
    ('height',4,12,4,90,0,'incoming','beach',0.9129),
    ('period',3,10,4,90,0,'incoming','beach',0.9654),
    ('break mismatch',3,12,4,90,0,'incoming','reef',0.7788),
    ('break match',3,12,4,90,0,'incoming','beach/reef break',1),
    ('tide direction',3,12,4,90,0,'outgoing','beach',0.8825),
    ('null tide',3,12,4,90,NULL::numeric,'incoming','beach',1)
  ) AS fixture(label,wave,period,wind,wind_dir,rel_tide,tide_dir,break_type,expected) LOOP
    actual := public.session_condition_similarity(
      row.wave,row.period,row.wind,row.wind_dir,row.rel_tide,row.tide_dir,row.break_type,
      3,12,4,90,0,'incoming','beach');
    IF round(actual,4) IS DISTINCT FROM row.expected THEN
      RAISE EXCEPTION 'Similarity %: got %, expected %',row.label,round(actual,4),row.expected;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE result jsonb; user_n integer;
BEGIN
  FOR user_n IN 1..3 LOOP
    SELECT m.result INTO result FROM public.compute_user_match_scores(
      fixture_id(user_n),ARRAY[fixture_id(101)],
      jsonb_build_array(jsonb_build_object('beach_id',fixture_id(101),'forecast_at','2026-09-28T15:00:00Z',
        'wave_height','3 ft','wave_period','12s','wind_speed','4 mph','wind_direction','90','tide_height','3 ft'))) m;
    IF result->>'state' IS DISTINCT FROM 'learned' OR (result->>'sessions_in_profile')::integer IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'User % should be learned from five sessions: %',user_n,result;
    END IF;
    IF (result ? 'board_tip' AND result->'board_tip' = 'null'::jsonb) IS NOT TRUE THEN
      RAISE EXCEPTION 'RPC board_tip must exist and be JSON null: %',result; END IF;
    IF result->'reason_bullets'->>0 !~ '^\d+ of your \d+ good sessions were in conditions like this\.$'
      OR (result->'reason_bullets')::text LIKE '%profile peak%'
    THEN RAISE EXCEPTION 'Bad reason for user %: %',user_n,result->'reason_bullets'; END IF;
    IF (result->>'good_session_count')::integer <> 5 THEN RAISE EXCEPTION 'Wrong good total: %',result; END IF;
    IF user_n=1 AND (result->>'similar_good_session_count')::integer <> 5 THEN
      RAISE EXCEPTION 'Mixed beach history not similar: %',result; END IF;
    IF user_n=1 AND (result->>'base_score')::numeric <> 9.13 THEN
      RAISE EXCEPTION 'Mixed beach session missing from profile mean: %',result; END IF;
    IF user_n=3 AND ((result->>'similar_good_session_count')::integer <> 0
      OR result->'reason_bullets'->>0 <> '0 of your 5 good sessions were in conditions like this.') THEN
      RAISE EXCEPTION 'Zero-similar copy wrong: %',result; END IF;
    IF user_n=1 AND result->>'board_class' <> 'shortboard' THEN RAISE EXCEPTION 'Thruster class: %',result; END IF;
    IF user_n=2 AND result->>'board_class' <> 'fish' THEN RAISE EXCEPTION 'Twin-pin class: %',result; END IF;
  END LOOP;
END $$;
-- Both avoidance branches retain the installed-client key.
DO $$
DECLARE result jsonb; session_rating integer;
BEGIN
  FOREACH session_rating IN ARRAY ARRAY[3,1] LOOP
    UPDATE public.sessions SET rating=session_rating WHERE user_id=fixture_id(3);
    SELECT public.compute_user_match_score_core(fixture_id(3),fixture_id(101),'3','12','4','90','3') INTO result;
    IF result->>'state' IS DISTINCT FROM 'avoidance_learned'
      OR NOT (result ? 'board_tip' AND result->'board_tip' = 'null'::jsonb) THEN
      RAISE EXCEPTION 'Avoidance RPC contract for rating %: %',session_rating,result;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE row record; actual numeric;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('3.2 ft',3.2::numeric),('3-4 ft',3.5),('1-5 ft',3),('~2 ft',2),
    ('',NULL::numeric),(NULL::text,NULL::numeric),('unknown',NULL::numeric),('..',NULL::numeric),
    ('1.2.3 4 ft',4),('-2 ft',2),('1 5 9 ft',5),('.5-1.5 ft',1),('2.',2),
    (repeat('9',400),NULL::numeric),('0.'||repeat('0',400)||'1',0),('1'||repeat('0',308),'Infinity'::numeric),
    ('0-0.'||repeat('0',323)||'5',0)
  ) AS fixture(raw,expected) LOOP
    actual := public.parse_wave_height_midpoint_ft(row.raw);
    IF actual IS DISTINCT FROM row.expected THEN
      RAISE EXCEPTION 'Midpoint for %: got %, expected %',row.raw,actual,row.expected;
    END IF;
  END LOOP;
  actual := public.session_condition_similarity(public.parse_wave_height_midpoint_ft('1-5 ft'),
    12,4,90,0,'incoming','beach',3,12,4,90,0,'incoming','beach');
  IF round(actual,4) IS DISTINCT FROM 1::numeric THEN RAISE EXCEPTION 'Range similarity: %',actual; END IF;
END $$;

-- A range's first number still controls scoring, while its midpoint controls similarity.
UPDATE public.session_forecast_snapshots SET forecast_snapshot=jsonb_set(forecast_snapshot,'{wave_height}','"1-5 ft"')
WHERE session_id IN (SELECT id FROM public.sessions WHERE user_id=fixture_id(2));
DO $$
DECLARE actual jsonb[];
BEGIN
  SELECT array_agg(m.result ORDER BY m.slot_idx) INTO actual
  FROM public.compute_user_match_scores(fixture_id(2),ARRAY[fixture_id(101)],
    (SELECT jsonb_agg(jsonb_build_object('beach_id',fixture_id(101),'wave_height',wave,
      'wave_period','12','wind_speed','4','wind_direction','90','tide_height','3') ORDER BY ord)
     FROM (VALUES (1,'6 ft'),(2,'1-5 ft'),(3,'1-15 ft'),(4,'')) slots(ord,wave))) m;
  IF cardinality(actual) IS DISTINCT FROM 4
    OR actual[1]->>'similar_good_session_count' IS DISTINCT FROM '5'
    OR actual[2]->>'similar_good_session_count' IS DISTINCT FROM '5'
    OR actual[3]->>'similar_good_session_count' IS DISTINCT FROM '0'
    OR actual[4]->>'similar_good_session_count' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'History/slot midpoint or scenario identity mismatch: %',actual;
  END IF;
  IF actual[2]->>'base_score' IS DISTINCT FROM '10.00'
    OR actual[2]->'score' IS DISTINCT FROM actual[3]->'score' THEN
    RAISE EXCEPTION 'Range parsing changed existing numeric scoring: %',actual;
  END IF;
END $$;

DO $$
DECLARE helper text; config text[];
BEGIN
  FOREACH helper IN ARRAY ARRAY['break_type_families','break_types_match','session_condition_similarity','parse_wave_height_midpoint_ft'] LOOP
    SELECT p.proconfig INTO config FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=helper AND p.provolatile='i';
    IF NOT COALESCE(config @> ARRAY['search_path=""'],false) THEN
      RAISE EXCEPTION 'Helper % must be immutable with empty search_path: %',helper,config;
    END IF;
  END LOOP;
END $$;
\echo PASS: board model fixture
