-- Add board_snapshot JSONB column to sessions table
-- This stores a snapshot of board details at the time of the session
-- Format: {name, board_type, size, volume, dimensions}
-- Allows historical tracking even if the board is later modified or deleted

BEGIN;

-- Add board_snapshot column
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS board_snapshot jsonb DEFAULT NULL;

-- Add column comment
COMMENT ON COLUMN public.sessions.board_snapshot IS
  'Snapshot of board details at session time. Stores {name, board_type, size, volume, dimensions} to preserve historical data even if board is modified or deleted.';

-- Create composite index for efficient querying of user's highly-rated completed sessions
-- This supports queries like "show me my best sessions" or "what boards worked well"
CREATE INDEX IF NOT EXISTS idx_sessions_user_rated_completed
  ON public.sessions (user_id, rating DESC, arrival_time DESC)
  WHERE status = 'completed' AND rating IS NOT NULL AND rating >= 3;

COMMIT;

-- Rollback instructions:
-- To reverse this migration, run:
--
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_sessions_user_rated_completed;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS board_snapshot;
-- COMMIT;
