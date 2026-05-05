-- Migration: Maintain boards.session_count via trigger + backfill
--
-- Root cause: boards.session_count is read by native profile (you.tsx)
-- and web boards-manager, but no code or trigger ever increments it.
-- New boards are hardcoded to 0 (app/api/boards/route.ts), and the column
-- stays at 0 forever. Native profile shows "0 sessions" for every board.
--
-- Fix: trigger maintains the counter on session INSERT/UPDATE/DELETE,
-- plus one-time backfill from current sessions.

BEGIN;

CREATE OR REPLACE FUNCTION public.maintain_board_session_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.board_id IS NOT NULL THEN
      UPDATE boards
        SET session_count = COALESCE(session_count, 0) + 1
        WHERE id = NEW.board_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.board_id IS NOT NULL THEN
      UPDATE boards
        SET session_count = GREATEST(COALESCE(session_count, 0) - 1, 0)
        WHERE id = OLD.board_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.board_id IS DISTINCT FROM NEW.board_id THEN
      IF OLD.board_id IS NOT NULL THEN
        UPDATE boards
          SET session_count = GREATEST(COALESCE(session_count, 0) - 1, 0)
          WHERE id = OLD.board_id;
      END IF;
      IF NEW.board_id IS NOT NULL THEN
        UPDATE boards
          SET session_count = COALESCE(session_count, 0) + 1
          WHERE id = NEW.board_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_maintain_board_session_count ON sessions;

CREATE TRIGGER trigger_maintain_board_session_count
AFTER INSERT OR UPDATE OF board_id OR DELETE ON sessions
FOR EACH ROW
EXECUTE FUNCTION public.maintain_board_session_count();

UPDATE boards b
SET session_count = sub.cnt
FROM (
  SELECT board_id, COUNT(*) AS cnt
  FROM sessions
  WHERE board_id IS NOT NULL
  GROUP BY board_id
) sub
WHERE b.id = sub.board_id
  AND COALESCE(b.session_count, -1) <> sub.cnt;

UPDATE boards b
SET session_count = 0
WHERE COALESCE(b.session_count, 0) <> 0
  AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.board_id = b.id);

COMMIT;

-- Rollback:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_maintain_board_session_count ON sessions;
-- DROP FUNCTION IF EXISTS public.maintain_board_session_count();
-- COMMIT;
