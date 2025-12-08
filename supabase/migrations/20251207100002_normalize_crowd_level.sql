-- Normalize crowd_level to 4-level scale: light, moderate, crowded, very_crowded
-- Migration: 20251207100002_normalize_crowd_level.sql
--
-- Current distribution (11 inconsistent values):
--   crowded (72), high (47), medium (33), moderate (25)
--   very_crowded (20), low (16), extremely_crowded (9)
--   very_high (6), light (3), heavy (2), NULL (2)
--
-- Mapping:
--   light, low → light
--   moderate, medium → moderate
--   crowded, high, heavy → crowded
--   very_crowded, very_high, extremely_crowded → very_crowded

BEGIN;

-- Map to 'light' (from: light, low)
UPDATE beaches SET crowd_level = 'light' WHERE crowd_level IN ('low');
-- 'light' stays as 'light'

-- Map to 'moderate' (from: moderate, medium)
UPDATE beaches SET crowd_level = 'moderate' WHERE crowd_level IN ('medium');
-- 'moderate' stays as 'moderate'

-- Map to 'crowded' (from: crowded, high, heavy)
UPDATE beaches SET crowd_level = 'crowded' WHERE crowd_level IN ('high', 'heavy');
-- 'crowded' stays as 'crowded'

-- Map to 'very_crowded' (from: very_crowded, very_high, extremely_crowded)
UPDATE beaches SET crowd_level = 'very_crowded' WHERE crowd_level IN ('very_high', 'extremely_crowded');
-- 'very_crowded' stays as 'very_crowded'

COMMIT;

-- ============================================================================
-- VERIFICATION: Check crowd_level distribution after migration
-- ============================================================================
-- SELECT crowd_level, COUNT(*) FROM beaches WHERE deleted_at IS NULL GROUP BY crowd_level ORDER BY COUNT(*) DESC;
--
-- Expected result:
--   crowded: 121 (was: crowded 72 + high 47 + heavy 2)
--   moderate: 58 (was: moderate 25 + medium 33)
--   very_crowded: 35 (was: very_crowded 20 + very_high 6 + extremely_crowded 9)
--   light: 19 (was: light 3 + low 16)
--   NULL: 2
