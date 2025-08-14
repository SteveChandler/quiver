-- Database maintenance functions for performance and data lifecycle management
-- Includes archival, statistics updates, and automated cleanup

BEGIN;

-- 1. Statistics update function for query optimizer
CREATE OR REPLACE FUNCTION update_forecast_table_stats() 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update table statistics for better query planning
    ANALYZE public.enhanced_forecasts;
    ANALYZE public.buoys;
    ANALYZE public.beaches;
    ANALYZE public.spot_feedback;
    
    -- Log the update
    RAISE NOTICE 'Database statistics updated for forecast tables at %', NOW();
END;
$$;

-- 2. Old forecast data cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_forecasts(retention_days INTEGER DEFAULT 30) 
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old enhanced forecasts beyond retention period
    DELETE FROM public.enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % old forecast records older than % days', deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$;

-- 3. Inactive buoy cleanup function
CREATE OR REPLACE FUNCTION cleanup_inactive_buoys(inactive_days INTEGER DEFAULT 7) 
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Mark buoys as inactive if no recent updates
    UPDATE public.buoys 
    SET active = false, 
        updated_at = NOW()
    WHERE active = true 
      AND updated_at < NOW() - (inactive_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Marked % buoys as inactive after % days without updates', updated_count, inactive_days;
    
    RETURN updated_count;
END;
$$;

-- 4. Database health check function
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

-- 5. Comprehensive maintenance function
CREATE OR REPLACE FUNCTION run_database_maintenance(
    cleanup_forecasts BOOLEAN DEFAULT true,
    cleanup_buoys BOOLEAN DEFAULT true,
    update_stats BOOLEAN DEFAULT true,
    forecast_retention_days INTEGER DEFAULT 30,
    buoy_inactive_days INTEGER DEFAULT 7
) 
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    forecasts_cleaned INTEGER := 0;
    buoys_cleaned INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Initialize result object
    result := '{"maintenance_started": "' || start_time || '", "operations": []}'::JSON;
    
    -- Clean up old forecasts
    IF cleanup_forecasts THEN
        forecasts_cleaned := cleanup_old_forecasts(forecast_retention_days);
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'forecast_cleanup',
                'records_affected', forecasts_cleaned,
                'retention_days', forecast_retention_days
            )
        )::JSON;
    END IF;
    
    -- Clean up inactive buoys
    IF cleanup_buoys THEN
        buoys_cleaned := cleanup_inactive_buoys(buoy_inactive_days);
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'buoy_cleanup',
                'records_affected', buoys_cleaned,
                'inactive_days', buoy_inactive_days
            )
        )::JSON;
    END IF;
    
    -- Update statistics
    IF update_stats THEN
        PERFORM update_forecast_table_stats();
        result := jsonb_set(
            result::JSONB, 
            '{operations}', 
            (result->'operations')::JSONB || jsonb_build_object(
                'operation', 'statistics_update',
                'completed', true
            )
        )::JSON;
    END IF;
    
    -- Add completion info
    result := jsonb_set(
        result::JSONB, 
        '{maintenance_completed}', 
        to_jsonb(NOW())
    )::JSON;
    
    result := jsonb_set(
        result::JSONB, 
        '{duration_seconds}', 
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time)))
    )::JSON;
    
    RETURN result;
END;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION update_forecast_table_stats() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_forecasts(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_inactive_buoys(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_database_health() TO service_role;
GRANT EXECUTE ON FUNCTION run_database_maintenance(BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO service_role;

COMMIT;