-- Migration: Fix Puerto Rico and Hawaii Timezone Bug
-- Impact: All PR beaches showing times 4 hours off, HI beaches 2 hours off
-- Priority: P0 (Critical)
--
-- The east coast timezone fix (20260202110000) missed PR and HI.
-- PR beaches should be America/Puerto_Rico (AST, UTC-4), not America/Los_Angeles (PST, UTC-8).
-- HI beaches should be Pacific/Honolulu (HST, UTC-10), not America/Los_Angeles (PST, UTC-8).

BEGIN;

-- Create a backup table for rollback purposes
-- Drop first to ensure fresh backup data on re-runs
DROP TABLE IF EXISTS _backup_beach_timezones_pr_hi;
CREATE TABLE _backup_beach_timezones_pr_hi AS
SELECT id, name, state, timezone
FROM beaches
WHERE state IN ('PR', 'HI')
  AND timezone = 'America/Los_Angeles';

-- Fix Puerto Rico beaches (Atlantic Standard Time, UTC-4)
UPDATE beaches
SET timezone = 'America/Puerto_Rico'
WHERE state = 'PR'
  AND timezone = 'America/Los_Angeles';

-- Fix Hawaii beaches (Hawaii-Aleutian Standard Time, UTC-10)
UPDATE beaches
SET timezone = 'Pacific/Honolulu'
WHERE state = 'HI'
  AND timezone = 'America/Los_Angeles';

-- Verification query (run manually to confirm fix)
-- SELECT state, timezone, COUNT(*)
-- FROM beaches
-- WHERE state IN ('PR', 'HI')
-- GROUP BY state, timezone
-- ORDER BY state;

COMMIT;

-- Rollback procedure:
-- BEGIN;
-- UPDATE beaches b
-- SET timezone = bk.timezone
-- FROM _backup_beach_timezones_pr_hi bk
-- WHERE b.id = bk.id;
-- DROP TABLE _backup_beach_timezones_pr_hi;
-- COMMIT;
