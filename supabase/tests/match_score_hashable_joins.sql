\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-match-score-hashable-joins-postgres.sh.
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

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- Three beaches: complete, no tide preference, and no break type (the NULL-keyed join paths).
INSERT INTO public.profiles VALUES (fixture_id(1),'advanced'),(fixture_id(2),'intermediate'),
  (fixture_id(3),'beginner'),(fixture_id(4),'advanced');
INSERT INTO public.beaches VALUES (fixture_id(101),'beach',90,1,5),(fixture_id(102),'reef',270,NULL,NULL),
  (fixture_id(103),NULL,NULL,2,4);
-- User 1: 30 learned sessions across the beaches, some missing wind, direction or tide.
-- User 2: 8 sessions, all rated 2 (avoidance only). User 3: 3 sessions (starter). User 4: none.
INSERT INTO public.sessions
SELECT fixture_id(1000+user_n*100+n), fixture_id(user_n), fixture_id(101+(n % 3)), NULL, NULL,
  CASE WHEN user_n = 2 THEN 2 ELSE 1+(n % 5) END, 'completed', now()-n*interval '1 day', NULL, NULL
FROM (VALUES (1,30),(2,8),(3,3)) AS users(user_n,session_n)
CROSS JOIN LATERAL generate_series(1,session_n) n;
INSERT INTO public.session_forecast_snapshots
SELECT s.id, jsonb_strip_nulls(jsonb_build_object(
  'wave_height', (2+(k % 6))::text || ' ft',
  'wave_period', (8+(k % 8))::text || 's',
  'wind_speed', CASE WHEN k % 7 = 0 THEN NULL ELSE (k % 18)::text || ' mph' END,
  'wind_direction_deg', CASE WHEN k % 9 = 0 THEN NULL ELSE ((k*37) % 360)::text END,
  'tide_height', CASE WHEN k % 11 = 0 THEN '-- ft' ELSE ((k % 6)*0.7)::text || ' ft' END,
  'tide_status', 'incoming'))
FROM (SELECT id, row_number() OVER (ORDER BY id) k FROM public.sessions) s;

-- 240 slots per beach with repeated conditions (shared scenarios), missing factors and both
-- data-source families, plus every slot twice, so dedup and slot order are exercised.
CREATE TABLE fixture_slots AS
SELECT jsonb_agg(slot ORDER BY idx) || jsonb_agg(slot ORDER BY idx DESC) AS slots FROM (
  SELECT b*1000+h AS idx, jsonb_strip_nulls(jsonb_build_object(
    'beach_id', fixture_id(100+b),
    'forecast_at', to_char(timestamptz '2026-10-10 00:00+00' + h*interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"'),
    'wave_height', (1+(h % 7))::text,
    'wave_period', (7+(h % 9))::text,
    'wind_speed', CASE WHEN h % 5 = 0 THEN '' ELSE (h % 20)::text END,
    'wind_direction', CASE WHEN h % 6 = 0 THEN 'null' ELSE ((h*29) % 360)::text END,
    'tide_height', CASE WHEN h % 4 = 0 THEN '-- ft' ELSE ((h % 8)*0.5)::text END,
    'data_source', CASE WHEN h % 3 = 0 THEN 'OPEN_METEO' WHEN h % 3 = 1 THEN 'NOAA' END,
    'wave_period_om', CASE WHEN h % 3 = 0 THEN (6+(h % 5))::text END)) AS slot
  FROM generate_series(1,3) b CROSS JOIN generate_series(0,239) h
) s;
CREATE FUNCTION all_scores() RETURNS TABLE(user_n integer, slot_idx integer, beach_id uuid, forecast_at text, result jsonb)
LANGUAGE sql AS $$
  SELECT u, m.* FROM generate_series(1,4) u
  CROSS JOIN LATERAL public.compute_user_match_scores(fixture_id(u),
    ARRAY[fixture_id(101),fixture_id(102),fixture_id(103)], (SELECT slots FROM fixture_slots)) m
$$;
CREATE TABLE scores_before AS SELECT * FROM all_scores();

\ir ../migrations/20261010140000_match_score_hashable_joins.sql

DO $$
DECLARE before_n integer; after_n integer; missing integer; extra integer; states text;
BEGIN
  CREATE TEMP TABLE scores_after AS SELECT * FROM all_scores();
  SELECT count(*) INTO before_n FROM scores_before;
  SELECT count(*) INTO after_n FROM scores_after;
  SELECT count(*) INTO missing FROM (SELECT * FROM scores_before EXCEPT ALL SELECT * FROM scores_after) x;
  SELECT count(*) INTO extra FROM (SELECT * FROM scores_after EXCEPT ALL SELECT * FROM scores_before) y;
  IF before_n <> 4 * 1440 OR after_n <> before_n OR missing <> 0 OR extra <> 0 THEN
    RAISE EXCEPTION 'Hashable joins changed results: before %, after %, missing %, extra %',
      before_n, after_n, missing, extra;
  END IF;
  -- The fixtures must reach every result shape, or the comparison proves less than it claims.
  SELECT string_agg(DISTINCT result->>'state', ',' ORDER BY result->>'state') INTO states FROM scores_after;
  IF states IS DISTINCT FROM 'avoidance_learned,learned,starter' THEN
    RAISE EXCEPTION 'Fixtures must cover learned, avoidance and starter results, got %', states;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.compute_user_match_scores(uuid,uuid[],jsonb)'::regprocedure
    AND 'enable_nestloop=off' = ANY(proconfig)) THEN
    RAISE EXCEPTION 'compute_user_match_scores must run with enable_nestloop=off';
  END IF;
END $$;

SELECT 'match score hashable-joins checks passed' AS result;
