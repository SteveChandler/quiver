-- Fix: Add SECURITY DEFINER to beach affinity trigger function
-- This allows the trigger to insert/update user_beach_affinity despite RLS
-- 
-- Problem: When creating a session, the trigger fires but has no INSERT/UPDATE
-- RLS policy on user_beach_affinity, causing "new row violates row-level 
-- security policy" errors.
--
-- Solution: SECURITY DEFINER runs the function with owner privileges, 
-- bypassing RLS. This is the standard pattern for trigger functions
-- maintaining computed/derived tables.

CREATE OR REPLACE FUNCTION update_beach_affinity_on_session_change()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
    SELECT
      NEW.user_id,
      NEW.beach_id,
      COUNT(*),
      MAX(arrival_time),
      compute_beach_affinity(NEW.user_id, NEW.beach_id)
    FROM sessions
    WHERE user_id = NEW.user_id AND beach_id = NEW.beach_id
    GROUP BY user_id, beach_id
    ON CONFLICT (user_id, beach_id) DO UPDATE SET
      session_count = EXCLUDED.session_count,
      last_surfed_at = EXCLUDED.last_surfed_at,
      affinity_score = EXCLUDED.affinity_score,
      computed_at = NOW();
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_beach_affinity
    WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    AND NOT EXISTS (
      SELECT 1 FROM sessions
      WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_beach_affinity_on_session_change IS 'Trigger function that automatically updates beach affinity when sessions are added, modified, or deleted. Uses SECURITY DEFINER to bypass RLS.';






