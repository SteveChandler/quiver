-- Migration to add CDIP as a valid data source
-- Updates the check_data_source constraint to include CDIP

-- Drop existing constraint if it exists
ALTER TABLE enhanced_forecasts 
DROP CONSTRAINT IF EXISTS check_data_source;

-- Add updated constraint including CDIP
ALTER TABLE enhanced_forecasts 
ADD CONSTRAINT check_data_source 
CHECK (data_source IN ('NOAA_NWS', 'CDIP', 'FALLBACK'));

-- Comment the constraint for documentation
COMMENT ON CONSTRAINT check_data_source ON enhanced_forecasts 
IS 'Ensures data_source is one of: NOAA_NWS (real NOAA data), CDIP (real CDIP buoy data), or FALLBACK (synthetic/default data)';