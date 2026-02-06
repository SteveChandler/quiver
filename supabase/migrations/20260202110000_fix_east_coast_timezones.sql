-- Migration: Fix East Coast Timezone Bug
-- Impact: 42 beaches showing tide/notification times 3 hours off
-- Priority: P0 (Critical)
--
-- This fixes beaches that incorrectly have America/Los_Angeles timezone
-- when they should have their regional timezone based on state.

BEGIN;

-- Create a backup table for rollback purposes
CREATE TABLE IF NOT EXISTS _backup_beach_timezones_20260202 AS
SELECT id, name, state, timezone
FROM beaches
WHERE state IN ('FL', 'NC', 'SC', 'GA', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME', 'TX')
  AND timezone = 'America/Los_Angeles';

-- Fix East Coast beaches (should be America/New_York)
UPDATE beaches
SET timezone = 'America/New_York'
WHERE state IN ('FL', 'NC', 'SC', 'GA', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME')
  AND timezone = 'America/Los_Angeles';

-- Fix Texas Gulf Coast beaches (should be America/Chicago)
UPDATE beaches
SET timezone = 'America/Chicago'
WHERE state = 'TX'
  AND timezone = 'America/Los_Angeles';

-- Verification query (run manually to confirm fix)
-- SELECT state, timezone, COUNT(*)
-- FROM beaches
-- WHERE state IN ('FL', 'NC', 'SC', 'GA', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME', 'TX')
-- GROUP BY state, timezone
-- ORDER BY state;

COMMIT;

-- Rollback procedure:
-- BEGIN;
-- UPDATE beaches b
-- SET timezone = 'America/Los_Angeles'
-- FROM _backup_beach_timezones_20260202 bk
-- WHERE b.id = bk.id;
-- DROP TABLE _backup_beach_timezones_20260202;
-- COMMIT;
