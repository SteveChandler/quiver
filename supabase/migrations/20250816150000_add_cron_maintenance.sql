-- Automated maintenance scheduling using pg_cron
-- Sets up regular cleanup and optimization tasks

BEGIN;

-- Ensure pg_cron extension is available (guard with extension check)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions 
        WHERE name = 'pg_cron'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        
        -- Schedule daily maintenance at 2 AM UTC
        -- Clean up old forecasts and update statistics
        SELECT cron.schedule(
            'daily-forecast-maintenance',
            '0 2 * * *',
            'SELECT run_database_maintenance(true, true, true, 30, 7);'
        );
        
        -- Schedule weekly deep maintenance at 3 AM UTC on Sundays
        -- More aggressive cleanup and full statistics update
        SELECT cron.schedule(
            'weekly-deep-maintenance', 
            '0 3 * * 0',
            'SELECT run_database_maintenance(true, true, true, 14, 3);'
        );
        
        -- Schedule hourly buoy status check during peak hours (6 AM - 10 PM UTC)
        SELECT cron.schedule(
            'hourly-buoy-check',
            '0 6-22 * * *',
            'SELECT cleanup_inactive_buoys(1);'
        );
        
        RAISE NOTICE 'pg_cron maintenance jobs scheduled successfully';
    ELSE
        RAISE NOTICE 'pg_cron extension not available, skipping automatic scheduling';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule cron jobs: %', SQLERRM;
END
$$;

-- Create a manual trigger function for environments without pg_cron
CREATE OR REPLACE FUNCTION trigger_manual_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Run standard maintenance
    result := run_database_maintenance(true, true, true, 30, 7);
    
    -- Add manual trigger timestamp
    result := jsonb_set(
        result::JSONB,
        '{trigger_type}',
        '"manual"'::JSONB
    )::JSON;
    
    RETURN result;
END;
$$;

-- Grant execute permission for manual maintenance
GRANT EXECUTE ON FUNCTION trigger_manual_maintenance() TO service_role;

COMMIT;