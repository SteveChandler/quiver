-- Quick Performance Indexes Migration (Safe for Transaction Blocks)
-- This version creates indexes WITHOUT CONCURRENTLY for immediate deployment
-- Use this for development or when you can afford brief table locks

-- WARNING: This will briefly lock tables during index creation
-- For zero-downtime production deployment, use the CONCURRENTLY version instead

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
-- Note: GIST is for PostGIS geometry types, BTREE works for numeric coordinates
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

-- Public sessions optimization
CREATE INDEX IF NOT EXISTS idx_sessions_public_recent 
ON sessions (created_at DESC) 
WHERE is_public = true;

-- Beach sessions optimization  
CREATE INDEX IF NOT EXISTS idx_sessions_beach_status_recent 
ON sessions (beach_id, status, created_at DESC)
WHERE status = 'completed';

-- User sessions optimization
CREATE INDEX IF NOT EXISTS idx_sessions_user_recent 
ON sessions (user_id, arrival_time DESC);

-- Foreign key indexes for lateral joins
CREATE INDEX IF NOT EXISTS idx_sessions_beach_id 
ON sessions (beach_id) WHERE beach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_board_id 
ON sessions (board_id) WHERE board_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_profile_id 
ON sessions (profile_id);

-- ================================================
-- 4. Supporting Table Indexes
-- ================================================

-- Profiles for session joins
CREATE INDEX IF NOT EXISTS idx_profiles_id_name_avatar 
ON profiles (id, full_name, avatar_url);

-- Boards for session joins  
CREATE INDEX IF NOT EXISTS idx_boards_id_name 
ON boards (id, name);

-- Comments count optimization
CREATE INDEX IF NOT EXISTS idx_comments_session_id 
ON comments (session_id) WHERE session_id IS NOT NULL;

-- User follows for realtime optimization
CREATE INDEX IF NOT EXISTS idx_user_follows_following_follower 
ON user_follows (following_id, follower_id);

-- ================================================
-- 5. Partial Indexes for Common Filters
-- ================================================

-- Active sessions only
CREATE INDEX IF NOT EXISTS idx_sessions_active 
ON sessions (user_id, created_at DESC, status)
WHERE status IN ('planned', 'active', 'completed');

-- Sessions with ratings (for quality metrics)
CREATE INDEX IF NOT EXISTS idx_sessions_rated 
ON sessions (beach_id, rating DESC, created_at DESC)
WHERE rating IS NOT NULL;

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
ANALYZE comments;
ANALYZE user_follows;

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

-- Success message
SELECT 'Performance indexes created successfully! Check index usage with: SELECT * FROM v_index_usage_stats;' AS status; 