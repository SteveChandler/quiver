-- Add raw forecast data storage to enhanced_forecasts table
-- This migration adds a JSONB field to store unprocessed API responses
-- for debugging, analysis, and data quality monitoring

-- Add raw_forecast JSONB column to store unprocessed API data
ALTER TABLE enhanced_forecasts 
ADD COLUMN IF NOT EXISTS raw_forecast JSONB;

-- Add index for efficient querying of raw forecast data sources
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_raw_forecast_data_sources 
ON enhanced_forecasts USING GIN ((raw_forecast->'data_sources'));

-- Add index for CDIP data queries
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_cdip_data 
ON enhanced_forecasts USING GIN ((raw_forecast->'cdip_data'));

-- Add index for data quality scores
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_quality_scores 
ON enhanced_forecasts USING GIN ((raw_forecast->'quality_scores'));

-- Update data_source column to include CDIP
-- First check if the constraint exists, then drop and recreate
DO $$
BEGIN
    -- Check if the constraint exists and update it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'enhanced_forecasts_data_source_check' 
        AND table_name = 'enhanced_forecasts'
    ) THEN
        ALTER TABLE enhanced_forecasts 
        DROP CONSTRAINT enhanced_forecasts_data_source_check;
    END IF;
    
    -- Add updated constraint including CDIP
    ALTER TABLE enhanced_forecasts 
    ADD CONSTRAINT enhanced_forecasts_data_source_check 
    CHECK (data_source IN ('NOAA_NWS', 'CDIP', 'FALLBACK'));
    
EXCEPTION
    WHEN OTHERS THEN
        -- If constraint doesn't exist or other error, just add the new constraint
        BEGIN
            ALTER TABLE enhanced_forecasts 
            ADD CONSTRAINT enhanced_forecasts_data_source_check 
            CHECK (data_source IN ('NOAA_NWS', 'CDIP', 'FALLBACK'));
        EXCEPTION
            WHEN duplicate_object THEN
                -- Constraint already exists, do nothing
                NULL;
        END;
END $$;

-- Create a function to validate raw_forecast structure
CREATE OR REPLACE FUNCTION validate_raw_forecast_structure(raw_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check that required fields exist
    IF raw_data IS NULL THEN
        RETURN TRUE; -- Allow NULL values
    END IF;
    
    -- Must have data_sources array
    IF NOT (raw_data ? 'data_sources') THEN
        RETURN FALSE;
    END IF;
    
    -- data_sources must be an array
    IF NOT (jsonb_typeof(raw_data->'data_sources') = 'array') THEN
        RETURN FALSE;
    END IF;
    
    -- If CDIP data exists, validate basic structure
    IF (raw_data ? 'cdip_data') AND (raw_data->'cdip_data' IS NOT NULL) THEN
        IF NOT (
            (raw_data->'cdip_data' ? 'stationId') AND
            (raw_data->'cdip_data' ? 'dataSource') AND
            (raw_data->'cdip_data' ? 'data') AND
            (jsonb_typeof(raw_data->'cdip_data'->'data') = 'array')
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint to validate raw_forecast structure
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'validate_raw_forecast_structure_check' 
        AND table_name = 'enhanced_forecasts'
    ) THEN
        ALTER TABLE enhanced_forecasts 
        ADD CONSTRAINT validate_raw_forecast_structure_check 
        CHECK (validate_raw_forecast_structure(raw_forecast));
    END IF;
END $$;

-- Create a function to extract data quality score from raw_forecast
CREATE OR REPLACE FUNCTION get_overall_quality_score(raw_data JSONB)
RETURNS INTEGER AS $$
BEGIN
    IF raw_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Return overall quality score if it exists
    IF (raw_data ? 'quality_scores') AND (raw_data->'quality_scores' ? 'overall') THEN
        RETURN (raw_data->'quality_scores'->>'overall')::INTEGER;
    END IF;
    
    -- Calculate from individual scores if overall doesn't exist
    IF (raw_data ? 'quality_scores') THEN
        DECLARE
            cdip_score INTEGER;
            noaa_score INTEGER;
            count INTEGER := 0;
            total INTEGER := 0;
        BEGIN
            IF (raw_data->'quality_scores' ? 'cdip') THEN
                cdip_score := (raw_data->'quality_scores'->>'cdip')::INTEGER;
                total := total + cdip_score;
                count := count + 1;
            END IF;
            
            IF (raw_data->'quality_scores' ? 'noaa') THEN
                noaa_score := (raw_data->'quality_scores'->>'noaa')::INTEGER;
                total := total + noaa_score;
                count := count + 1;
            END IF;
            
            IF count > 0 THEN
                RETURN total / count;
            END IF;
        END;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view for easy access to forecast data with quality metrics
CREATE OR REPLACE VIEW enhanced_forecasts_with_quality AS
SELECT 
    ef.*,
    get_overall_quality_score(ef.raw_forecast) as overall_quality_score,
    CASE 
        WHEN ef.raw_forecast ? 'data_sources' 
        THEN jsonb_array_length(ef.raw_forecast->'data_sources')
        ELSE 0 
    END as data_source_count,
    CASE 
        WHEN ef.raw_forecast ? 'cdip_data' AND ef.raw_forecast->'cdip_data' IS NOT NULL
        THEN TRUE 
        ELSE FALSE 
    END as has_cdip_data,
    CASE 
        WHEN ef.raw_forecast ? 'noaa_data' AND ef.raw_forecast->'noaa_data' IS NOT NULL
        THEN TRUE 
        ELSE FALSE 
    END as has_noaa_data,
    CASE 
        WHEN ef.raw_forecast ? 'fetch_timestamps' AND ef.raw_forecast->'fetch_timestamps' ? 'cdip'
        THEN (ef.raw_forecast->'fetch_timestamps'->>'cdip')::TIMESTAMP WITH TIME ZONE
        ELSE NULL 
    END as cdip_fetch_time,
    CASE 
        WHEN ef.raw_forecast ? 'fetch_timestamps' AND ef.raw_forecast->'fetch_timestamps' ? 'noaa'
        THEN (ef.raw_forecast->'fetch_timestamps'->>'noaa')::TIMESTAMP WITH TIME ZONE
        ELSE NULL 
    END as noaa_fetch_time
FROM enhanced_forecasts ef;

-- Create indexes on the view for common queries
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_overall_quality 
ON enhanced_forecasts (get_overall_quality_score(raw_forecast));

-- Add comments for documentation
COMMENT ON COLUMN enhanced_forecasts.raw_forecast IS 'JSONB field storing unprocessed API responses from CDIP, NOAA, and other data sources for debugging and analysis';

COMMENT ON FUNCTION validate_raw_forecast_structure(JSONB) IS 'Validates the structure of raw_forecast JSONB data to ensure required fields are present';

COMMENT ON FUNCTION get_overall_quality_score(JSONB) IS 'Extracts or calculates overall data quality score from raw_forecast JSONB data';

COMMENT ON VIEW enhanced_forecasts_with_quality IS 'Enhanced view of forecasts with extracted quality metrics and data source flags';

-- Grant appropriate permissions
GRANT SELECT ON enhanced_forecasts_with_quality TO authenticated;
GRANT EXECUTE ON FUNCTION validate_raw_forecast_structure(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_overall_quality_score(JSONB) TO authenticated;