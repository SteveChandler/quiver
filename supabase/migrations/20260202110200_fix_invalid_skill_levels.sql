-- Migration: Fix Invalid Skill Level Data
-- Impact: 1 beach (Swami's) has a full sentence instead of enum value, breaking UI filters
-- Priority: P1 (High)
--
-- Note: Compound values like "beginner-intermediate", "intermediate-advanced" appear
-- to be intentional and are used by ~120 beaches. Only fixing the full sentence case.

BEGIN;

-- Backup the original value
CREATE TABLE IF NOT EXISTS _backup_skill_levels_20260202 AS
SELECT id, name, skill_level
FROM beaches
WHERE skill_level NOT IN (
  'beginner', 'intermediate', 'advanced', 'expert', 'all',
  'beginner-intermediate', 'intermediate-advanced',
  'lower-intermediate', 'upper-intermediate'
)
  AND skill_level IS NOT NULL;

-- Fix Swami's - the only beach with a full prose sentence
-- Original: "Intermediate to advanced (inside reforms can be easier on small days)"
UPDATE beaches
SET skill_level = 'intermediate-advanced'
WHERE id = 'b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0'
  AND skill_level LIKE 'Intermediate to advanced%';

COMMIT;

-- Verification query:
-- SELECT id, name, skill_level
-- FROM beaches
-- WHERE LENGTH(skill_level) > 25;

-- Rollback procedure:
-- BEGIN;
-- UPDATE beaches b
-- SET skill_level = bk.skill_level
-- FROM _backup_skill_levels_20260202 bk
-- WHERE b.id = bk.id;
-- DROP TABLE _backup_skill_levels_20260202;
-- COMMIT;
