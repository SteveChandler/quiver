-- Migration: Normalize Beach Skill Levels
--
-- Backfills compound skill_level values (e.g., 'beginner-intermediate') to
-- the LOWER skill level (safety-conservative), then adds a CHECK constraint
-- and NOT NULL default to enforce clean enum values going forward.
--
-- Current compound values in production (~120 beaches):
--   'beginner-intermediate' → 'beginner'
--   'intermediate-advanced' → 'intermediate'
--   'lower-intermediate'    → 'intermediate'
--   'upper-intermediate'    → 'intermediate'
--   'all'                   → 'beginner' (accessible to all = beginner-safe)
--   NULL                    → 'intermediate' (via DEFAULT)

BEGIN;

-- Backup for rollback
CREATE TABLE IF NOT EXISTS _backup_skill_levels_20260312 AS
SELECT id, name, skill_level
FROM beaches
WHERE skill_level NOT IN ('beginner', 'intermediate', 'advanced', 'expert')
   OR skill_level IS NULL;

-- Normalize compound values (safety-conservative: map to LOWER level)
UPDATE beaches SET skill_level = 'beginner'
WHERE skill_level = 'beginner-intermediate';

UPDATE beaches SET skill_level = 'intermediate'
WHERE skill_level IN ('intermediate-advanced', 'lower-intermediate', 'upper-intermediate');

UPDATE beaches SET skill_level = 'beginner'
WHERE skill_level = 'all';

-- Fill NULLs with default
UPDATE beaches SET skill_level = 'intermediate'
WHERE skill_level IS NULL;

-- Add NOT NULL constraint with default
ALTER TABLE beaches
  ALTER COLUMN skill_level SET DEFAULT 'intermediate',
  ALTER COLUMN skill_level SET NOT NULL;

-- Add CHECK constraint to enforce valid enum values
ALTER TABLE beaches
  ADD CONSTRAINT beaches_skill_level_check
  CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert'));

COMMIT;

-- Rollback procedure:
-- BEGIN;
-- ALTER TABLE beaches DROP CONSTRAINT IF EXISTS beaches_skill_level_check;
-- ALTER TABLE beaches ALTER COLUMN skill_level DROP NOT NULL;
-- ALTER TABLE beaches ALTER COLUMN skill_level DROP DEFAULT;
-- UPDATE beaches b
-- SET skill_level = bk.skill_level
-- FROM _backup_skill_levels_20260312 bk
-- WHERE b.id = bk.id;
-- DROP TABLE IF EXISTS _backup_skill_levels_20260312;
-- COMMIT;
