-- Tag select WA, OR, and FL beaches as longboard-eligible
--
-- These beaches were originally seeded as 'lower-intermediate', then normalized
-- to 'intermediate' by migration 20260312130000. Research confirms they are
-- beginner-friendly / longboard-appropriate, so we downgrade to 'beginner' to
-- make them match the longboard intent filter (skill_level ILIKE '%beginner%').
--
-- CHECK constraint on skill_level allows: beginner, intermediate, advanced, expert
-- (no compound values like 'beginner-intermediate')

BEGIN;

-- WA: La Push – Second Beach (wide sandy beach, playful waves ideal for longboarding)
UPDATE beaches SET skill_level = 'beginner'
WHERE name = 'La Push – Second Beach' AND state = 'WA' AND skill_level = 'intermediate';

-- WA: Hobuck Beach (soft waves suitable for longboards per wave tips)
UPDATE beaches SET skill_level = 'beginner'
WHERE name = 'Hobuck Beach (Neah Bay)' AND state = 'WA' AND skill_level = 'intermediate';

-- OR: Sunset Bay State Park (sheltered bay, rolling waves, longboard terrain)
UPDATE beaches SET skill_level = 'beginner'
WHERE name = 'Sunset Bay State Park' AND state = 'OR' AND skill_level = 'intermediate';

-- OR: Bastendorff Beach (wide sandy beach, popular beginner spot)
UPDATE beaches SET skill_level = 'beginner'
WHERE name = 'Bastendorff Beach' AND state = 'OR' AND skill_level = 'intermediate';

-- FL: Flagler Beach (mellow away from pier, longboard-friendly on average days)
UPDATE beaches SET skill_level = 'beginner'
WHERE name = 'Flagler Beach' AND state = 'FL' AND skill_level = 'intermediate';

-- FL: Deerfield Beach Pier (small sandbars, typical South FL mush ideal for longboarding)
UPDATE beaches SET skill_level = 'beginner'
WHERE name = 'Deerfield Beach Pier' AND state = 'FL' AND skill_level = 'intermediate';

COMMIT;
