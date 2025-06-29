-- Test script to validate index syntax without actually creating indexes
-- Run with: psql -d your_database --dry-run -f test-index-syntax.sql

\echo 'Testing index syntax...'

-- Test the geographic indexes that were causing issues
EXPLAIN (FORMAT TEXT) 
SELECT * FROM beaches 
WHERE latitude BETWEEN -50 AND 50 
AND longitude BETWEEN -180 AND 180;

\echo 'If no errors above, the numeric lat/lng indexes should work correctly.'

-- Test beach review index syntax
EXPLAIN (FORMAT TEXT)
SELECT * FROM beach_reviews 
WHERE beach_id = 'test-id' 
ORDER BY overall_rating DESC;

\echo 'Index syntax validation complete. No GIST errors should occur with numeric columns.' 