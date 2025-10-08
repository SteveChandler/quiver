-- ============================================================================
-- DELETE AUTH USERS - Direct SQL approach
-- ============================================================================
-- PURPOSE: Delete auth users when Admin REST API is blocked by app.allow_destructive
-- USAGE: Run this in Supabase SQL Editor
-- WARNING: This permanently deletes users. Cannot be undone.
-- ============================================================================

-- Enable destructive operations for this transaction
BEGIN;

-- Set the safety flag
SET LOCAL app.allow_destructive = 'on';

-- Delete users (replace UUIDs with your target users, then uncomment to execute)
-- WARNING: Review the user IDs carefully before uncommenting!
-- INSTRUCTIONS: 
--   1. Use cleanup-auth-users.sql to identify user IDs to delete
--   2. Replace EXAMPLE-UUID-HERE with actual user IDs
--   3. Uncomment the DELETE statements
--   4. Run this script in Supabase SQL Editor

-- DELETE FROM auth.users WHERE id = 'EXAMPLE-UUID-HERE';
-- DELETE FROM auth.users WHERE id = 'EXAMPLE-UUID-HERE';
-- DELETE FROM auth.users WHERE id = 'EXAMPLE-UUID-HERE';

-- Commit the transaction (or ROLLBACK if you want to cancel)
COMMIT;

-- ============================================================================
-- VERIFICATION: Check if users were deleted
-- ============================================================================
-- Run this after deletion to verify:
/*
SELECT id, email 
FROM auth.users 
WHERE id IN (
  'EXAMPLE-UUID-HERE',
  'EXAMPLE-UUID-HERE',
  'EXAMPLE-UUID-HERE'
);
-- Should return 0 rows if all were deleted successfully
*/

