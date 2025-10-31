-- Fix session forecast snapshot trigger to handle INSERT events
--
-- PROBLEM: The existing trigger only fires on UPDATE, not INSERT.
-- This means sessions created with status='completed' directly (which is 95%+ of sessions)
-- never trigger the snapshot creation function.
--
-- SOLUTION: Update the trigger to fire on both INSERT and UPDATE events.

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON sessions;

-- Recreate the trigger to handle both INSERT and UPDATE when the function signature supports it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'create_session_forecast_snapshot'
      AND pronamespace = 'public'::regnamespace
      AND pronargs = 0
  ) THEN
    CREATE TRIGGER trigger_create_session_forecast_snapshot
      AFTER INSERT OR UPDATE OF status ON sessions
      FOR EACH ROW
      WHEN (NEW.status = 'completed')
      EXECUTE FUNCTION create_session_forecast_snapshot();
  ELSE
    RAISE NOTICE 'create_session_forecast_snapshot() function not found, skipping trigger recreation';
  END IF;
END $$;

-- NOTE: We simplified the trigger condition to just check if NEW.status = 'completed'.
-- This works for both INSERT (where OLD doesn't exist) and UPDATE (where status changes).
-- The function itself handles duplicate prevention via the unique constraint on session_id.
