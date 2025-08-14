-- Fix the database health check function with correct column names
-- Uses relname instead of tablename from pg_stat_user_tables

BEGIN;

-- Drop and recreate the function with correct column references
DROP FUNCTION IF EXISTS check_database_health();

CREATE OR REPLACE FUNCTION check_database_health() 
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    last_analyzed TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT,
        COALESCE(t.n_live_tup, 0) AS row_count,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.relname)) AS table_size,
        t.last_analyze
    FROM pg_stat_user_tables t
    WHERE t.schemaname = 'public' 
      AND t.relname IN ('enhanced_forecasts', 'buoys', 'beaches', 'spot_feedback')
    ORDER BY pg_total_relation_size(t.schemaname||'.'||t.relname) DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_database_health() TO service_role;

COMMIT;