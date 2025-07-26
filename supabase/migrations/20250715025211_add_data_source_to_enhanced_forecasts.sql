-- Migration to add data_source column to enhanced_forecasts table
-- This tracks whether forecast data comes from real NOAA sources or fallback data

-- Add data_source column to enhanced_forecasts table
ALTER TABLE enhanced_forecasts 
ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'FALLBACK';

-- Drop existing constraint if it exists, then add it
ALTER TABLE enhanced_forecasts 
DROP CONSTRAINT IF EXISTS check_data_source;

ALTER TABLE enhanced_forecasts 
ADD CONSTRAINT check_data_source 
CHECK (data_source IN ('NOAA_NWS', 'FALLBACK'));

-- Create index for efficient querying by data source
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_data_source 
ON enhanced_forecasts (data_source);

-- Create index for querying by beach and data source
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_data_source 
ON enhanced_forecasts (beach_id, data_source);

-- Update comment to reflect the new column
COMMENT ON TABLE enhanced_forecasts IS 'Comprehensive surf forecasts combining NOAA WaveWatch III, CO-OPS tidal data, and weather forecasts. Tracks data source transparency.';

-- Update existing records to reflect their actual data source
-- Since current records are likely fallback data, they default to FALLBACK
UPDATE enhanced_forecasts 
SET data_source = 'FALLBACK' 
WHERE data_source IS NULL OR data_source = 'FALLBACK';

-- Add comment for the new column
COMMENT ON COLUMN enhanced_forecasts.data_source IS 'Data source indicator: NOAA_NWS for real NOAA data, FALLBACK for simulated/estimated data';
