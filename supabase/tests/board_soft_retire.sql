\set ON_ERROR_STOP on
-- Only the disposable cluster created by scripts/test-board-soft-retire-postgres.sh.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
  board_type text NOT NULL, dimensions text NOT NULL DEFAULT '6''0"'
);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, board_id uuid REFERENCES public.boards(id),
  rating integer, arrival_time timestamptz, custom_spot_id uuid, status text, deleted_at timestamptz
);
CREATE TABLE public.session_forecast_snapshots (session_id uuid PRIMARY KEY, forecast_snapshot jsonb);
CREATE TABLE public.custom_spots (id uuid PRIMARY KEY, offshore_direction_deg numeric);
\ir ../migrations/20260420180000_add_parse_numeric_from_text.sql
\ir ../migrations/20260605200531_enforce_board_limit.sql
-- get_bulk_forecast_decision_context reads tables this harness does not build.
SET check_function_bodies = off;
\ir ../migrations/20261028123624_board_soft_retire.sql
-- Applying twice must be a no-op.
\ir ../migrations/20261028123624_board_soft_retire.sql
RESET check_function_bodies;

CREATE FUNCTION pg_temp.insert_board(p_user uuid, p_name text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.boards (user_id, name, board_type) VALUES (p_user, p_name, 'shortboard');
  RETURN 'ok';
EXCEPTION WHEN check_violation THEN
  RETURN 'blocked';
END;
$$;

DO $$
DECLARE
  u constant uuid := '00000000-0000-0000-0000-000000000001';
  i integer;
  result text;
  retired_id uuid;
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM pg_temp.insert_board(u, 'board ' || i);
  END LOOP;

  result := pg_temp.insert_board(u, 'eleventh');
  IF result <> 'blocked' THEN RAISE EXCEPTION 'cap: 11th active board should be blocked, got %', result; END IF;

  SELECT id INTO retired_id FROM public.boards WHERE user_id = u ORDER BY name LIMIT 1;
  INSERT INTO public.sessions (user_id, board_id, rating, arrival_time, status)
    VALUES (u, retired_id, 5, now(), 'completed');
  UPDATE public.boards SET retired_at = now() WHERE id = retired_id;

  result := pg_temp.insert_board(u, 'replacement');
  IF result <> 'ok' THEN RAISE EXCEPTION 'cap: retiring a board should free a slot, got %', result; END IF;

  result := pg_temp.insert_board(u, 'twelfth');
  IF result <> 'blocked' THEN RAISE EXCEPTION 'cap: 10 active + 1 retired should block, got %', result; END IF;

  UPDATE public.boards SET retired_at = now()
    WHERE id IN (SELECT id FROM public.boards WHERE user_id = u AND retired_at IS NULL ORDER BY name LIMIT 4);
  FOR i IN 1..4 LOOP
    result := pg_temp.insert_board(u, 'refill ' || i);
    IF result <> 'ok' THEN RAISE EXCEPTION 'cap: refill % should fit, got %', i, result; END IF;
  END LOOP;
  result := pg_temp.insert_board(u, 'over');
  IF result <> 'blocked' THEN RAISE EXCEPTION 'cap: 10 active + 5 retired should block, got %', result; END IF;

  -- The retired board's session keeps its board.
  IF NOT EXISTS (SELECT 1 FROM public.sessions s JOIN public.boards b ON b.id = s.board_id WHERE b.id = retired_id) THEN
    RAISE EXCEPTION 'session lost its retired board';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  IF (SELECT count(*) FROM public.get_user_board_deck_stats(u)) <> 10 THEN
    RAISE EXCEPTION 'deck stats should list only the 10 active boards, got %',
      (SELECT count(*) FROM public.get_user_board_deck_stats(u));
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_user_board_deck_stats(u) WHERE board_id = retired_id) THEN
    RAISE EXCEPTION 'deck stats listed a retired board';
  END IF;
END;
$$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_user_board_deck_stats(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute get_user_board_deck_stats';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_user_board_deck_stats(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost get_user_board_deck_stats';
  END IF;
  IF has_function_privilege('authenticated', 'public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute get_bulk_forecast_decision_context';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_board_deck_stats' AND prosecdef) THEN
    RAISE EXCEPTION 'get_user_board_deck_stats is no longer SECURITY DEFINER';
  END IF;
  IF pg_get_functiondef('public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date)'::regprocedure)
       NOT LIKE '%FROM public.boards WHERE user_id=p_user_id AND retired_at IS NULL%' THEN
    RAISE EXCEPTION 'bulk decision context does not filter retired boards';
  END IF;
END;
$$;

\echo 'board soft retire: all checks passed'
