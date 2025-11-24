-- =============================================================================
-- Production Database Diagnostic Script
-- Issue 1: Best Conditions Returns 0 Beaches
-- Issue 2: Missing get_nearby_beaches RPC Function
-- =============================================================================
-- Run this against PRODUCTION database to diagnose both issues
-- Date: 2025-11-18
-- =============================================================================

\echo '========================================='
\echo 'ISSUE 1: Best Conditions - 0 Beaches'
\echo '========================================='

\echo ''
\echo '1. Verify Pacific Beach exists and has coordinates:'
\echo '---------------------------------------------------'
SELECT
    id,
    name,
    lat,
    lon,
    city,
    state,
    is_private,
    CASE
        WHEN lat IS NULL OR lon IS NULL THEN '❌ MISSING COORDINATES'
        ELSE '✅ Has coordinates'
    END as coordinate_status
FROM beaches
WHERE id = '65809772-20bc-4009-b9b2-89c8ef3c4127'
   OR name ILIKE '%Pacific Beach%';

\echo ''
\echo '2. Check beaches table schema (verify column names):'
\echo '----------------------------------------------------'
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'beaches'
  AND column_name IN ('lat', 'lon', 'latitude', 'longitude', 'center_lat', 'center_lng', 'city', 'state', 'location', 'region')
ORDER BY column_name;

\echo ''
\echo '3. Find beaches near Pacific Beach (32.7941, -117.2340):'
\echo '--------------------------------------------------------'
-- Using client-side distance calculation (haversine formula)
-- This works regardless of whether get_nearby_beaches function exists
WITH pacific_beach_coords AS (
    SELECT 32.7941 AS lat, -117.2340 AS lon
),
beaches_with_distance AS (
    SELECT
        b.id,
        b.name,
        b.lat,
        b.lon,
        b.city,
        b.state,
        b.is_private,
        b.geog,
        -- Calculate distance in meters using haversine formula
        (
            6371000 * acos(
                cos(radians(pb.lat)) *
                cos(radians(b.lat)) *
                cos(radians(b.lon) - radians(pb.lon)) +
                sin(radians(pb.lat)) *
                sin(radians(b.lat))
            )
        ) AS distance_meters
    FROM beaches b
    CROSS JOIN pacific_beach_coords pb
    WHERE b.lat IS NOT NULL
      AND b.lon IS NOT NULL
      AND b.is_private = false
)
SELECT
    name,
    city,
    state,
    lat,
    lon,
    ROUND(distance_meters::NUMERIC, 0) AS distance_meters,
    ROUND((distance_meters * 0.000621371)::NUMERIC, 2) AS distance_miles,
    CASE
        WHEN geog IS NOT NULL THEN '✅ Has geog'
        ELSE '❌ No geog'
    END as geog_status
FROM beaches_with_distance
WHERE distance_meters <= 16093.4  -- 10 miles in meters
ORDER BY distance_meters ASC
LIMIT 20;

\echo ''
\echo '4. Count beaches with valid coordinates within 10 miles:'
\echo '--------------------------------------------------------'
WITH pacific_beach_coords AS (
    SELECT 32.7941 AS lat, -117.2340 AS lon
)
SELECT
    COUNT(*) FILTER (WHERE is_private = false) as public_beaches_count,
    COUNT(*) FILTER (WHERE is_private = true) as private_beaches_count,
    COUNT(*) as total_beaches
FROM (
    SELECT
        b.is_private,
        (
            6371000 * acos(
                cos(radians(pb.lat)) *
                cos(radians(b.lat)) *
                cos(radians(b.lon) - radians(pb.lon)) +
                sin(radians(pb.lat)) *
                sin(radians(b.lat))
            )
        ) AS distance_meters
    FROM beaches b
    CROSS JOIN pacific_beach_coords pb
    WHERE b.lat IS NOT NULL
      AND b.lon IS NOT NULL
) AS nearby
WHERE distance_meters <= 16093.4;

\echo ''
\echo '========================================='
\echo 'ISSUE 2: get_nearby_beaches RPC Function'
\echo '========================================='

\echo ''
\echo '5. Check if get_nearby_beaches function exists:'
\echo '-----------------------------------------------'
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    CASE
        WHEN p.proname = 'get_nearby_beaches' THEN '✅ Function exists'
        ELSE '❌ Function missing'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_nearby_beaches';

\echo ''
\echo '6. If function exists, check its definition:'
\echo '-------------------------------------------'
SELECT
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_nearby_beaches'
LIMIT 1;

\echo ''
\echo '7. Check which migrations have been applied:'
\echo '--------------------------------------------'
SELECT
    version,
    name,
    inserted_at
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%nearby%'
   OR name ILIKE '%coordinate%'
   OR name ILIKE '%location%'
ORDER BY version DESC
LIMIT 20;

\echo ''
\echo '8. Test get_nearby_beaches function (if it exists):'
\echo '---------------------------------------------------'
-- This will error if the function doesn't exist
-- Test with Pacific Beach coordinates
SELECT
    name,
    city,
    state,
    lat,
    lon,
    ROUND(distance_meters::NUMERIC, 0) AS distance_meters,
    is_private
FROM get_nearby_beaches(
    32.7941,  -- Pacific Beach lat
    -117.2340,  -- Pacific Beach lon
    16093,  -- 10 miles in meters
    20  -- limit
)
ORDER BY distance_meters ASC
LIMIT 10;

\echo ''
\echo '9. Check beaches table has geog column and GiST index:'
\echo '-----------------------------------------------------'
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'beaches'
  AND indexname ILIKE '%geog%';

\echo ''
\echo '10. Summary of data quality issues:'
\echo '-----------------------------------'
SELECT
    COUNT(*) FILTER (WHERE lat IS NULL OR lon IS NULL) as beaches_missing_coords,
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL AND geog IS NULL) as beaches_missing_geog,
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL AND geog IS NOT NULL) as beaches_with_full_spatial_data,
    COUNT(*) as total_beaches
FROM beaches;

\echo ''
\echo '========================================='
\echo 'DIAGNOSIS COMPLETE'
\echo '========================================='
