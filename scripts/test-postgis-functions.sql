-- Test script to check if PostGIS functions exist
-- Run this in your Supabase SQL editor

-- Check if PostGIS extension is enabled
SELECT name, installed_version FROM pg_available_extensions WHERE name = 'postgis';

-- Check if our custom functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_nearby_buoys', 'consolidate_buoy_conditions', 'get_nearby_beaches');

-- Check if buoys table exists and has data
SELECT COUNT(*) as buoy_count FROM buoys;

-- Check if buoys table has coordinates column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'buoys' 
AND column_name = 'coordinates';

-- Test a simple buoy query
SELECT buoy_uuid, buoy_name, kind, 
       ST_X(coordinates::geometry) as longitude,
       ST_Y(coordinates::geometry) as latitude
FROM buoys 
LIMIT 5; 