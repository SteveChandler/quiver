-- Rollback: Beach Affinity Tracking
-- Purpose: Safely remove beach affinity tracking infrastructure
-- Rolls back: 20251103000002_beach_affinity.sql

-- Drop trigger first (depends on function)
DROP TRIGGER IF EXISTS update_beach_affinity_trigger ON sessions;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_beach_affinity_on_session_change();

-- Drop affinity computation function
DROP FUNCTION IF EXISTS compute_beach_affinity(uuid, uuid);

-- Drop table (CASCADE will drop dependent objects if any)
DROP TABLE IF EXISTS user_beach_affinity CASCADE;
