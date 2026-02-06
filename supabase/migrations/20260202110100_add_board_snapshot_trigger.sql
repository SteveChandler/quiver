-- Migration: Add Board Snapshot Database Trigger
-- Impact: Only 0.9% of sessions capture board data (should be ~95%+)
-- Priority: P0 (Critical)
--
-- Root cause: Application-driven capture fails silently when board_id is null or lookup fails
-- Solution: Database trigger ensures snapshot is always captured when board_id is present

BEGIN;

-- Create the trigger function to capture board snapshot
-- Note: SECURITY DEFINER is intentional here - it allows the trigger to read board data
-- regardless of RLS policies, since the snapshot should be captured for any valid session
-- even if the user's RLS access to the boards table is restricted.
CREATE OR REPLACE FUNCTION capture_board_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only capture if board_id is provided and snapshot is null
  IF NEW.board_id IS NOT NULL AND NEW.board_snapshot IS NULL THEN
    SELECT jsonb_build_object(
      'name', b.name,
      'board_type', b.board_type,
      'size', b.size,
      'volume', b.volume,
      'dimensions', b.dimensions
    ) INTO NEW.board_snapshot
    FROM boards b
    WHERE b.id = NEW.board_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_capture_board_snapshot ON sessions;

-- Create the trigger on sessions table
CREATE TRIGGER trigger_capture_board_snapshot
BEFORE INSERT OR UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION capture_board_snapshot();

-- Temporarily disable the beach affinity trigger to avoid FK issues during backfill
-- (Some sessions have user_ids that don't exist in auth.users)
ALTER TABLE sessions DISABLE TRIGGER update_beach_affinity_trigger;

-- Backfill existing sessions that have board_id but no snapshot
-- This updates sessions where the board still exists
UPDATE sessions s
SET board_snapshot = jsonb_build_object(
  'name', b.name,
  'board_type', b.board_type,
  'size', b.size,
  'volume', b.volume,
  'dimensions', b.dimensions
)
FROM boards b
WHERE s.board_id = b.id
  AND s.board_snapshot IS NULL;

-- Re-enable the beach affinity trigger
ALTER TABLE sessions ENABLE TRIGGER update_beach_affinity_trigger;

COMMIT;

-- Verification query (run manually):
-- SELECT
--   COUNT(*) as total_with_board_id,
--   COUNT(board_snapshot) as with_snapshot,
--   ROUND(100.0 * COUNT(board_snapshot) / NULLIF(COUNT(*), 0), 1) as capture_rate_pct
-- FROM sessions
-- WHERE board_id IS NOT NULL;

-- Rollback procedure:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_capture_board_snapshot ON sessions;
-- DROP FUNCTION IF EXISTS capture_board_snapshot();
-- COMMIT;
