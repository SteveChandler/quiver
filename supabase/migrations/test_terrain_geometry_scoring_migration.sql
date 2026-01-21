-- Test Script: Terrain Geometry Scoring Migration
-- Purpose: Validate the migration adds columns correctly and enforces constraints
--
-- Run this AFTER applying the migration to verify it worked correctly
-- Usage: psql -f test_terrain_geometry_scoring_migration.sql

\echo '=== Testing Terrain Geometry Scoring Migration ==='
\echo ''

-- Test 1: Verify columns exist
\echo 'Test 1: Verifying columns exist...'
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'beaches'
  AND column_name IN (
    'wind_exposure_factors',
    'swell_access_factors',
    'terrain_method',
    'terrain_params',
    'terrain_params_hash',
    'terrain_analyzed_at',
    'wind_analyzed_at',
    'swell_analyzed_at',
    'terrain_status',
    'terrain_enabled',
    'terrain_analysis_debug'
  )
ORDER BY column_name;

-- Test 2: Verify constraints exist
\echo ''
\echo 'Test 2: Verifying constraints exist...'
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'beaches'::regclass
  AND conname IN (
    'wind_exposure_len',
    'swell_access_len',
    'terrain_status_valid'
  )
ORDER BY conname;

-- Test 3: Verify indexes exist
\echo ''
\echo 'Test 3: Verifying indexes exist...'
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'beaches'
  AND indexname IN (
    'idx_beaches_terrain_enabled',
    'idx_beaches_terrain_status',
    'idx_beaches_terrain_method_hash',
    'idx_beaches_terrain_rollout'
  )
ORDER BY indexname;

-- Test 4: Insert test data with valid arrays
\echo ''
\echo 'Test 4: Testing valid array insertion (72 elements)...'
BEGIN;

-- Create a test beach (will rollback after test)
INSERT INTO beaches (
  id,
  name,
  center_lat,
  center_lng,
  wind_exposure_factors,
  swell_access_factors,
  terrain_method,
  terrain_params,
  terrain_params_hash,
  terrain_status,
  terrain_enabled
)
VALUES (
  'test-terrain-beach-001',
  'Test Terrain Beach',
  33.7701,
  -118.1937,
  ARRAY[
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,  -- 0-45°
    1.0, 1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 0.0, 0.0, 0.0,  -- 50-95°
    0.0, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.0, 1.0, 1.0,  -- 100-145°
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,  -- 150-195°
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,  -- 200-245°
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,  -- 250-295°
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,  -- 300-345°
    1.0, 1.0                                             -- 350-355°
  ]::real[],
  ARRAY[
    0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9, 0.7, 0.5, 0.3, 0.1, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9
  ]::real[],
  'dem_horizon_v1',
  '{"radius_km": 50, "step_m": 100, "dem_source": "SRTM", "resolution_m": 30}'::jsonb,
  'abc123def456',
  'ok',
  true
);

SELECT 'SUCCESS: Valid 72-element arrays inserted' AS result;

ROLLBACK;

-- Test 5: Attempt invalid array length (should fail)
\echo ''
\echo 'Test 5: Testing invalid array length (should fail)...'
BEGIN;

-- This should fail due to wind_exposure_len constraint
INSERT INTO beaches (
  id,
  name,
  center_lat,
  center_lng,
  wind_exposure_factors,
  terrain_enabled
)
VALUES (
  'test-invalid-wind-001',
  'Test Invalid Wind',
  33.7701,
  -118.1937,
  ARRAY[1.0, 1.0, 1.0]::real[],  -- Only 3 elements, should fail
  false
);

SELECT 'UNEXPECTED: Invalid array was accepted!' AS result;

ROLLBACK;

-- Expect to see error: "new row violates check constraint wind_exposure_len"
\echo 'EXPECTED: Constraint violation for invalid array length'
\echo ''

-- Test 6: Attempt invalid terrain_status (should fail)
\echo 'Test 6: Testing invalid terrain_status (should fail)...'
BEGIN;

-- This should fail due to terrain_status_valid constraint
INSERT INTO beaches (
  id,
  name,
  center_lat,
  center_lng,
  terrain_status,
  terrain_enabled
)
VALUES (
  'test-invalid-status-001',
  'Test Invalid Status',
  33.7701,
  -118.1937,
  'invalid_status',  -- Not in ('ok', 'wind_only', 'failed')
  false
);

SELECT 'UNEXPECTED: Invalid status was accepted!' AS result;

ROLLBACK;

-- Expect to see error: "new row violates check constraint terrain_status_valid"
\echo 'EXPECTED: Constraint violation for invalid status'
\echo ''

-- Test 7: Query with array indices (PostgreSQL arrays are 1-indexed)
\echo 'Test 7: Testing array index access...'
BEGIN;

INSERT INTO beaches (
  id,
  name,
  center_lat,
  center_lng,
  wind_exposure_factors,
  terrain_enabled
)
VALUES (
  'test-array-access-001',
  'Test Array Access',
  33.7701,
  -118.1937,
  ARRAY[
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0
  ]::real[],
  true
);

-- Test array access at key directions
SELECT
  'North (0°)' AS direction,
  wind_exposure_factors[1] AS exposure  -- Index 0 = array position 1
FROM beaches
WHERE id = 'test-array-access-001'
UNION ALL
SELECT
  'East (90°)' AS direction,
  wind_exposure_factors[19] AS exposure  -- Index 18 = array position 19
FROM beaches
WHERE id = 'test-array-access-001'
UNION ALL
SELECT
  'South (180°)' AS direction,
  wind_exposure_factors[37] AS exposure  -- Index 36 = array position 37
FROM beaches
WHERE id = 'test-array-access-001'
UNION ALL
SELECT
  'West (270°)' AS direction,
  wind_exposure_factors[55] AS exposure;  -- Index 54 = array position 55

ROLLBACK;

-- Test 8: Verify column comments
\echo ''
\echo 'Test 8: Verifying column comments...'
SELECT
  column_name,
  col_description('beaches'::regclass, ordinal_position) AS column_comment
FROM information_schema.columns
WHERE table_name = 'beaches'
  AND column_name IN (
    'wind_exposure_factors',
    'swell_access_factors',
    'terrain_method',
    'terrain_status',
    'terrain_enabled'
  )
ORDER BY column_name;

\echo ''
\echo '=== All Tests Complete ==='
\echo ''
\echo 'Expected outcomes:'
\echo '  - 11 columns created'
\echo '  - 3 constraints created'
\echo '  - 4 indexes created'
\echo '  - Valid arrays accepted'
\echo '  - Invalid arrays rejected'
\echo '  - Invalid status rejected'
\echo '  - Array access works correctly'
\echo '  - Comments visible'
