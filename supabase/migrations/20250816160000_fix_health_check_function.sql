-- Fix the database health check function
-- Corrects column reference issue in pg_stat_user_tables query

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
        t.tablename::TEXT,
        t.n_tup_ins + t.n_tup_upd - t.n_tup_del AS row_count,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS table_size,
        t.last_analyze
    FROM pg_stat_user_tables t
    WHERE t.schemaname = 'public' 
      AND t.tablename IN ('enhanced_forecasts', 'buoys', 'beaches', 'spot_feedback')
    ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_database_health() TO service_role;

COMMIT;