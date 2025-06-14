-- Enable PostGIS extension for spatial operations
-- This migration ensures PostGIS is available for geographic calculations

CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is working
SELECT PostGIS_Version();

-- Add comment for documentation
COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions'; 