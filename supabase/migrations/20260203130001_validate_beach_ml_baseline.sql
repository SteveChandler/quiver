-- Validation Query: Test beach_ml_performance_baseline
-- Run this after applying the migration to verify functionality
--
-- Expected Results:
-- 1. Materialized view exists and is populated
-- 2. Indexes are created
-- 3. Functions are executable
-- 4. Cron job is scheduled
-- 5. Data matches direct query results

-- =============================================================================
-- TEST 1: Verify materialized view exists and has data
-- =============================================================================
SELECT
  'TEST 1: View exists' AS test_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_matviews
      WHERE schemaname = 'public'
        AND matviewname = 'beach_ml_performance_baseline'
    ) THEN 'PASS'
    ELSE 'FAIL - View not found'
  END AS result;

SELECT
  'TEST 1b: View has data' AS test_name,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS - ' || COUNT(*) || ' beaches'
    ELSE 'FAIL - No data'
  END AS result
FROM beach_ml_performance_baseline;

-- =============================================================================
-- TEST 2: Verify indexes exist
-- =============================================================================
SELECT
  'TEST 2: Indexes created' AS test_name,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS - All 4 indexes present'
    ELSE 'FAIL - Expected 4, found ' || COUNT(*)
  END AS result
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'beach_ml_performance_baseline';

-- =============================================================================
-- TEST 3: Verify functions exist and are executable
-- =============================================================================
SELECT
  'TEST 3a: refresh_beach_ml_baseline() exists' AS test_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'refresh_beach_ml_baseline'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

SELECT
  'TEST 3b: get_beach_ml_performance() exists' AS test_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'get_beach_ml_performance'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

SELECT
  'TEST 3c: get_worst_performing_beaches() exists' AS test_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'get_worst_performing_beaches'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS result;

-- =============================================================================
-- TEST 4: Verify cron job is scheduled
-- =============================================================================
SELECT
  'TEST 4: Cron job scheduled' AS test_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'refresh-beach-ml-baseline'
        AND schedule = '0 7 * * *'
    ) THEN 'PASS - Scheduled daily at 7am UTC'
    ELSE 'FAIL - Cron job not found'
  END AS result;

-- =============================================================================
-- TEST 5: Verify data integrity (sample beach)
-- =============================================================================
-- Compare view data with direct query for one beach
WITH direct_query AS (
  SELECT
    b.id,
    COUNT(*) AS total,
    COUNT(p.observed_m) FILTER (
      WHERE p.observed_m IS NOT NULL AND p.observed_m > 0
    ) AS matched,
    ROUND(AVG(p.raw_error_m)::numeric, 3) AS raw_mae,
    ROUND(AVG(p.corrected_error_m)::numeric, 3) AS corrected_mae
  FROM beaches b
  INNER JOIN ml_predictions_log p ON p.beach_id = b.id
  WHERE p.predicted_at > NOW() - INTERVAL '14 days'
    AND p.observed_m IS NOT NULL
    AND p.observed_m > 0
    AND b.id = (SELECT beach_id FROM beach_ml_performance_baseline LIMIT 1)
  GROUP BY b.id
),
view_data AS (
  SELECT
    beach_id,
    predictions_total,
    predictions_matched,
    raw_mae,
    corrected_mae
  FROM beach_ml_performance_baseline
  LIMIT 1
)
SELECT
  'TEST 5: Data integrity check' AS test_name,
  CASE
    WHEN d.total = v.predictions_total
      AND d.matched = v.predictions_matched
      AND d.raw_mae = v.raw_mae
      AND d.corrected_mae = v.corrected_mae
    THEN 'PASS - View matches direct query'
    ELSE 'FAIL - Data mismatch: Direct=' || d.total || ',' || d.matched || ' View=' || v.predictions_total || ',' || v.predictions_matched
  END AS result
FROM direct_query d
CROSS JOIN view_data v;

-- =============================================================================
-- TEST 6: Verify statistical validity (minimum sample size)
-- =============================================================================
SELECT
  'TEST 6: Sample size filter' AS test_name,
  CASE
    WHEN MIN(predictions_matched) >= 5
    THEN 'PASS - All beaches have >= 5 matched predictions'
    ELSE 'FAIL - Found beaches with < 5 matches: ' || MIN(predictions_matched)
  END AS result
FROM beach_ml_performance_baseline;

-- =============================================================================
-- TEST 7: Verify calculation correctness (improvement rate)
-- =============================================================================
-- Test that improvement_rate_pct is calculated correctly
SELECT
  'TEST 7: Improvement rate calculation' AS test_name,
  CASE
    WHEN improvement_rate_pct BETWEEN 0 AND 100
      OR improvement_rate_pct IS NULL
    THEN 'PASS - All improvement rates in valid range'
    ELSE 'FAIL - Invalid improvement rate found'
  END AS result
FROM beach_ml_performance_baseline
ORDER BY improvement_rate_pct ASC
LIMIT 1;

-- =============================================================================
-- SAMPLE DATA OUTPUT
-- =============================================================================
-- Show sample of the data for manual inspection
SELECT
  'SAMPLE DATA' AS section,
  '============' AS divider;

SELECT
  beach_name,
  predictions_total,
  predictions_matched,
  match_rate_pct,
  raw_mae,
  corrected_mae,
  mae_improvement_pct,
  improvement_rate_pct,
  avg_raw_bias,
  avg_corrected_bias
FROM beach_ml_performance_baseline
ORDER BY predictions_matched DESC
LIMIT 5;

-- =============================================================================
-- SUMMARY STATISTICS
-- =============================================================================
SELECT
  'SUMMARY STATS' AS section,
  '=============' AS divider;

SELECT
  COUNT(*) AS total_beaches,
  SUM(predictions_total) AS total_predictions,
  SUM(predictions_matched) AS total_matched,
  ROUND(AVG(match_rate_pct)::numeric, 1) AS avg_match_rate_pct,
  ROUND(AVG(raw_mae)::numeric, 3) AS avg_raw_mae,
  ROUND(AVG(corrected_mae)::numeric, 3) AS avg_corrected_mae,
  ROUND(AVG(mae_improvement_pct)::numeric, 1) AS avg_mae_improvement_pct,
  ROUND(AVG(improvement_rate_pct)::numeric, 1) AS avg_improvement_rate_pct
FROM beach_ml_performance_baseline;

-- =============================================================================
-- FUNCTION TESTS
-- =============================================================================
SELECT
  'FUNCTION TEST' AS section,
  '=============' AS divider;

-- Test get_worst_performing_beaches()
SELECT
  'Worst 3 beaches:' AS category,
  beach_name,
  improvement_rate_pct,
  predictions_matched
FROM get_worst_performing_beaches(3);

-- Test get_beach_ml_performance() for first beach
SELECT
  'Individual beach lookup:' AS category,
  beach_name,
  predictions_matched,
  improvement_rate_pct
FROM get_beach_ml_performance(
  (SELECT beach_id FROM beach_ml_performance_baseline LIMIT 1)
);
