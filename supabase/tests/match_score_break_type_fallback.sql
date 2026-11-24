\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-match-score-break-type-fallback-postgres.sh.
-- Pass -v skip_change=1 to run the checks without the migration; they must fail.
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
\ir ../migrations/20260929120000_match_score_om_similarity_period.sql
\ir ../migrations/20261002200000_match_score_missing_inputs_neutral.sql
\ir ../migrations/20261010140000_match_score_hashable_joins.sql

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- 101 beach, 102 jetty, 103 no break type (same wind and tide setup as 102), 104 reef.
INSERT INTO public.profiles VALUES (fixture_id(1),'advanced'),(fixture_id(2),'intermediate'),
  (fixture_id(3),'beginner'),(fixture_id(4),'advanced');
INSERT INTO public.beaches VALUES (fixture_id(101),'beach',90,1,5),(fixture_id(102),'jetty',270,2,4),
  (fixture_id(103),NULL,270,2,4),(fixture_id(104),'reef',200,1,3);
-- User 1: 20 beach sessions rated 1-5 (some with fit feedback) and one jetty session rated 3,
--   so the jetty and the reef have no 4+ session: the fallback rows.
-- User 2: 8 beach sessions rated 2 and one jetty session rated 3: no 4+ session anywhere.
-- User 3: 3 sessions (starter). User 4: 10 sessions rated 4-5 at the beach, jetty and reef (control).
INSERT INTO public.sessions
SELECT fixture_id(1000+user_n*100+n), fixture_id(user_n),
  CASE WHEN n = 0 THEN fixture_id(102) WHEN user_n = 4 THEN (ARRAY[fixture_id(101),fixture_id(102),fixture_id(104)])[1+(n % 3)] ELSE fixture_id(101) END,
  NULL, NULL,
  CASE WHEN n = 0 THEN 3 WHEN user_n = 2 THEN 2 WHEN user_n = 4 THEN 4+(n % 2) ELSE 1+(n % 5) END,
  'completed', now()-(n+1)*interval '1 day', NULL,
  CASE WHEN user_n = 1 AND n % 3 = 0 AND n > 0 THEN jsonb_build_object('version',1,
    'skill_fit',CASE WHEN n % 2 = 0 THEN 'dialed' ELSE 'over_my_head' END,'board_fit','right') END
FROM (VALUES (1,20),(2,8),(3,3),(4,10)) AS users(user_n,session_n)
CROSS JOIN LATERAL generate_series(CASE WHEN user_n IN (1,2) THEN 0 ELSE 1 END, session_n) n;
INSERT INTO public.session_forecast_snapshots
SELECT s.id, jsonb_build_object(
  'wave_height', (2+(k % 6))::text || ' ft', 'wave_period', (8+(k % 8))::text || 's',
  'wind_speed', (k % 18)::text || ' mph', 'wind_direction_deg', ((k*37) % 360)::text,
  'tide_height', ((k % 6)*0.7)::text || ' ft', 'tide_status', 'incoming')
FROM (SELECT id, row_number() OVER (ORDER BY id) k FROM public.sessions) s;

-- 48 hours per beach; the jetty (102) and the no-break beach (103) get the same conditions.
CREATE TABLE fixture_slots AS
SELECT jsonb_agg(slot ORDER BY idx) AS slots, count(*)::integer AS n FROM (
  SELECT b*1000+h AS idx, jsonb_strip_nulls(jsonb_build_object(
    'beach_id', fixture_id(100+b), 'forecast_at', 'h' || h,
    'wave_height', (1+(h % 8))::text, 'wave_period', (7+(h % 9))::text,
    'wind_speed', CASE WHEN h % 5 = 0 THEN '' ELSE (h % 20)::text END,
    'wind_direction', ((h*29) % 360)::text,
    'tide_height', CASE WHEN h % 4 = 0 THEN '-- ft' ELSE ((h % 8)*0.5)::text END,
    'data_source', CASE WHEN h % 2 = 0 THEN 'OPEN_METEO' ELSE 'CDIP' END,
    'wave_period_om', CASE WHEN h % 2 = 0 THEN (6+(h % 5))::text END)) AS slot
  FROM generate_series(1,4) b CROSS JOIN generate_series(0,47) h
) s;
CREATE FUNCTION all_scores() RETURNS TABLE(user_n integer, slot_idx integer, beach_id uuid, forecast_at text, result jsonb)
LANGUAGE sql AS $$
  SELECT u, m.* FROM generate_series(1,4) u
  CROSS JOIN LATERAL public.compute_user_match_scores(fixture_id(u),
    ARRAY[fixture_id(101),fixture_id(102),fixture_id(103),fixture_id(104)], (SELECT slots FROM fixture_slots)) m
$$;
CREATE FUNCTION scorer_settings() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', proacl::text, proconfig::text, prosecdef::text, provolatile::text)
  FROM pg_proc WHERE oid = 'public.compute_user_match_scores(uuid,uuid[],jsonb)'::regprocedure
$$;
CREATE TABLE scores_before AS SELECT * FROM all_scores();
CREATE TABLE settings_before AS SELECT scorer_settings() AS v;

\if :{?skip_change}
\else
\ir ../migrations/20261124120000_match_score_break_type_fallback.sql
\endif

DO $$
DECLARE n integer; bad integer; total integer;
BEGIN
  CREATE TEMP TABLE scores_after AS SELECT * FROM all_scores();
  SELECT count(*) INTO total FROM scores_after;
  IF total <> 4 * (SELECT f.n FROM fixture_slots f) OR total <> (SELECT count(*) FROM scores_before) THEN
    RAISE EXCEPTION 'Each slot must return one row, got % after and % before', total, (SELECT count(*) FROM scores_before);
  END IF;
  -- The fixtures must reach each case, or the checks prove less than they claim.
  SELECT count(*) INTO n FROM scores_before WHERE user_n = 1 AND beach_id IN (fixture_id(102),fixture_id(104))
    AND result->>'state' = 'avoidance_learned';
  IF n <> 96 THEN RAISE EXCEPTION 'User 1 jetty and reef rows must start as avoidance_learned, got % of 96', n; END IF;
  IF (SELECT count(DISTINCT result->>'state') FROM scores_before WHERE user_n = 3 AND result->>'state' = 'starter') <> 1
    OR (SELECT count(*) FROM scores_before WHERE user_n = 2 AND result->>'state' <> 'avoidance_learned') <> 0
    OR (SELECT count(*) FROM scores_before WHERE user_n = 4 AND result->>'score' IS NULL) <> 0 THEN
    RAISE EXCEPTION 'Fixtures must cover starter, avoidance-only and learned-control users';
  END IF;

  -- 1. Every row that had a score, every starter row and every row of a user with no 4+ session
  --    anywhere is unchanged, to the last field.
  SELECT count(*) INTO bad FROM scores_before b JOIN scores_after a USING (user_n, slot_idx)
  WHERE NOT (b.user_n = 1 AND b.beach_id IN (fixture_id(102),fixture_id(104)))
    AND a.result IS DISTINCT FROM b.result;
  IF bad <> 0 THEN RAISE EXCEPTION '% rows outside the fallback changed', bad; END IF;

  -- 2. The fallback rows now score, and say so.
  SELECT count(*) INTO bad FROM scores_after WHERE user_n = 1 AND beach_id IN (fixture_id(102),fixture_id(104))
    AND (result->>'state' <> 'learned' OR result->>'score' IS NULL OR result->>'profile_scope' IS DISTINCT FROM 'all_breaks');
  IF bad <> 0 THEN RAISE EXCEPTION '% user 1 jetty/reef rows did not fall back to the all-break profile', bad; END IF;
  SELECT count(*) INTO bad FROM scores_after WHERE result ? 'profile_scope'
    AND NOT (user_n = 1 AND beach_id IN (fixture_id(102),fixture_id(104)));
  IF bad <> 0 THEN RAISE EXCEPTION '% rows outside the fallback carry profile_scope', bad; END IF;

  -- 3. A fallback jetty row uses the same profile and fit evidence as the no-break beach on the
  --    same conditions (similar_good differs by design: it compares break families).
  SELECT count(*), count(*) FILTER (WHERE
    (j.result->>'score', j.result->>'label', j.result->>'base_score', j.result->>'aversion_penalty',
     j.result->>'aversion_sample_count', j.result->>'fit_signal_adjustment', j.result->>'fit_signal_sample_count',
     j.result->>'board_band_adjustment')
    IS DISTINCT FROM
    (x.result->>'score', x.result->>'label', x.result->>'base_score', x.result->>'aversion_penalty',
     x.result->>'aversion_sample_count', x.result->>'fit_signal_adjustment', x.result->>'fit_signal_sample_count',
     x.result->>'board_band_adjustment'))
  INTO n, bad
  FROM scores_after j JOIN scores_after x ON x.user_n = j.user_n AND x.forecast_at = j.forecast_at
    AND x.beach_id = fixture_id(103)
  WHERE j.user_n = 1 AND j.beach_id = fixture_id(102);
  IF n <> 48 OR bad <> 0 THEN RAISE EXCEPTION 'Jetty fallback must equal the no-break profile: % of % differ', bad, n; END IF;
  IF NOT EXISTS (SELECT 1 FROM scores_after WHERE user_n = 1 AND beach_id = fixture_id(102)
      AND (result->>'fit_signal_sample_count')::integer > 0) THEN
    RAISE EXCEPTION 'Fixtures must give the fallback rows fit evidence';
  END IF;

  -- 4. Grants, enable_nestloop, security and volatility are unchanged.
  IF scorer_settings() IS DISTINCT FROM (SELECT v FROM settings_before) THEN
    RAISE EXCEPTION 'Scorer settings changed: % -> %', (SELECT v FROM settings_before), scorer_settings();
  END IF;
END $$;

-- 5. Rollback: re-running 20261010140000 restores every row exactly.
\ir ../migrations/20261010140000_match_score_hashable_joins.sql
DO $$
DECLARE missing integer; extra integer;
BEGIN
  SELECT count(*) INTO missing FROM (SELECT * FROM scores_before EXCEPT ALL SELECT * FROM all_scores()) x;
  SELECT count(*) INTO extra FROM (SELECT * FROM all_scores() EXCEPT ALL SELECT * FROM scores_before) y;
  IF missing <> 0 OR extra <> 0 THEN RAISE EXCEPTION 'Rollback differs: missing %, extra %', missing, extra; END IF;
END $$;

SELECT 'match score break-type fallback checks passed' AS result;
