-- Comprehensive Performance Optimization Migration
-- This migration addresses the top performance bottlenecks identified in the query analytics:
-- 1. Beach queries (4,336 calls) - Simple pagination with ORDER BY name ASC
-- 2. Session queries with complex joins (2,183 calls) - Lateral joins to beaches, boards, profiles  
-- 3. Individual beach lookups (261 calls) - Single beach queries
-- 4. General PostgREST query patterns

-- ================================================
-- 1. Beach Table Optimizations
-- ================================================

-- Primary index for beach pagination (ORDER BY "name" ASC)
CREATE INDEX IF NOT EXISTS idx_beaches_name_asc ON beaches (name ASC);

-- Composite index for beach queries with filtering
CREATE INDEX IF NOT EXISTS idx_beaches_name_id ON beaches (name, id);

-- Index for beach lookups by ID (single beach queries)
CREATE INDEX IF NOT EXISTS idx_beaches_id_name ON beaches (id, name);

-- Covering index for common beach fields to avoid table lookups
CREATE INDEX IF NOT EXISTS idx_beaches_covering ON beaches (id, name, latitude, longitude, description) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ================================================
-- 2. Sessions Table Optimizations (High Priority)
-- ================================================

-- Critical: Index for sessions pagination (ORDER BY "created_at" DESC)
CREATE INDEX IF NOT EXISTS idx_sessions_created_at_desc ON sessions (created_at DESC);

-- Critical: Foreign key indexes for lateral joins
CREATE INDEX IF NOT EXISTS idx_sessions_beach_id ON sessions (beach_id) WHERE beach_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_board_id ON sessions (board_id) WHERE board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON sessions (profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- Composite index for user sessions (getUserSessions pattern)
CREATE INDEX IF NOT EXISTS idx_sessions_user_arrival_desc ON sessions (user_id, arrival_time DESC);

-- Composite index for public sessions
CREATE INDEX IF NOT EXISTS idx_sessions_public_created_desc ON sessions (is_public, created_at DESC) 
WHERE is_public = true;

-- Composite index for completed sessions by beach
CREATE INDEX IF NOT EXISTS idx_sessions_beach_status_created ON sessions (beach_id, status, created_at DESC) 
WHERE status = 'completed';

-- Composite index for sessions with all join keys (covering index)
CREATE INDEX IF NOT EXISTS idx_sessions_covering_joins ON sessions (id, user_id, profile_id, beach_id, board_id, created_at DESC, status);

-- ================================================
-- 3. Supporting Table Optimizations
-- ================================================

-- Profiles table (frequent joins from sessions)
CREATE INDEX IF NOT EXISTS idx_profiles_id_name ON profiles (id, full_name, avatar_url);

-- Boards table (frequent joins from sessions)  
CREATE INDEX IF NOT EXISTS idx_boards_id_name ON boards (id, name, user_id);
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards (user_id);

-- Beach Reviews (if causing performance issues)
CREATE INDEX IF NOT EXISTS idx_beach_reviews_beach_created ON beach_reviews (beach_id, created_at DESC);

-- ================================================
-- 4. Optimize Existing Performance Migration
-- ================================================

-- Ensure the enhanced forecasts optimizations from previous migration are complete
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_date_time ON enhanced_forecasts (beach_id, forecast_date, forecast_time);

-- ================================================
-- 5. PostgREST Specific Optimizations
-- ================================================

-- Create materialized view for frequently accessed session data
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_session_summary AS
SELECT 
    s.id,
    s.user_id,
    s.profile_id,
    s.beach_id,
    s.board_id,
    s.beach_name,
    s.status,
    s.created_at,
    s.arrival_time,
    s.is_public,
    s.rating,
    s.likes_count,
    s.comments_count,
    -- Include related data to avoid joins
    b.name as beach_name_resolved,
    p.full_name as user_name,
    p.avatar_url as user_avatar,
    board.name as board_name
FROM sessions s
LEFT JOIN beaches b ON s.beach_id = b.id
LEFT JOIN profiles p ON s.profile_id = p.id  
LEFT JOIN boards board ON s.board_id = board.id
WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'; -- Only recent sessions

-- Index the materialized view
CREATE INDEX IF NOT EXISTS idx_mv_session_summary_created_desc ON mv_session_summary (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mv_session_summary_user_id ON mv_session_summary (user_id);
CREATE INDEX IF NOT EXISTS idx_mv_session_summary_public ON mv_session_summary (is_public, created_at DESC) WHERE is_public = true;

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_session_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_summary;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 6. Query Plan Optimizations
-- ================================================

-- Increase statistics target for commonly filtered columns
ALTER TABLE beaches ALTER COLUMN name SET STATISTICS 1000;
ALTER TABLE sessions ALTER COLUMN created_at SET STATISTICS 1000;
ALTER TABLE sessions ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE sessions ALTER COLUMN beach_id SET STATISTICS 1000;

-- ================================================
-- 7. Cleanup and Maintenance
-- ================================================

-- Remove any potentially unused indexes that might slow down writes
DROP INDEX IF EXISTS idx_buoys_uuid; -- Duplicate index mentioned in original migration

-- Create function to analyze tables after bulk operations
CREATE OR REPLACE FUNCTION analyze_performance_tables()
RETURNS void AS $$
BEGIN
    ANALYZE beaches;
    ANALYZE sessions;
    ANALYZE profiles;
    ANALYZE boards;
    ANALYZE beach_reviews;
    ANALYZE enhanced_forecasts;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 8. Monitoring and Maintenance Schedule
-- ================================================

-- Create a function to get query statistics for monitoring
CREATE OR REPLACE FUNCTION get_query_performance_stats()
RETURNS TABLE (
    query_type TEXT,
    avg_time_ms NUMERIC,
    total_calls BIGINT,
    table_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Beach pagination' as query_type,
        0.0 as avg_time_ms, -- Placeholder - would need pg_stat_statements
        0::bigint as total_calls,
        'beaches' as table_name
    UNION ALL
    SELECT 
        'Session joins' as query_type,
        0.0 as avg_time_ms,
        0::bigint as total_calls, 
        'sessions' as table_name;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 9. Application-Level Optimization Suggestions
-- ================================================

-- Create a view for efficient session listing (alternative to complex joins)
CREATE OR REPLACE VIEW v_sessions_with_names AS
SELECT 
    s.*,
    COALESCE(b.name, s.beach_name) as display_beach_name,
    p.full_name as user_full_name,
    p.avatar_url as user_avatar_url,
    board.name as board_name
FROM sessions s
LEFT JOIN beaches b ON s.beach_id = b.id
LEFT JOIN profiles p ON s.profile_id = p.id
LEFT JOIN boards board ON s.board_id = board.id;

-- Create indexes on the view's underlying queries
CREATE INDEX IF NOT EXISTS idx_sessions_view_support ON sessions (id, beach_id, profile_id, board_id, created_at DESC);

-- ================================================
-- 10. Success Message and Recommendations
-- ================================================

DO $$
BEGIN
    -- Run analysis on optimized tables
    PERFORM analyze_performance_tables();
    
    RAISE NOTICE '✅ Comprehensive performance optimizations applied successfully!';
    RAISE NOTICE '   📊 Beach queries: Added pagination and covering indexes';
    RAISE NOTICE '   🔗 Session joins: Added foreign key and composite indexes';
    RAISE NOTICE '   📈 Materialized view: Created for recent sessions (auto-refresh recommended)';
    RAISE NOTICE '   📋 Query statistics: Enhanced for better query planning';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Recommendations:';
    RAISE NOTICE '   1. Set up cron job to refresh mv_session_summary every 15 minutes';
    RAISE NOTICE '   2. Consider using v_sessions_with_names view for simple session lists';
    RAISE NOTICE '   3. Monitor query performance with pg_stat_statements';
    RAISE NOTICE '   4. Consider implementing Redis caching for beach lists';
    RAISE NOTICE '   5. Review and optimize any remaining slow queries';
END $$; 