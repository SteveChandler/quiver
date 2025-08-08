-- Quick fix for CDIP data source constraint
-- Run this in your Supabase SQL editor

-- Drop existing constraint
ALTER TABLE enhanced_forecasts 
DROP CONSTRAINT IF EXISTS check_data_source;

-- Add updated constraint including CDIP
ALTER TABLE enhanced_forecasts 
ADD CONSTRAINT check_data_source 
CHECK (data_source IN ('NOAA_NWS', 'CDIP', 'FALLBACK'));

-- Verify the constraint was added
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'check_data_source';