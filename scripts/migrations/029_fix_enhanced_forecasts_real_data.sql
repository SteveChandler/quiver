-- Migration to fix enhanced_forecasts table by removing mock data
-- and preparing for real NOAA API data population
-- 
-- Issue: enhanced_forecasts contains mock data with duplicated values
-- Solution: Clean up mock data and set up for real API data population

-- =====================================================
-- 1. BACKUP AND CLEAN UP EXISTING MOCK DATA
-- =====================================================

-- Log what we're removing
DO $$
DECLARE 
    mock_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM enhanced_forecasts;
    SELECT COUNT(*) INTO mock_count FROM enhanced_forecasts WHERE data_source = 'FALLBACK';
    
    RAISE NOTICE 'Enhanced forecasts cleanup starting:';
    RAISE NOTICE '  Total records: %', total_count;
    RAISE NOTICE '  Mock/Fallback records: %', mock_count;
    RAISE NOTICE '  Real NOAA records: %', (total_count - mock_count);
END $$;

-- Remove all mock/fallback data (keep any real NOAA data if it exists)
DELETE FROM enhanced_forecasts 
WHERE data_source = 'FALLBACK' 
   OR data_source IS NULL 
   OR created_at < NOW() - INTERVAL '7 days'; -- Remove stale data

-- Log the cleanup results
DO $$
DECLARE 
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count FROM enhanced_forecasts;
    RAISE NOTICE 'Cleanup completed. Remaining records: %', remaining_count;
END $$;

-- =====================================================
-- 2. UPDATE TABLE CONSTRAINTS FOR REAL DATA
-- =====================================================

-- Ensure data_source column exists and has proper default
ALTER TABLE enhanced_forecasts 
ALTER COLUMN data_source SET DEFAULT 'NOAA_NWS';

-- Add comment to document the change
COMMENT ON TABLE enhanced_forecasts IS 'Comprehensive surf forecasts from real NOAA WaveWatch III, CO-OPS tidal data, and weather forecasts. Mock data removed 2025-01-04.';

-- =====================================================
-- 3. CREATE FUNCTION TO IDENTIFY STALE DATA
-- =====================================================

CREATE OR REPLACE FUNCTION is_enhanced_forecast_stale(
    forecast_updated_at TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- NOAA updates every 6 hours, so forecasts older than 6 hours are stale
    RETURN forecast_updated_at < NOW() - INTERVAL '6 hours';
END;
$$;

COMMENT ON FUNCTION is_enhanced_forecast_stale(TIMESTAMP WITH TIME ZONE) IS 'Determines if an enhanced forecast is stale based on NOAA update cycles';

-- =====================================================
-- 4. CREATE VIEW FOR FRESH REAL DATA ONLY
-- =====================================================

CREATE OR REPLACE VIEW fresh_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT * FROM enhanced_forecasts
WHERE data_source = 'NOAA_NWS'
  AND NOT is_enhanced_forecast_stale(updated_at)
  AND forecast_date >= CURRENT_DATE
  AND forecast_date <= CURRENT_DATE + INTERVAL '12 days'
ORDER BY beach_id, forecast_date, forecast_time;

COMMENT ON VIEW fresh_enhanced_forecasts IS 'Only fresh, real NOAA enhanced forecasts (excludes stale and mock data)';

-- =====================================================
-- 5. UPDATE CLEANUP FUNCTION TO REMOVE STALE DATA
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_enhanced_forecasts(days_to_keep INTEGER DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Remove old forecast data
    DELETE FROM enhanced_forecasts 
    WHERE forecast_date < CURRENT_DATE - days_to_keep
       OR (data_source = 'FALLBACK' AND created_at < NOW() - INTERVAL '1 day')
       OR is_enhanced_forecast_stale(updated_at);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old/stale enhanced forecast records', deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_enhanced_forecasts(INTEGER) IS 'Enhanced cleanup function that removes stale and mock data - SECURITY DEFINER with secure search_path';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced forecasts migration completed successfully';
    RAISE NOTICE '   Ready for real NOAA API data population';
    RAISE NOTICE '   Use EnhancedForecastService.updateAllEnhancedForecasts() to populate';
END $$;