-- Add Missing Foreign Key Indexes
-- Addresses "Unindexed foreign keys" linter warnings
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- Foreign key indexes improve performance for:
-- - JOIN operations
-- - DELETE operations (checking referential integrity)
-- - UPDATE operations on referenced tables

-- ================================================
-- BEACH_RECOMMENDATION_CALIBRATION TABLE
-- ================================================

-- Index for beach_id foreign key
CREATE INDEX IF NOT EXISTS idx_beach_recommendation_calibration_beach_id 
ON public.beach_recommendation_calibration(beach_id);

-- ================================================
-- FAVORITE_BEACHES TABLE
-- ================================================

-- Index for beach_id foreign key
CREATE INDEX IF NOT EXISTS idx_favorite_beaches_beach_id 
ON public.favorite_beaches(beach_id);

-- ================================================
-- SESSIONS TABLE
-- ================================================

-- Index for board_id foreign key
CREATE INDEX IF NOT EXISTS idx_sessions_board_id 
ON public.sessions(board_id);

-- Index for profile_id foreign key
CREATE INDEX IF NOT EXISTS idx_sessions_profile_id 
ON public.sessions(profile_id);

-- ================================================
-- NOTES
-- ================================================

-- These indexes will improve query performance for:
-- 
-- 1. beach_recommendation_calibration.beach_id:
--    - JOINs between beach_recommendation_calibration and beaches
--    - Deleting beaches with calibration data
--
-- 2. favorite_beaches.beach_id:
--    - Finding all users who favorited a beach
--    - Deleting beaches with favorites
--    - JOINs for beach popularity queries
--
-- 3. sessions.board_id:
--    - Finding all sessions with a specific board
--    - Board usage statistics
--    - Deleting boards with sessions
--
-- 4. sessions.profile_id:
--    - User session history queries (highly used)
--    - User profile deletions
--    - Activity feed queries
--
-- Expected Impact:
-- - Faster queries involving these foreign keys
-- - Better query planning from PostgreSQL
-- - Reduced table scans on large tables (especially sessions)
-- - Minimal storage overhead (~1-5% of table size per index)

