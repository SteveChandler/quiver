BEGIN;

-- Keep the board cap authoritative at the database layer so native, web, and
-- direct API writes cannot bypass the product limit.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_boards_user_id_fkey
  ON public.boards (user_id);

CREATE OR REPLACE FUNCTION private.enforce_user_board_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  existing_board_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT count(*)
  INTO existing_board_count
  FROM public.boards
  WHERE user_id = NEW.user_id;

  IF existing_board_count >= 10 THEN
    RAISE EXCEPTION 'board_limit_reached'
      USING
        ERRCODE = '23514',
        DETAIL = 'user_board_limit_10',
        HINT = 'Retire a board before adding another.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_user_board_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.enforce_user_board_limit() FROM anon;
REVOKE ALL ON FUNCTION private.enforce_user_board_limit() FROM authenticated;

COMMENT ON FUNCTION private.enforce_user_board_limit()
  IS 'Enforces the app-wide limit of 10 boards per user before inserts.';

DROP TRIGGER IF EXISTS enforce_user_board_limit_on_insert ON public.boards;

CREATE TRIGGER enforce_user_board_limit_on_insert
  BEFORE INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_user_board_limit();

COMMIT;
