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
\ir ../migrations/20260929120000_match_score_om_similarity_period.sql

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
    WHEN u=1 AND n<>2 THEN fixture_id(103) ELSE fixture_id(101) END,
  fixture_id(200+u), CASE WHEN u=1 THEN '{"board_type":"twin-pin","name":"Twin pin"}'::jsonb
    WHEN u=2 THEN '{"board_type":"thruster","name":"Other pin"}'::jsonb END,
  5, 'completed', now()-n*interval '1 day', NULL,
  CASE WHEN u=1 AND n=1 THEN '{"version":1,"skill_fit":"over_my_head","board_fit":"wrong_type"}'::jsonb END
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
    -- The counts are data (asserted below); the sentence is not user-facing copy for any N.
    IF (result->'reason_bullets')::text LIKE '%conditions like this%'
      OR (result->'reason_bullets')::text LIKE '%good sessions were%'
      OR (result->'reason_bullets')::text LIKE '%profile peak%'
      OR jsonb_typeof(result->'reason_bullets') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'Bad reason for user %: %',user_n,result->'reason_bullets'; END IF;
    IF (result->>'good_session_count')::integer <> 5 THEN RAISE EXCEPTION 'Wrong good total: %',result; END IF;
    -- One mixed-break session scores 0.9129; one exact-beach session scores 1.
    -- Three reef sessions score exp(-0.5/2)=0.7788.
    -- All five still clear 0.7. The far-condition user's five sessions still clear neither bar.
    IF user_n=1 AND (result->>'similar_good_session_count')::integer IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'Mixed beach history not similar: %',result; END IF;
    -- Exact beach history is (3,12,4,90,3), identical to the slot: base=10.
    -- The mixed-break 4ft session and its -1.5 fit signal must not enter scoring.
    -- No bad sessions: aversion=0; board=+0.5; clipped final score=10.
    IF user_n=1 AND ((result->>'base_score')::numeric IS DISTINCT FROM 10
      OR (result->>'score')::numeric IS DISTINCT FROM 10
      OR (result->>'fit_signal_adjustment')::numeric IS DISTINCT FROM 0
      OR (result->>'fit_signal_sample_count')::integer IS DISTINCT FROM 0
      OR (result->>'aversion_penalty')::numeric IS DISTINCT FROM 0) THEN
      RAISE EXCEPTION 'Mixed-break history changed the exact profile: %',result; END IF;
    IF user_n=3 AND ((result->>'similar_good_session_count')::integer <> 0
      OR (result->>'good_session_count')::integer <> 5
      OR (result->'reason_bullets')::text LIKE '%0 of your%') THEN
      RAISE EXCEPTION 'Zero-similar count or copy wrong: %',result; END IF;
    IF user_n=1 AND result->>'board_class' <> 'shortboard' THEN RAISE EXCEPTION 'Thruster class: %',result; END IF;
    IF user_n=2 AND result->>'board_class' <> 'fish' THEN RAISE EXCEPTION 'Twin-pin class: %',result; END IF;
  END LOOP;
END $$;
-- A mixed-break bad session must not enter the aversion mean either.
DO $$
DECLARE result jsonb;
BEGIN
  UPDATE public.sessions SET rating=1 WHERE id=fixture_id(1011);
  SELECT public.compute_user_match_score_core(fixture_id(1),fixture_id(101),'3','12','4','90','3') INTO result;
  IF (result->>'base_score')::numeric IS DISTINCT FROM 10
    OR (result->>'aversion_penalty')::numeric IS DISTINCT FROM 0
    OR (result->>'aversion_sample_count')::integer IS DISTINCT FROM 0
    OR (result->>'fit_signal_adjustment')::numeric IS DISTINCT FROM 0
    OR (result->>'score')::numeric IS DISTINCT FROM 10
    OR (result->>'similar_good_session_count')::integer IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'Mixed-break bad session entered scoring: %',result;
  END IF;
  UPDATE public.sessions SET rating=5 WHERE id=fixture_id(1011);
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
-- At period 12, height deltas 1, 3 and 5 give distances 0.1823, 1.6407 and 4.5575:
-- exp(-distance/2) is 0.9129, 0.4403 and 0.1024. Only delta 1 clears 0.7.
-- Identical midpoints score 1; missing heights score 0. Counts below are 5,0,5,0,0.
UPDATE public.session_forecast_snapshots SET forecast_snapshot=jsonb_set(forecast_snapshot,'{wave_height}','"1-5 ft"')
WHERE session_id IN (SELECT id FROM public.sessions WHERE user_id=fixture_id(2));
DO $$
DECLARE actual jsonb[];
BEGIN
  SELECT array_agg(m.result ORDER BY m.slot_idx) INTO actual
  FROM public.compute_user_match_scores(fixture_id(2),ARRAY[fixture_id(101)],
    (SELECT jsonb_agg(jsonb_build_object('beach_id',fixture_id(101),'wave_height',wave,
      'wave_period','12','wind_speed','4','wind_direction','90','tide_height','3') ORDER BY ord)
     FROM (VALUES (1,'4 ft'),(2,'6 ft'),(3,'1-5 ft'),(4,'1-15 ft'),(5,'')) slots(ord,wave))) m;
  IF cardinality(actual) IS DISTINCT FROM 5
    OR actual[1]->>'similar_good_session_count' IS DISTINCT FROM '5'
    OR actual[2]->>'similar_good_session_count' IS DISTINCT FROM '0'
    OR actual[3]->>'similar_good_session_count' IS DISTINCT FROM '5'
    OR actual[4]->>'similar_good_session_count' IS DISTINCT FROM '0'
    OR actual[5]->>'similar_good_session_count' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'History/slot midpoint or scenario identity mismatch: %',actual;
  END IF;
  IF actual[3]->>'base_score' IS DISTINCT FROM '10.00'
    OR actual[3]->'score' IS DISTINCT FROM actual[4]->'score' THEN
    RAISE EXCEPTION 'Range parsing changed existing numeric scoring: %',actual;
  END IF;
END $$;

-- Open-Meteo rows store the tallest partition's period in wave_period; wave_period_om is the whole-sea mean
-- that CDIP/NWS periods measure. Similarity (only) compares OPEN_METEO rows by wave_period_om on both sides.
INSERT INTO public.profiles VALUES (fixture_id(4),'advanced'),(fixture_id(5),'advanced');
INSERT INTO public.sessions
SELECT fixture_id(1000+u*10+n), fixture_id(u), fixture_id(101), NULL, NULL,
  5, 'completed', now()-n*interval '1 day', NULL, NULL
FROM generate_series(4,5) u CROSS JOIN generate_series(1,5) n;
INSERT INTO public.session_forecast_snapshots
SELECT id, CASE WHEN user_id=fixture_id(4) THEN
  '{"wave_height":"3 ft","wave_period":"11s","wind_speed":"4 mph","wind_direction_deg":"90","tide_height":"3 ft","tide_status":"incoming","data_source":"CDIP"}'::jsonb
  ELSE '{"wave_height":"3 ft","wave_period":"5s","wave_period_om":9.9,"wind_speed":"4 mph","wind_direction_deg":"90","tide_height":"3 ft","tide_status":"incoming","data_source":"OPEN_METEO"}'::jsonb END
FROM public.sessions WHERE user_id IN (fixture_id(4),fixture_id(5));
UPDATE public.session_forecast_snapshots SET forecast_snapshot=jsonb_set(forecast_snapshot,'{wave_period_om}','"11"')
WHERE session_id IN (SELECT id FROM public.sessions WHERE user_id=fixture_id(5));
DO $$
DECLARE cdip_history jsonb[]; om_history jsonb[]; batch jsonb[]; single jsonb; slot_base jsonb; slots jsonb;
BEGIN
  slot_base := jsonb_build_object('beach_id',fixture_id(101),'wave_height','3 ft','wind_speed','4 mph',
    'wind_direction','90','tide_height','3 ft');
  -- Slots: 1 legacy (no keys); 2 OPEN_METEO; 3 lower-case open_meteo; 4 CDIP with a wave_period_om that must be
  -- ignored; 5 OPEN_METEO without a usable wave_period_om; 6 blank data_source (legacy).
  slots := jsonb_build_array(
    slot_base || '{"wave_period":"5"}',
    slot_base || '{"wave_period":"5","data_source":"OPEN_METEO","wave_period_om":"11"}',
    slot_base || '{"wave_period":"5","data_source":"open_meteo","wave_period_om":"11"}',
    slot_base || '{"wave_period":"5","data_source":"CDIP","wave_period_om":"11"}',
    slot_base || '{"wave_period":"5","data_source":"OPEN_METEO","wave_period_om":"0"}',
    slot_base || '{"wave_period":"5","data_source":"","wave_period_om":"11"}');
  SELECT array_agg(m.result ORDER BY m.slot_idx) INTO cdip_history
  FROM public.compute_user_match_scores(fixture_id(4),ARRAY[fixture_id(101)],slots) m;
  IF (SELECT array_agg(r->>'similar_good_session_count') FROM unnest(cdip_history) r)
    IS DISTINCT FROM ARRAY['0','5','5','0','0','0'] THEN
    RAISE EXCEPTION 'OPEN_METEO forecast vs CDIP history: %',cdip_history; END IF;
  -- Only similar_good_session_count may differ between a keyed and an unkeyed slot.
  IF (cdip_history[2] - 'similar_good_session_count') IS DISTINCT FROM (cdip_history[1] - 'similar_good_session_count')
    THEN RAISE EXCEPTION 'Score changed with slot keys: %',cdip_history; END IF;

  -- History side: OPEN_METEO snapshots (wave_period 5, wave_period_om 11) match an 11 s CDIP slot only when the slot
  -- carries data_source; a legacy slot keeps comparing wave_period.
  SELECT array_agg(m.result ORDER BY m.slot_idx) INTO om_history
  FROM public.compute_user_match_scores(fixture_id(5),ARRAY[fixture_id(101)],jsonb_build_array(
    slot_base || '{"wave_period":"11"}',
    slot_base || '{"wave_period":"11","data_source":"CDIP"}',
    slot_base || '{"wave_period":"5","data_source":"OPEN_METEO","wave_period_om":"11"}',
    slot_base || '{"wave_period":"5"}')) m;
  IF (SELECT array_agg(r->>'similar_good_session_count') FROM unnest(om_history) r)
    IS DISTINCT FROM ARRAY['0','5','5','5'] THEN
    RAISE EXCEPTION 'OPEN_METEO history snapshots: %',om_history; END IF;

  -- The wrapper forwards the optional keys and leaves the legacy shape alone.
  SELECT array_agg(m.result ORDER BY m.slot_idx) INTO batch
  FROM public.compute_user_match_score_batch(fixture_id(4),fixture_id(101),slots) m;
  IF batch IS DISTINCT FROM cdip_history THEN RAISE EXCEPTION 'Batch dropped the keys: % vs %',batch,cdip_history; END IF;
  -- The single-slot RPC has a fixed argument list and cannot carry them.
  single := public.compute_user_match_score_core(fixture_id(4),fixture_id(101),'3 ft','5','4 mph','90','3 ft');
  IF single->>'similar_good_session_count' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'Single-slot changed: %',single; END IF;
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
