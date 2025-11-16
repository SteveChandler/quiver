-- Data quality verification queries for beaches table
-- Migration created: 2025-11-15
-- Purpose: Verify city/state data quality after location/region rename
-- Run these queries to check for data issues

-- =============================================================================
-- Query 1: Check for beaches with missing city or state
-- =============================================================================

SELECT
    'Beaches with missing location data' AS check_name,
    COUNT(*) AS count,
    json_agg(json_build_object(
        'id', id,
        'name', name,
        'city', city,
        'state', state,
        'lat', lat,
        'lon', lon
    )) AS examples
FROM beaches
WHERE (city IS NULL OR state IS NULL)
  AND lat IS NOT NULL
  AND lon IS NOT NULL
LIMIT 10;

-- =============================================================================
-- Query 2: Verify location display construction
-- =============================================================================

SELECT
    'Location display format verification' AS check_name,
    COUNT(*) AS total_beaches,
    SUM(CASE WHEN city IS NOT NULL AND state IS NOT NULL THEN 1 ELSE 0 END) AS with_city_and_state,
    SUM(CASE WHEN city IS NULL AND state IS NOT NULL THEN 1 ELSE 0 END) AS state_only,
    SUM(CASE WHEN city IS NOT NULL AND state IS NULL THEN 1 ELSE 0 END) AS city_only,
    SUM(CASE WHEN city IS NULL AND state IS NULL THEN 1 ELSE 0 END) AS no_location_data
FROM beaches
WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- =============================================================================
-- Query 3: Sample beaches with properly formatted locations
-- =============================================================================

SELECT
    name,
    city,
    state,
    CASE
        WHEN city IS NOT NULL AND state IS NOT NULL
            THEN city || ', ' || state
        WHEN city IS NOT NULL THEN city
        WHEN state IS NOT NULL THEN state
        ELSE 'Unknown'
    END AS location_display,
    lat,
    lon
FROM beaches
WHERE lat IS NOT NULL AND lon IS NOT NULL
ORDER BY name
LIMIT 20;

-- =============================================================================
-- Query 4: Check for beaches with coordinates but no location data
-- =============================================================================

SELECT
    'Beaches with coordinates but missing location' AS check_name,
    COUNT(*) AS count,
    ARRAY_AGG(name ORDER BY name) FILTER (WHERE city IS NULL AND state IS NULL) AS affected_beaches
FROM beaches
WHERE lat IS NOT NULL
  AND lon IS NOT NULL
  AND city IS NULL
  AND state IS NULL;

-- =============================================================================
-- Query 5: Verify geography column is populated
-- =============================================================================

SELECT
    'Geography column verification' AS check_name,
    COUNT(*) AS total_beaches_with_coords,
    SUM(CASE WHEN geog IS NOT NULL THEN 1 ELSE 0 END) AS with_geography,
    SUM(CASE WHEN geog IS NULL THEN 1 ELSE 0 END) AS missing_geography
FROM beaches
WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- =============================================================================
-- Query 6: Test get_nearby_beaches function with sample coordinates
-- =============================================================================

-- San Diego area (La Jolla Shores)
SELECT
    'get_nearby_beaches test (La Jolla Shores area)' AS test_name,
    COUNT(*) AS beaches_found
FROM get_nearby_beaches(32.8528, -117.2540, 25000, 20);

-- Sample results from function
SELECT
    name,
    location,
    ROUND(distance_meters::numeric, 0) AS distance_meters,
    lat,
    lon
FROM get_nearby_beaches(32.8528, -117.2540, 25000, 10)
ORDER BY distance_meters
LIMIT 5;

-- =============================================================================
-- Query 7: Verify all database functions are working
-- =============================================================================

SELECT
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments,
    prokind AS kind,
    provolatile AS volatility
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'get_nearby_beaches',
    'get_beaches_by_location_with_scores',
    'get_beaches_by_metro_with_scores',
    'get_beaches_near',
    'get_coach_picks'
  )
ORDER BY proname;

-- =============================================================================
-- SUGGESTED FIXES for data quality issues
-- =============================================================================

/*
-- If you find beaches with missing city/state data, you can update them manually:

-- Example 1: Update specific beach by ID
UPDATE beaches
SET
    city = 'Your City Name',
    state = 'CA'
WHERE id = 'your-beach-uuid-here';

-- Example 2: Bulk update beaches in a specific area
-- (Use with caution - verify coordinates first)
UPDATE beaches
SET
    city = COALESCE(city, 'Unknown City'),
    state = COALESCE(state, 'Unknown State')
WHERE lat IS NOT NULL
  AND lon IS NOT NULL
  AND (city IS NULL OR state IS NULL)
  -- Add specific geographic constraints here
  AND lat BETWEEN 32.0 AND 34.0
  AND lon BETWEEN -118.0 AND -116.0;

-- Example 3: Regenerate geography column if missing
UPDATE beaches
SET geog = ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
WHERE lat IS NOT NULL
  AND lon IS NOT NULL
  AND geog IS NULL;
*/
