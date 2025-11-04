-- Rollback: Phase 5 Workpath 5.1 - User Surf Preferences
-- Purpose: Remove user_surf_preferences table if migration needs to be reverted
-- Date: 2025-11-03

-- Drop the table (CASCADE removes all dependencies)
DROP TABLE IF EXISTS user_surf_preferences CASCADE;

-- Note: This is a safe rollback as the table is only used by the preference
-- learning service (Workpath 5.2) which hasn't been implemented yet.
-- No application code depends on this table at this stage.
