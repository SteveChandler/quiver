-- Safe Performance Indexes Migration 
-- This version checks for column existence before creating indexes
-- Works with any database schema

BEGIN;

-- ================================================
-- 1. Beach Reviews Optimization (88,315 calls!)
-- ================================================

-- Critical: Index for beach reviews by beach_id with rating sorting
CREATE INDEX IF NOT EXISTS idx_beach_reviews_beach_id_rating 
ON beach_reviews (beach_id, overall_rating DESC NULLS LAST);

-- Composite index for beach review aggregations
CREATE INDEX IF NOT EXISTS idx_beach_reviews_beach_stats 
ON beach_reviews (beach_id, overall_rating, wave_quality_rating, crowd_density_rating) 
WHERE overall_rating IS NOT NULL;

-- ================================================
-- 2. Beaches Table Optimization (4,336 calls)
-- ================================================

-- Primary pagination index: ORDER BY name ASC
CREATE INDEX IF NOT EXISTS idx_beaches_name_asc 
ON beaches (name ASC NULLS LAST);

-- Covering index for beach listings (avoid table lookups)
CREATE INDEX IF NOT EXISTS idx_beaches_list_covering 
ON beaches (name, id, latitude, longitude, description)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Geographic queries optimization (for numeric lat/lng)
CREATE INDEX IF NOT EXISTS idx_beaches_location_lat 
ON beaches (latitude)
WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_location_lng 
ON beaches (longitude)
WHERE longitude IS NOT NULL;

-- Composite index for bounding box queries
CREATE INDEX IF NOT EXISTS idx_beaches_location_composite 
ON beaches (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ================================================
-- 3. Sessions Table Optimization (2,462 calls)
-- ================================================

-- Critical: Sessions with created_at DESC ordering
CREATE INDEX IF NOT EXISTS idx_sessions_created_at_desc 
ON sessions (created_at DESC);

-- Check if is_public column exists before creating index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions' 
        AND column_name = 'is_public'
    ) THEN
        -- Public sessions optimization (only if is_public column exists)
        CREATE INDEX IF NOT EXISTS idx_sessions_public_recent 
        ON sessions (created_at DESC) 
        WHERE is_public = true;
        
        RAISE NOTICE 'Created index on sessions.is_public';
    ELSE
        RAISE NOTICE 'Column sessions.is_public does not exist - skipping index';
    END IF;
END $$;

-- Beach sessions optimization  
CREATE INDEX IF NOT EXISTS idx_sessions_beach_status_recent 
ON sessions (beach_id, status, created_at DESC)
WHERE status = 'completed';

-- Check if arrival_time column exists before creating index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions' 
        AND column_name = 'arrival_time'
    ) THEN
        -- User sessions optimization
        CREATE INDEX IF NOT EXISTS idx_sessions_user_recent 
        ON sessions (user_id, arrival_time DESC);
        
        RAISE NOTICE 'Created index on sessions.arrival_time';
    ELSE
        -- Fallback to created_at if arrival_time doesn't exist
        CREATE INDEX IF NOT EXISTS idx_sessions_user_recent_created 
        ON sessions (user_id, created_at DESC);
        
        RAISE NOTICE 'Used sessions.created_at instead of arrival_time for user sessions index';
    END IF;
END $$;

-- Foreign key indexes for lateral joins
CREATE INDEX IF NOT EXISTS idx_sessions_beach_id 
ON sessions (beach_id) WHERE beach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_board_id 
ON sessions (board_id) WHERE board_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_profile_id 
ON sessions (profile_id);

-- Alternative user_id index (in case profile_id doesn't exist)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
ON sessions (user_id);

-- ================================================
-- 4. Supporting Table Indexes
-- ================================================

-- Profiles for session joins
CREATE INDEX IF NOT EXISTS idx_profiles_id_name_avatar 
ON profiles (id, full_name, avatar_url);

-- Boards for session joins  
CREATE INDEX IF NOT EXISTS idx_boards_id_name 
ON boards (id, name);

-- Comments count optimization (check if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'comments'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_comments_session_id 
        ON comments (session_id) WHERE session_id IS NOT NULL;
        
        RAISE NOTICE 'Created index on comments.session_id';
    ELSE
        RAISE NOTICE 'Comments table does not exist - skipping index';
    END IF;
END $$;

-- User follows for realtime optimization (check if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_follows'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_user_follows_following_follower 
        ON user_follows (following_id, follower_id);
        
        RAISE NOTICE 'Created index on user_follows';
    ELSE
        RAISE NOTICE 'user_follows table does not exist - skipping index';
    END IF;
END $$;

-- ================================================
-- 5. Partial Indexes for Common Filters (Safe)
-- ================================================

-- Active sessions only (using common status values)
CREATE INDEX IF NOT EXISTS idx_sessions_active 
ON sessions (user_id, created_at DESC, status)
WHERE status IN ('planned', 'active', 'completed');

-- Sessions with ratings (check if rating column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions' 
        AND column_name = 'rating'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_sessions_rated 
        ON sessions (beach_id, rating DESC, created_at DESC)
        WHERE rating IS NOT NULL;
        
        RAISE NOTICE 'Created index on sessions.rating';
    ELSE
        RAISE NOTICE 'Column sessions.rating does not exist - skipping index';
    END IF;
END $$;

-- Recent activity index (without time-based predicate since NOW() is not immutable)
CREATE INDEX IF NOT EXISTS idx_sessions_recent_activity 
ON sessions (created_at DESC, beach_id);

-- ================================================
-- 6. Statistics Update
-- ================================================

-- Update table statistics after creating indexes
ANALYZE beaches;
ANALYZE sessions; 
ANALYZE beach_reviews;
ANALYZE profiles;
ANALYZE boards;

-- Analyze optional tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comments') THEN
        ANALYZE comments;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_follows') THEN
        ANALYZE user_follows;
    END IF;
END $$;

-- ================================================
-- 7. Monitor Index Usage
-- ================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW v_index_usage_stats AS
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan > 0 THEN round((idx_tup_read::numeric / idx_scan), 2)
        ELSE 0 
    END as avg_tuples_per_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

COMMIT;

-- Success message with schema info
SELECT 
    'Performance indexes created successfully!' as status,
    'Run: SELECT * FROM v_index_usage_stats;' as next_step,
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables; 