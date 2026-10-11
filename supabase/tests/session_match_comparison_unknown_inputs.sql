\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-session-match-comparison-postgres.sh.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.boards (id uuid PRIMARY KEY, name text);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY, user_id uuid, beach_id uuid, board_id uuid,
  board_snapshot jsonb, rating integer, status text, arrival_time timestamptz,
  deleted_at timestamptz
);
CREATE TABLE public.session_forecast_snapshots (session_id uuid PRIMARY KEY, forecast_snapshot jsonb);
\ir ../migrations/20261010180000_session_match_comparison_unknown_inputs.sql

CREATE FUNCTION fixture_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
-- Five rated sessions at one beach: a clean five-star day, a five-star day logged
-- with tide "-- ft", one with no period, and two average days for the count.
INSERT INTO public.sessions VALUES
  (fixture_id(11), fixture_id(1), fixture_id(101), NULL, '{"name":"Twin"}', 5, 'completed', now()-interval '3 days', NULL),
  (fixture_id(12), fixture_id(1), fixture_id(101), NULL, NULL, 5, 'completed', now()-interval '4 days', NULL),
  (fixture_id(13), fixture_id(1), fixture_id(101), NULL, NULL, 5, 'completed', now()-interval '5 days', NULL),
  (fixture_id(14), fixture_id(1), fixture_id(101), NULL, NULL, 3, 'completed', now()-interval '6 days', NULL),
  (fixture_id(15), fixture_id(1), fixture_id(101), NULL, NULL, 3, 'completed', now()-interval '7 days', NULL);
INSERT INTO public.session_forecast_snapshots VALUES
  (fixture_id(11), '{"wave_height":"3 ft","wave_period":"14s","wind_speed":"5 mph","wind_direction_deg":"90","tide_height":"2 ft"}'),
  (fixture_id(12), '{"wave_height":"3 ft","wave_period":"14s","wind_speed":"5 mph","wind_direction_deg":"90","tide_height":"-- ft"}'),
  (fixture_id(13), '{"wave_height":"3 ft","wave_period":null,"wind_speed":"5 mph","wind_direction_deg":"90","tide_height":"0.2 ft"}'),
  (fixture_id(14), '{"wave_height":"6 ft","wave_period":"9s","wind_speed":"15 mph","wind_direction_deg":"270","tide_height":"5 ft"}'),
  (fixture_id(15), '{"wave_height":"6 ft","wave_period":"9s","wind_speed":"15 mph","wind_direction_deg":"270","tide_height":"5 ft"}');

SELECT set_config('request.jwt.claim.sub', fixture_id(1)::text, false);

DO $$
DECLARE
  known_tide jsonb := public.get_user_session_match_comparison(
    fixture_id(1), fixture_id(101), '3 ft', '14s', '5 mph', '90', '0.2 ft');
  unknown_tide jsonb := public.get_user_session_match_comparison(
    fixture_id(1), fixture_id(101), '3 ft', '14s', NULL, '90', NULL);
BEGIN
  -- A tide that was never recorded must not read as 0 ft and win on a 0.2 ft forecast,
  -- and a session without a period must not win on a period it never had.
  IF known_tide->>'state' <> 'ready'
    OR known_tide->'positive_session'->>'session_id' <> fixture_id(11)::text THEN
    RAISE EXCEPTION 'expected the clean session to be nearest, got %', known_tide;
  END IF;
  IF (known_tide->'positive_session'->'deltas'->>'tide')::numeric <> -1.8 THEN
    RAISE EXCEPTION 'expected a real tide delta of -1.8, got %', known_tide;
  END IF;
  -- A forecast without wind or tide gets null differences, not ones measured from 0.
  IF unknown_tide->'positive_session'->'deltas'->'tide' <> 'null'::jsonb
    OR unknown_tide->'positive_session'->'deltas'->'wind' <> 'null'::jsonb
    OR (unknown_tide->'positive_session'->'deltas'->>'waves')::numeric <> 0 THEN
    RAISE EXCEPTION 'expected null wind and tide deltas, got %', unknown_tide;
  END IF;
  IF public.parse_numeric_or_null('-1.2 ft') <> -1.2
    OR public.parse_numeric_or_null('-- ft') IS NOT NULL
    OR public.parse_numeric_or_null(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'parse_numeric_or_null mis-parses';
  END IF;
  RAISE NOTICE 'session match comparison: unknown inputs stay unknown';
END $$;
