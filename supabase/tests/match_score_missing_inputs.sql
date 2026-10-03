\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-match-score-missing-inputs-postgres.sh.
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
-- User 1: five complete sessions. User 2: the same, but one session has no wind.
INSERT INTO public.profiles VALUES (fixture_id(1),'advanced'),(fixture_id(2),'advanced');
INSERT INTO public.beaches VALUES (fixture_id(101),'beach',90,1,5);
INSERT INTO public.sessions
SELECT fixture_id(1000+u*10+n), fixture_id(u), fixture_id(101), NULL, NULL,
  5, 'completed', now()-n*interval '1 day', NULL, NULL
FROM generate_series(1,2) u CROSS JOIN generate_series(1,5) n;
INSERT INTO public.session_forecast_snapshots
SELECT id, CASE WHEN user_id=fixture_id(2) AND id=fixture_id(1021) THEN
  '{"wave_height":"3 ft","wave_period":"12s","wind_direction_deg":"270","tide_height":"3 ft","tide_status":"incoming"}'::jsonb
  ELSE '{"wave_height":"3 ft","wave_period":"12s","wind_speed":"10 mph","wind_direction_deg":"270","tide_height":"3 ft","tide_status":"incoming"}'::jsonb END
FROM public.sessions;

CREATE FUNCTION slot(label text, wind text, dir text, tide text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('beach_id',fixture_id(101),'forecast_at',label,
    'wave_height','3 ft','wave_period','12s','wind_speed',wind,'wind_direction',dir,'tide_height',tide))
$$;
CREATE FUNCTION scores(user_n integer, slots jsonb) RETURNS TABLE(label text, result jsonb) LANGUAGE sql AS $$
  SELECT forecast_at, result FROM public.compute_user_match_scores(fixture_id(user_n),ARRAY[fixture_id(101)],slots)
$$;
CREATE FUNCTION base_score(user_n integer, s jsonb) RETURNS numeric LANGUAGE sql AS $$
  SELECT (result->>'base_score')::numeric FROM scores(user_n, jsonb_build_array(s))
$$;

-- Complete slots before the change; they must score identically after it.
CREATE TABLE complete_before AS
SELECT * FROM scores(1, jsonb_build_array(
  slot('match','10 mph','270','3 ft'), slot('mismatch','22 mph','0','6 ft'), slot('calm','0 mph','90','1 ft')));

\if :{?skip_change}
\else
\ir ../migrations/20261002200000_match_score_missing_inputs_neutral.sql
\endif

DO $$
DECLARE r record; n integer; v numeric;
BEGIN
  -- 1. Complete slots are unchanged, to the last field.
  FOR r IN SELECT b.label, b.result AS before, a.result AS after
    FROM complete_before b LEFT JOIN scores(1, jsonb_build_array(
      slot('match','10 mph','270','3 ft'), slot('mismatch','22 mph','0','6 ft'), slot('calm','0 mph','90','1 ft'))) a
      USING (label) LOOP
    IF r.after IS DISTINCT FROM r.before THEN
      RAISE EXCEPTION 'Complete slot % changed: before %, after %', r.label, r.before, r.after;
    END IF;
  END LOOP;

  -- 2. A slot missing a factor still returns a learned result.
  SELECT count(*) INTO n FROM scores(1, jsonb_build_array(slot('no wind',NULL,'270','3 ft'),
    slot('null text','null','null','-- ft'), slot('all missing',NULL,NULL,NULL))) WHERE result->>'state' = 'learned';
  IF n <> 3 THEN RAISE EXCEPTION 'Slots with missing factors must still return a learned result, got % of 3', n; END IF;

  -- 3. Missing wind is neutral: half a miss of its 0.20 weight, whatever the profile prefers.
  v := base_score(1, slot('no wind',NULL,'270','3 ft'));
  IF v IS DISTINCT FROM 9.00 THEN RAISE EXCEPTION 'Missing wind should cost half its weight (base 9), got %', v; END IF;
  IF base_score(1, slot('empty wind','','270','3 ft')) IS DISTINCT FROM v
    OR base_score(1, slot('null wind','null','270','3 ft')) IS DISTINCT FROM v THEN
    RAISE EXCEPTION 'Absent, empty and "null" wind must all be missing';
  END IF;

  -- 4. A real calm is still 0 mph: 10 mph preferred, so it costs 0.20 of the score.
  v := base_score(1, slot('calm','0 mph','270','3 ft'));
  IF v IS DISTINCT FROM 8.00 THEN RAISE EXCEPTION 'Real 0 mph should score as calm (base 8), got %', v; END IF;

  -- 5. Missing tide ("-- ft" or absent) is half a miss; a real 0 ft is a full one (3 ft preferred).
  IF base_score(1, slot('dash tide','10 mph','270','-- ft')) IS DISTINCT FROM 9.50
    OR base_score(1, slot('no tide','10 mph','270',NULL)) IS DISTINCT FROM 9.50 THEN
    RAISE EXCEPTION 'Missing tide should cost half its weight (base 9.5)';
  END IF;
  IF base_score(1, slot('zero tide','10 mph','270','0 ft')) IS DISTINCT FROM 9.00 THEN
    RAISE EXCEPTION 'A real 0 ft tide must still count as a full miss (base 9)';
  END IF;

  -- 6. Missing direction is half a miss; a real 90 degrees is opposite the preferred 270, a full one.
  IF base_score(1, slot('no dir','10 mph','null','3 ft')) IS DISTINCT FROM 9.50 THEN
    RAISE EXCEPTION 'Missing direction should cost half its weight (base 9.5)';
  END IF;
  v := base_score(1, slot('opposite','10 mph','90','3 ft'));
  IF v IS DISTINCT FROM 9.00 THEN RAISE EXCEPTION 'An opposite wind should cost the full 0.10 (base 9), got %', v; END IF;

  -- 6b. All three missing: half of 0.40, whatever the profile prefers.
  v := base_score(1, slot('all missing',NULL,NULL,NULL));
  IF v IS DISTINCT FROM 8.00 THEN RAISE EXCEPTION 'All three missing should cost half their 0.40 (base 8), got %', v; END IF;

  -- 7. A session with no wind does not drag the preferred wind toward 0 mph.
  v := base_score(2, slot('match','10 mph','270','3 ft'));
  IF v IS DISTINCT FROM 10.00 THEN RAISE EXCEPTION 'A session missing wind must not count as 0 mph (base 10), got %', v; END IF;

  -- 8. The single-slot RPC installed clients call still answers for missing inputs.
  IF (public.compute_user_match_score(fixture_id(1),fixture_id(101),'3 ft','12s','null','null','-- ft'))->>'state'
    IS DISTINCT FROM 'learned' THEN
    RAISE EXCEPTION 'Single-slot RPC must still return a learned result for missing inputs';
  END IF;
END $$;

SELECT 'match score missing-inputs checks passed' AS result;
