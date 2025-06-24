-- Verification Script for Performance Optimization Migration
-- Run this before 019_comprehensive_performance_optimization.sql to ensure compatibility

-- ================================================
-- 1. Verify Required Tables Exist
-- ================================================

DO $$
DECLARE
    table_exists boolean;
    missing_tables text[] := '{}';
BEGIN
    -- Check beaches table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'beaches'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        missing_tables := array_append(missing_tables, 'beaches');
    END IF;

    -- Check sessions table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sessions'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        missing_tables := array_append(missing_tables, 'sessions');
    END IF;

    -- Check profiles table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        missing_tables := array_append(missing_tables, 'profiles');
    END IF;

    -- Check boards table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'boards'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        missing_tables := array_append(missing_tables, 'boards');
    END IF;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required tables: %. Please ensure all migrations are run first.', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ All required tables exist';
    END IF;
END $$;

-- ================================================
-- 2. Verify Required Columns Exist
-- ================================================

DO $$
DECLARE
    column_exists boolean;
    missing_columns text[] := '{}';
BEGIN
    -- Check beaches columns
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'name'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'beaches.name'); END IF;

    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'latitude'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'beaches.latitude'); END IF;

    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'beaches' AND column_name = 'longitude'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'beaches.longitude'); END IF;

    -- Check sessions columns
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'created_at'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'sessions.created_at'); END IF;

    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'user_id'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'sessions.user_id'); END IF;

    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'profile_id'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'sessions.profile_id'); END IF;

    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'beach_id'
    ) INTO column_exists;
    IF NOT column_exists THEN missing_columns := array_append(missing_columns, 'sessions.beach_id'); END IF;

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required columns: %. Please check your schema.', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All required columns exist';
    END IF;
END $$;

-- ================================================
-- 3. Check Current Index Status
-- ================================================

-- Show existing indexes on key tables
CREATE OR REPLACE FUNCTION show_current_indexes()
RETURNS TABLE(table_name text, index_name text, index_def text) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (schemaname||'.'||tablename)::text as table_name,
        indexname::text as index_name,
        indexdef::text as index_def
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename IN ('beaches', 'sessions', 'profiles', 'boards')
    ORDER BY tablename, indexname;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 4. Performance Baseline Check
-- ================================================

-- Create function to check current query performance
CREATE OR REPLACE FUNCTION check_current_performance()
RETURNS TABLE(
    query_description text,
    estimated_rows bigint,
    has_index boolean
) AS $$
BEGIN
    RETURN QUERY
    WITH beach_query AS (
        SELECT 'Beach name ordering' as description,
               reltuples::bigint as rows,
               EXISTS(
                   SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'beaches' 
                   AND indexdef LIKE '%name%'
               ) as indexed
        FROM pg_class WHERE relname = 'beaches'
    ),
    session_query AS (
        SELECT 'Session created_at ordering' as description,
               reltuples::bigint as rows,
               EXISTS(
                   SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'sessions' 
                   AND indexdef LIKE '%created_at%'
               ) as indexed
        FROM pg_class WHERE relname = 'sessions'
    )
    SELECT * FROM beach_query
    UNION ALL
    SELECT * FROM session_query;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 5. Run Verification Report
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 PERFORMANCE OPTIMIZATION VERIFICATION REPORT';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Current Index Status:';
END $$;

-- Show current indexes
SELECT * FROM show_current_indexes();

-- Show performance baseline
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Current Performance Status:';
END $$;

SELECT * FROM check_current_performance();

-- ================================================
-- 6. Cleanup Verification Functions
-- ================================================

DROP FUNCTION IF EXISTS show_current_indexes();
DROP FUNCTION IF EXISTS check_current_performance();

-- ================================================
-- 7. Final Validation
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Schema verification completed successfully!';
    RAISE NOTICE '🚀 Ready to run 019_comprehensive_performance_optimization.sql';
    RAISE NOTICE '';
    RAISE NOTICE 'Recommended execution order:';
    RAISE NOTICE '1. Run this verification script ✓';
    RAISE NOTICE '2. Run 019_comprehensive_performance_optimization.sql';
    RAISE NOTICE '3. Monitor performance improvements';
    RAISE NOTICE '';
END $$; 