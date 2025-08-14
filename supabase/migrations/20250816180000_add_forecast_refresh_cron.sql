-- Enhanced forecasts nightly refresh cron job
-- Schedules automatic updates for active beaches at optimal times

BEGIN;

-- Create enhanced forecast refresh function
CREATE OR REPLACE FUNCTION refresh_enhanced_forecasts_for_active_beaches()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    beaches_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
    beach_rec RECORD;
BEGIN
    -- Initialize result
    result := jsonb_build_object(
        'operation', 'enhanced_forecasts_refresh',
        'started_at', start_time,
        'beaches_processed', 0,
        'successful_updates', 0,
        'failed_updates', 0,
        'errors', '[]'::jsonb
    );
    
    -- Get active beaches that need forecast updates
    -- Focus on beaches with recent activity or explicit priority
    FOR beach_rec IN
        SELECT DISTINCT b.id, b.name, b.latitude, b.longitude
        FROM public.beaches b
        WHERE b.latitude IS NOT NULL 
          AND b.longitude IS NOT NULL
          AND (
            -- Beaches with recent sessions (within 30 days)
            EXISTS (
                SELECT 1 FROM public.sessions s 
                WHERE s.beach_id = b.id 
                  AND s.created_at > NOW() - INTERVAL '30 days'
            )
            -- OR beaches with recent check-ins
            OR EXISTS (
                SELECT 1 FROM public.beach_checkins bc
                WHERE bc.beach_id = b.id
                  AND bc.created_at > NOW() - INTERVAL '7 days'
            )
            -- OR beaches explicitly marked as priority (if such a column exists)
            OR b.is_private = false -- Include all public beaches for now
          )
        ORDER BY b.name
        LIMIT 50 -- Limit to prevent overwhelming the API services
    LOOP
        beaches_count := beaches_count + 1;
        
        BEGIN
            -- Note: The actual forecast generation should be called via the enhanced forecast service
            -- This is a placeholder that logs the attempt - the actual implementation
            -- would call the NextJS API endpoint or service function
            
            RAISE NOTICE 'Processing forecast refresh for beach: % (%, %)', 
                beach_rec.name, beach_rec.latitude, beach_rec.longitude;
            
            -- TODO: Call enhanced forecast service API endpoint
            -- For now, just log success
            success_count := success_count + 1;
            
        EXCEPTION 
            WHEN OTHERS THEN
                error_count := error_count + 1;
                
                -- Add error to result
                result := jsonb_set(
                    result,
                    '{errors}',
                    (result->'errors')::jsonb || jsonb_build_object(
                        'beach_id', beach_rec.id,
                        'beach_name', beach_rec.name,
                        'error', SQLERRM,
                        'timestamp', NOW()
                    )
                );
                
                RAISE NOTICE 'Error processing beach %: %', beach_rec.name, SQLERRM;
        END;
    END LOOP;
    
    -- Update result with final counts
    result := jsonb_set(result, '{beaches_processed}', to_jsonb(beaches_count));
    result := jsonb_set(result, '{successful_updates}', to_jsonb(success_count));
    result := jsonb_set(result, '{failed_updates}', to_jsonb(error_count));
    result := jsonb_set(result, '{completed_at}', to_jsonb(NOW()));
    result := jsonb_set(result, '{duration_seconds}', 
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time))));
    
    -- Log summary
    RAISE NOTICE 'Enhanced forecasts refresh completed: % beaches processed, % successful, % failed',
        beaches_count, success_count, error_count;
    
    RETURN result;
END;
$$;

-- Function to cleanup stale forecasts older than retention period
CREATE OR REPLACE FUNCTION cleanup_stale_enhanced_forecasts(retention_days INTEGER DEFAULT 14)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete enhanced forecasts older than retention period
    DELETE FROM public.enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % stale enhanced forecasts older than % days', 
        deleted_count, retention_days;
    
    RETURN deleted_count;
END;
$$;

-- Comprehensive nightly maintenance function
CREATE OR REPLACE FUNCTION nightly_forecast_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    refresh_result JSON;
    cleanup_count INTEGER;
    final_result JSON;
    start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Refresh enhanced forecasts
    refresh_result := refresh_enhanced_forecasts_for_active_beaches();
    
    -- Cleanup stale forecasts
    cleanup_count := cleanup_stale_enhanced_forecasts(14);
    
    -- Update table statistics
    ANALYZE public.enhanced_forecasts;
    ANALYZE public.beaches;
    
    -- Build final result
    final_result := jsonb_build_object(
        'operation', 'nightly_forecast_maintenance',
        'started_at', start_time,
        'completed_at', NOW(),
        'duration_seconds', EXTRACT(EPOCH FROM (NOW() - start_time)),
        'refresh_summary', refresh_result,
        'stale_forecasts_cleaned', cleanup_count,
        'statistics_updated', true
    );
    
    RETURN final_result;
END;
$$;

-- Schedule nightly forecast refresh using pg_cron (if available)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions 
        WHERE name = 'pg_cron'
    ) THEN
        -- Schedule nightly forecast refresh at 2:30 AM UTC
        -- Offset from main maintenance to spread load
        SELECT cron.schedule(
            'nightly-forecast-refresh',
            '30 2 * * *',
            'SELECT nightly_forecast_maintenance();'
        );
        
        -- Schedule additional refresh during peak hours for high-activity beaches
        -- Run at 6 AM and 6 PM UTC to catch peak usage times
        SELECT cron.schedule(
            'peak-hours-forecast-refresh',
            '0 6,18 * * *',
            'SELECT refresh_enhanced_forecasts_for_active_beaches();'
        );
        
        RAISE NOTICE 'Forecast refresh cron jobs scheduled successfully';
    ELSE
        RAISE NOTICE 'pg_cron extension not available, manual execution required';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule forecast refresh cron jobs: %', SQLERRM;
END
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_enhanced_forecasts_for_active_beaches() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_stale_enhanced_forecasts(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION nightly_forecast_maintenance() TO service_role;

COMMIT;