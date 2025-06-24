-- Performance Optimization Status Check
-- Run this to verify the optimizations are working and identify remaining issues

-- ================================================
-- 1. Check if our indexes were created
-- ================================================

SELECT 
    'Index Status' as check_type,
    indexname as name,
    tablename as table_name,
    indexdef as definition
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('beaches', 'sessions', 'profiles', 'boards')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ================================================
-- 2. Check index usage statistics
-- ================================================

SELECT 
    'Index Usage' as check_type,
    schemaname||'.'||tablename as table_name,
    indexrelname as index_name,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'LOW_USAGE' 
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
AND tablename IN ('beaches', 'sessions', 'profiles', 'boards')
ORDER BY tablename, idx_scan DESC;

-- ================================================
-- 3. Analyze current query plans for problem queries
-- ================================================

-- Check if beach name ordering is using our index
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM beaches 
ORDER BY name ASC 
LIMIT 20;

-- Check if session ordering is using our index  
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sessions 
ORDER BY created_at DESC 
LIMIT 20;

-- ================================================
-- 4. Check for table bloat that might affect performance
-- ================================================

SELECT 
    'Table Statistics' as check_type,
    schemaname||'.'||tablename as table_name,
    n_tup_ins as inserts,
    n_tup_upd as updates, 
    n_tup_del as deletes,
    n_tup_hot_upd as hot_updates,
    n_dead_tup as dead_tuples,
    CASE 
        WHEN n_live_tup > 0 THEN round((n_dead_tup::float / n_live_tup::float) * 100, 2) 
        ELSE 0 
    END as dead_tuple_percent
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
AND tablename IN ('beaches', 'sessions', 'profiles', 'boards')
ORDER BY dead_tuple_percent DESC;

-- ================================================
-- 5. Check materialized view status (if created)
-- ================================================

SELECT 
    'Materialized View' as check_type,
    schemaname||'.'||matviewname as view_name,
    ispopulated,
    hasindexes
FROM pg_matviews 
WHERE matviewname = 'mv_session_summary';

-- ================================================
-- 6. Identify potential missing indexes
-- ================================================

-- Check for sequential scans that might need indexes
SELECT 
    'Sequential Scans' as check_type,
    schemaname||'.'||tablename as table_name,
    seq_scan as sequential_scans,
    seq_tup_read as tuples_read_sequentially,
    idx_scan as index_scans,
    CASE 
        WHEN seq_scan > idx_scan AND seq_scan > 100 THEN 'NEEDS_INDEX'
        WHEN seq_scan > 1000 THEN 'HIGH_SEQ_SCAN'
        ELSE 'OK'
    END as recommendation
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
AND tablename IN ('beaches', 'sessions', 'profiles', 'boards')
ORDER BY seq_scan DESC;

-- ================================================
-- 7. Performance summary and recommendations
-- ================================================

DO $$
DECLARE
    beach_idx_count int;
    session_idx_count int;
    mv_exists boolean;
BEGIN
    -- Count our performance indexes
    SELECT COUNT(*) INTO beach_idx_count
    FROM pg_indexes 
    WHERE tablename = 'beaches' 
    AND indexname LIKE 'idx_beaches_%';
    
    SELECT COUNT(*) INTO session_idx_count  
    FROM pg_indexes
    WHERE tablename = 'sessions'
    AND indexname LIKE 'idx_sessions_%';
    
    -- Check materialized view
    SELECT EXISTS(
        SELECT 1 FROM pg_matviews 
        WHERE matviewname = 'mv_session_summary'
    ) INTO mv_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 OPTIMIZATION STATUS SUMMARY';
    RAISE NOTICE '================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Beach indexes created: %', beach_idx_count;
    RAISE NOTICE 'Session indexes created: %', session_idx_count;
    RAISE NOTICE 'Materialized view exists: %', mv_exists;
    RAISE NOTICE '';
    
    IF beach_idx_count < 3 THEN
        RAISE NOTICE '⚠️  Beach indexes may be missing - expected at least 3';
    END IF;
    
    IF session_idx_count < 5 THEN
        RAISE NOTICE '⚠️  Session indexes may be missing - expected at least 5';
    END IF;
    
    RAISE NOTICE 'Check the detailed results above for specific issues.';
    RAISE NOTICE '';
END $$; 