-- =============================================================================
-- ROLLBACK: Restore prior skill level values for 3 SD beaches
-- =============================================================================
-- Reverts the data corrections applied in 20260220000000_add_skill_level_to_nearby_beaches.sql
-- Only run this migration if the skill level corrections need to be undone.
--
-- Prior values (before 2026-02-20):
--   Ocean Beach Pier: intermediate
--   Swami's: intermediate-advanced
--   Avalanche: beginner-intermediate
-- =============================================================================

BEGIN;

UPDATE beaches
SET skill_level = 'intermediate'
WHERE slug = 'ocean-beach-pier' AND city = 'San Diego' AND state = 'CA';

UPDATE beaches
SET skill_level = 'intermediate-advanced'
WHERE slug = 'swamis' AND city = 'Encinitas' AND state = 'CA';

UPDATE beaches
SET skill_level = 'beginner-intermediate'
WHERE slug = 'avalanche' AND city = 'San Diego' AND state = 'CA';

COMMIT;
