-- ================================================
-- VALIDATION QUERIES FOR SESSION DETAILS MIGRATION
-- ================================================
-- Migration: 20251113194209_add_session_details_fields.sql
-- Purpose: Comprehensive validation and testing queries
-- ================================================

-- ================================================
-- SECTION 1: SCHEMA VALIDATION
-- ================================================

-- Query 1: Verify columns exist in sessions table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessions'
  AND column_name IN ('wave_height_ft', 'wind_speed_mph', 'wind_direction', 'forecast_accuracy')
ORDER BY column_name;

-- Expected: 4 rows

-- Query 2: Verify columns exist in sessions_history table
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessions_history'
  AND column_name IN ('wave_height_ft', 'wind_speed_mph', 'wind_direction', 'forecast_accuracy')
ORDER BY column_name;

-- Expected: 4 rows

-- ================================================
-- SECTION 2: CONSTRAINT VALIDATION
-- ================================================

-- Query 3: Verify CHECK constraints exist
SELECT
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'sessions'
  AND constraint_name IN ('check_forecast_accuracy', 'check_wave_height_ft', 'check_wind_speed_mph');

-- Expected: 3 rows (CHECK constraints)

-- Query 4: Get constraint definitions
SELECT
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'sessions'
  AND tc.constraint_name IN ('check_forecast_accuracy', 'check_wave_height_ft', 'check_wind_speed_mph');

-- Expected: Shows constraint logic

-- ================================================
-- SECTION 3: INDEX VALIDATION
-- ================================================

-- Query 5: Verify indexes exist
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sessions'
  AND indexname IN (
    'idx_sessions_wave_height',
    'idx_sessions_wind_speed',
    'idx_sessions_forecast_accuracy',
    'idx_sessions_conditions'
  )
ORDER BY indexname;

-- Expected: 4 rows (indexes)

-- Query 6: Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename = 'sessions'
  AND indexname IN (
    'idx_sessions_wave_height',
    'idx_sessions_wind_speed',
    'idx_sessions_forecast_accuracy',
    'idx_sessions_conditions'
  )
ORDER BY indexname;

-- Expected: 4 rows with sizes

-- ================================================
-- SECTION 4: COMMENT VALIDATION
-- ================================================

-- Query 7: Verify column comments
SELECT
  cols.column_name,
  pg_catalog.col_description(c.oid, cols.ordinal_position::int) AS column_comment
FROM information_schema.columns cols
JOIN pg_catalog.pg_class c ON c.relname = cols.table_name
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE cols.table_schema = 'public'
  AND cols.table_name = 'sessions'
  AND cols.column_name IN ('wave_height_ft', 'wind_speed_mph', 'wind_direction', 'forecast_accuracy')
ORDER BY cols.column_name;

-- Expected: 4 rows with descriptive comments

-- ================================================
-- SECTION 5: DATA OPERATION TESTS
-- ================================================

-- Test 1: INSERT session with ALL new fields
-- Note: Replace auth.uid() with actual user ID if testing outside authenticated context
DO $$
DECLARE
  test_session_id UUID;
  test_beach_id UUID;
  test_user_id UUID;
BEGIN
  -- Get a test beach
  SELECT id INTO test_beach_id FROM beaches LIMIT 1;

  -- Get authenticated user (or use a test user)
  test_user_id := auth.uid();

  -- Insert test session
  INSERT INTO sessions (
    profile_id,
    user_id,
    beach_id,
    beach_name,
    arrival_time,
    duration_minutes,
    status,
    wave_height_ft,
    wind_speed_mph,
    wind_direction,
    forecast_accuracy,
    notes
  ) VALUES (
    test_user_id,
    test_user_id,
    test_beach_id,
    'Test Beach - All Fields',
    NOW(),
    90,
    'completed',
    4.5,
    12,
    'OFFSHORE',
    'accurate',
    'Test session with all new fields populated'
  )
  RETURNING id INTO test_session_id;

  -- Verify insert
  RAISE NOTICE 'Test session created: %', test_session_id;

  -- Query inserted data
  PERFORM id, wave_height_ft, wind_speed_mph, wind_direction, forecast_accuracy
  FROM sessions
  WHERE id = test_session_id;

END $$;

-- Test 2: INSERT session WITHOUT new fields (backward compatibility)
DO $$
DECLARE
  test_session_id UUID;
  test_beach_id UUID;
  test_user_id UUID;
BEGIN
  SELECT id INTO test_beach_id FROM beaches LIMIT 1;
  test_user_id := auth.uid();

  INSERT INTO sessions (
    profile_id,
    user_id,
    beach_id,
    beach_name,
    arrival_time,
    duration_minutes,
    status
  ) VALUES (
    test_user_id,
    test_user_id,
    test_beach_id,
    'Test Beach - No New Fields',
    NOW(),
    60,
    'completed'
  )
  RETURNING id INTO test_session_id;

  RAISE NOTICE 'Backward compatible session created: %', test_session_id;
END $$;

-- Test 3: UPDATE existing session with new fields
DO $$
DECLARE
  test_session_id UUID;
BEGIN
  -- Get a recent session
  SELECT id INTO test_session_id
  FROM sessions
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update with new field values
  UPDATE sessions
  SET
    wave_height_ft = 6.0,
    wind_speed_mph = 18,
    wind_direction = 'SW',
    forecast_accuracy = 'somewhat'
  WHERE id = test_session_id;

  RAISE NOTICE 'Updated session: %', test_session_id;
END $$;

-- ================================================
-- SECTION 6: CONSTRAINT VIOLATION TESTS
-- ================================================

-- Test 4: Invalid forecast_accuracy (should FAIL)
-- Uncomment to test:
-- INSERT INTO sessions (
--   profile_id,
--   user_id,
--   beach_id,
--   arrival_time,
--   duration_minutes,
--   status,
--   forecast_accuracy
-- ) VALUES (
--   auth.uid(),
--   auth.uid(),
--   (SELECT id FROM beaches LIMIT 1),
--   NOW(),
--   60,
--   'completed',
--   'invalid_value'  -- This should fail CHECK constraint
-- );
-- Expected: ERROR:  new row for relation "sessions" violates check constraint "check_forecast_accuracy"

-- Test 5: Negative wave_height_ft (should FAIL)
-- Uncomment to test:
-- INSERT INTO sessions (
--   profile_id,
--   user_id,
--   beach_id,
--   arrival_time,
--   duration_minutes,
--   status,
--   wave_height_ft
-- ) VALUES (
--   auth.uid(),
--   auth.uid(),
--   (SELECT id FROM beaches LIMIT 1),
--   NOW(),
--   60,
--   'completed',
--   -5.0  -- Negative not allowed
-- );
-- Expected: ERROR:  new row for relation "sessions" violates check constraint "check_wave_height_ft"

-- Test 6: Excessive wave_height_ft (should FAIL)
-- Uncomment to test:
-- INSERT INTO sessions (
--   profile_id,
--   user_id,
--   beach_id,
--   arrival_time,
--   duration_minutes,
--   status,
--   wave_height_ft
-- ) VALUES (
--   auth.uid(),
--   auth.uid(),
--   (SELECT id FROM beaches LIMIT 1),
--   NOW(),
--   60,
--   'completed',
--   150.0  -- Over 100ft limit
-- );
-- Expected: ERROR:  new row for relation "sessions" violates check constraint "check_wave_height_ft"

-- ================================================
-- SECTION 7: DATA QUALITY QUERIES
-- ================================================

-- Query 8: Check field population rates (post-migration)
SELECT
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE wave_height_ft IS NOT NULL) as sessions_with_wave_height,
  COUNT(*) FILTER (WHERE wind_speed_mph IS NOT NULL) as sessions_with_wind_speed,
  COUNT(*) FILTER (WHERE wind_direction IS NOT NULL) as sessions_with_wind_direction,
  COUNT(*) FILTER (WHERE forecast_accuracy IS NOT NULL) as sessions_with_forecast_accuracy,
  ROUND(COUNT(*) FILTER (WHERE wave_height_ft IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0), 2) as wave_height_pct,
  ROUND(COUNT(*) FILTER (WHERE wind_speed_mph IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0), 2) as wind_speed_pct,
  ROUND(COUNT(*) FILTER (WHERE forecast_accuracy IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0), 2) as forecast_accuracy_pct
FROM sessions
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Query 9: Forecast accuracy distribution
SELECT
  forecast_accuracy,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM sessions
WHERE forecast_accuracy IS NOT NULL
GROUP BY forecast_accuracy
ORDER BY count DESC;

-- Query 10: Wave height distribution (buckets)
SELECT
  CASE
    WHEN wave_height_ft < 2 THEN '0-2 ft (Small)'
    WHEN wave_height_ft < 4 THEN '2-4 ft (Moderate)'
    WHEN wave_height_ft < 6 THEN '4-6 ft (Overhead)'
    WHEN wave_height_ft < 10 THEN '6-10 ft (Double Overhead)'
    ELSE '10+ ft (XXL)'
  END as wave_height_category,
  COUNT(*) as count
FROM sessions
WHERE wave_height_ft IS NOT NULL
GROUP BY wave_height_category
ORDER BY MIN(wave_height_ft);

-- Query 11: Wind direction distribution
SELECT
  wind_direction,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM sessions
WHERE wind_direction IS NOT NULL
GROUP BY wind_direction
ORDER BY count DESC;

-- ================================================
-- SECTION 8: PERFORMANCE VALIDATION
-- ================================================

-- Query 12: Test index usage for wave_height filter
EXPLAIN ANALYZE
SELECT id, beach_name, wave_height_ft, created_at
FROM sessions
WHERE wave_height_ft > 3
  AND wave_height_ft < 8
ORDER BY created_at DESC
LIMIT 20;

-- Expected: Should use idx_sessions_wave_height index

-- Query 13: Test composite index for beach + conditions
EXPLAIN ANALYZE
SELECT id, beach_name, wave_height_ft, wind_speed_mph
FROM sessions
WHERE beach_id = (SELECT id FROM beaches LIMIT 1)
  AND wave_height_ft IS NOT NULL
  AND wind_speed_mph IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Expected: Should use idx_sessions_conditions index

-- Query 14: Test forecast_accuracy index
EXPLAIN ANALYZE
SELECT id, beach_name, forecast_accuracy, created_at
FROM sessions
WHERE forecast_accuracy = 'accurate'
ORDER BY created_at DESC
LIMIT 20;

-- Expected: Should use idx_sessions_forecast_accuracy index

-- ================================================
-- SECTION 9: RLS POLICY VALIDATION
-- ================================================

-- Query 15: Verify RLS policies apply to new columns
-- (Run as authenticated user)
SET ROLE authenticated;

-- Should only see own sessions
SELECT
  id,
  user_id,
  wave_height_ft,
  forecast_accuracy
FROM sessions
WHERE wave_height_ft IS NOT NULL
LIMIT 5;

-- Should be able to update own session
-- UPDATE sessions
-- SET wave_height_ft = 5.5
-- WHERE id = (SELECT id FROM sessions WHERE user_id = auth.uid() LIMIT 1);

RESET ROLE;

-- ================================================
-- SECTION 10: CLEANUP TEST DATA
-- ================================================

-- Query 16: Remove test sessions (optional)
-- Uncomment to clean up:
-- DELETE FROM sessions
-- WHERE notes LIKE '%Test session%'
--   AND created_at >= NOW() - INTERVAL '1 hour';

-- ================================================
-- END OF VALIDATION QUERIES
-- ================================================
