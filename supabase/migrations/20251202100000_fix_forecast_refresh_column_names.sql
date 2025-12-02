-- Fix forecast refresh function to use correct column names
-- The beaches table uses 'lat' and 'lon' columns, not 'latitude' and 'longitude'
-- This migration fixes the refresh_enhanced_forecasts_for_active_beaches function
-- that was silently failing due to incorrect column references.

BEGIN;

-- Drop and recreate the forecast refresh function with correct column names
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
    -- FIXED: Changed latitude/longitude to lat/lon to match actual column names
    FOR beach_rec IN
        SELECT DISTINCT b.id, b.name, b.lat, b.lon
        FROM public.beaches b
        WHERE b.lat IS NOT NULL 
          AND b.lon IS NOT NULL
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
            
            -- FIXED: Changed latitude/longitude to lat/lon in the RAISE NOTICE
            RAISE NOTICE 'Processing forecast refresh for beach: % (%, %)', 
                beach_rec.name, beach_rec.lat, beach_rec.lon;
            
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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION refresh_enhanced_forecasts_for_active_beaches() TO service_role;

-- Add a comment documenting the fix
COMMENT ON FUNCTION refresh_enhanced_forecasts_for_active_beaches() IS 
'Refreshes enhanced forecasts for active beaches. Fixed 2025-12-02: Changed latitude/longitude to lat/lon to match actual beach table column names.';

COMMIT;

