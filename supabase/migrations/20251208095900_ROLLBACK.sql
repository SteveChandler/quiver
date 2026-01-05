-- =============================================================================
-- ROLLBACK for: 20251208100000_fix_blacks_beach_data.sql
-- =============================================================================
-- Created: 2025-12-08
-- Purpose: Rollback the Blacks Beach data fix
--
-- WARNING: This will revert the city and state back to their previous values
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Revert Blacks Beach to previous state
-- =============================================================================
-- Note: Based on the migration verification, the previous values were:
-- - city: 'San Diego'
-- - state: 'CA'
-- - slug: 'blacks' (unchanged)
-- - break_type: 'beach' (unchanged)

UPDATE public.beaches SET
  city = 'San Diego',  -- Was 'La Jolla', reverting to 'San Diego'
  state = 'CA',        -- Already 'CA', no change needed
  slug = 'blacks',     -- Already 'blacks', no change needed
  break_type = 'beach' -- Already 'beach', no change needed
WHERE id = '01330afc-00d3-461b-88f3-b173774766f4'
  AND name = 'Blacks';

COMMIT;

-- =============================================================================
-- POST-ROLLBACK VERIFICATION
-- =============================================================================
/*
-- Verify rollback
SELECT id, name, city, state, slug, break_type
FROM beaches
WHERE id = '01330afc-00d3-461b-88f3-b173774766f4';

-- Expected result:
-- id: 01330afc-00d3-461b-88f3-b173774766f4
-- name: Blacks
-- city: San Diego (reverted from La Jolla)
-- state: CA
-- slug: blacks
-- break_type: beach
*/
