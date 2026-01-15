-- Migration: Seed San Diego beaches with tide preferences and educational content
-- Part D of Tide Intelligence feature
-- Date: 2026-01-14
--
-- This migration:
-- 1. UPDATEs ~27 existing San Diego beaches with:
--    - preferred_tide_direction (rising, falling, slack, either)
--    - best_conditions_prose (educational tide explanation)
--    - wave_tips (practical surfing advice)
--    - region = 'San Diego' where null
-- 2. INSERTs 5 missing beaches: La Jolla Cove, Bird Rock, Pumphouse, South Mission Jetty, Ocean Beach Jetty

BEGIN;

-- ============================================================================
-- PART 1: UPDATE existing San Diego beaches with tide preferences
-- ============================================================================

-- 1. San Onofre State Beach
UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'San Onofre is a model of consistency, working on nearly any tide. The mellow, rolling waves here are forgiving across the tidal range, making it ideal for longboarders and beginners. Paddle out whenever the swell is up.',
  wave_tips = 'Bring a longboard or a fish for the soft, rolling waves. The vibe is mellow—enjoy the classic California surf experience.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%San Onofre State Beach%' OR name = 'San Onofre State Beach';

-- 2. Lower Trestles
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Lowers fires best on a medium tide, ideally around the slack periods before major tidal swings. Too high and it gets mushy; too low and the reef gets exposed. Time your session for the transitions.',
  wave_tips = 'The crowd is competitive—sit patient, pick your waves wisely, and respect the rotation. A-frame peaks reward precision.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Lower Trestles%' OR name ILIKE '%Lowers%';

-- 3. Oceanside Pier
UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Reliable and consistent, Oceanside Pier works on most tides. The sandbars shift, but there''s usually a peak forming somewhere along the pier. Check both sides for the best shape.',
  wave_tips = 'Paddle out near the pier and watch for wedging peaks on both sides. Santa Ana mornings are prime time.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Oceanside%Pier%';

-- 4. Terramar Point
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Terramar is highly sensitive to tide. The reef configuration means it needs a mid-tide to connect sections properly. At high tide, waves back off; at low tide, it can get dangerously shallow.',
  wave_tips = 'Check the tide chart before heading out. Mid-tide windows are short but rewarding when it''s working.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Terramar%';

-- 5. Ponto
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Ponto prefers a lower to mid-tide when the sandbars have more definition. As the tide fills in, the waves lose their punch and start to section. Time your session for the dropping or low tide window.',
  wave_tips = 'Can be heavy on the bigger swells—respect the power and be aware of the rip near the jetty.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Ponto%';

-- 6. Grandview
UPDATE beaches SET
  preferred_tide_direction = 'falling',
  best_conditions_prose = 'Grandview comes alive as the tide drops. The reef needs lower water to create the steep, hollow takeoff it''s known for. High tide washes out the shape entirely.',
  wave_tips = 'Access is via a long staircase—be prepared for the hike. The wave is worth the effort on the right tide.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Grandview%';

-- 7. Moonlight State Beach
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Catch this spot on the incoming tide for the best shape. The rising water pushes up the sandbars and creates more defined peaks. At low tide, it can be flat and closed out.',
  wave_tips = 'Great for beginners and longboarders on smaller days. The beach has amenities and is family-friendly.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Moonlight%';

-- 8. D Street
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Timing is key at D Street. The reef works best on a medium tide when the water covers the shallow spots but doesn''t drown the wave. Avoid extreme tides.',
  wave_tips = 'Can get crowded with longboarders and shortboarders sharing the lineup. Be patient and find your spot.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'D Street' OR name ILIKE '%D Street%Encinitas%';

-- 9. Swami's
UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Swami''s is a tide-tolerant machine that produces quality rights across the tidal range. It handles incoming and outgoing tides well, though extreme lows can get sectiony.',
  wave_tips = 'The paddle out is long and the crowd is serious. Respect the rotation and take your turn. Early mornings are less hectic.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Swami%';

-- 10. Cardiff Reef
UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Consistent and reliable, Cardiff Reef works on most tides. The playful reef produces fun waves for fishes and logs across the tidal range.',
  wave_tips = 'Popular with SUPs and longboards—give space and share the waves. Watch for reef fingers on the inside.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Cardiff%Reef%' OR name = 'Cardiff Reef';

-- 11. San Elijo State Beach / Pipes
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'Pipes works best at a mid-tide when the sandbar has definition. Too high and it mushes out; too low and it closes out. Time your session for the transitions.',
  wave_tips = 'Great for camping trips—surf and sleep right on the beach. The left can be fun when it''s working.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%San Elijo%' OR name ILIKE '%Pipes%';

-- 12. Del Mar Rivermouth
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Target a rising tide for the best shape at the rivermouth. The incoming water pushes up the sandbars and creates steeper, more defined peaks. Low tide can be flat.',
  wave_tips = 'Water quality can be an issue after rain—check reports before paddling out. The rip can get strong on big swells.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Del Mar%Rivermouth%' OR name ILIKE '%Del Mar Rivermouth%';

-- 13. Blacks
UPDATE beaches SET
  preferred_tide_direction = 'falling',
  best_conditions_prose = 'For the legendary hollow barrels at Blacks, you need a falling tide. As the water drops, the canyon-focused energy creates steeper, more powerful waves. High tide is mushier and less defined.',
  wave_tips = 'Be prepared for a long hike down from the Gliderport. The crowd is experienced—watch and learn before paddling out.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Black%' AND name NOT ILIKE '%Blackie%';

-- 14. Scripps
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Scripps prefers an incoming tide when the pier banks come alive. The rising water creates more push and defined peaks on both sides of the pier.',
  wave_tips = 'Watch for the pier pilings and the rebound waves they create. The UCSD crowd maintains strict etiquette.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Scripps%';

-- 15. La Jolla Shores
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'The Shores favors an incoming tide for the best shape. Rising water pushes up the soft inside reform that makes this spot perfect for beginners. Low tide can be flat and undefined.',
  wave_tips = 'Popular with surf schools and kayakers—watch for beginners and share the waves. The parking lot fills early on sunny days.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%La Jolla Shores%';

-- 16. Windansea
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Windansea thrives on an incoming tide. The rising water covers the shallow reef and creates the hollow, powerful waves this spot is famous for. Too low and it''s dangerously shallow; too high and it backs off.',
  wave_tips = 'Localism is a factor here—respect the lineup and wait your turn. The reef is shallow and uneven with urchins.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Windansea%';

-- 17. PB Point
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'PB Point is a low-tide spot that needs the water to drain off the reef for shape. As the tide drops toward low slack, the right becomes more defined and hollow.',
  wave_tips = 'A long paddle is required to reach the outside reef. Bring a good leash and be prepared for the current.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%PB Point%';

-- 18. Tourmaline (both variants if they exist)
UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Tourmaline works on most tides, making it one of the most forgiving spots in San Diego. The mellow longboard wave rolls in regardless of tidal stage, though mid-tide offers the best shape.',
  wave_tips = 'Party waves are common—expect to share. The vibe is mellow and beginner-friendly.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Tourmaline%';

-- 19. Crystal Pier
UPDATE beaches SET
  preferred_tide_direction = 'either',
  best_conditions_prose = 'Crystal Pier is a dependable option that works across the tidal range. The pier creates banks on both sides that shift with the sand, providing peaks at any tide.',
  wave_tips = 'Can get crowded with tourists and surf schools. Paddle out near the pier and watch for wedging peaks.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Crystal Pier%';

-- 20. Pacific Beach
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'PB works best with tidal push from an incoming tide. The rising water creates more defined peaks along the beachbreak. Low tide can be flat and sectiony.',
  wave_tips = 'Crowded with tourists, surf schools, and beginners. Spread out to find your own peak.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Pacific Beach%' AND name NOT ILIKE '%Pier%' AND name NOT ILIKE '%Point%' AND name NOT ILIKE '%Crystal%';

-- 21. Mission Beach (all variants)
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Mission Beach benefits from incoming tide that pushes up the sandbars. The jetty creates wedging peaks that work best on rising water.',
  wave_tips = 'Good central location with amenities nearby. The jetty rip can be strong—paddle out with caution.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Mission Beach%';

-- 22. Ocean Beach Pier
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'The Pier works best when tide is lower to mid, letting the sandbars define themselves. Extreme tides either wash out the shape or expose hazards.',
  wave_tips = 'Watch out for pier pilings and the strong current that flows along them. The north side often has cleaner conditions.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Ocean Beach Pier%';

-- 23. Ocean Beach (general, not pier)
UPDATE beaches SET
  preferred_tide_direction = 'slack',
  best_conditions_prose = 'The OB beachbreak prefers a mid-tide when the sandbars near the jetty have definition. Too high drowns it; too low exposes the closeouts.',
  wave_tips = 'Dog beach runoff can affect water quality. Check both sides of the jetty for the best shape.',
  region = COALESCE(region, 'San Diego')
WHERE name = 'Ocean Beach' OR (name ILIKE '%Ocean Beach%' AND name NOT ILIKE '%Pier%' AND name NOT ILIKE '%Jetty%');

-- 24. Sunset Cliffs - Garbage
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Paddle out on a rising tide at Garbage. The incoming water covers the shallow reef sections and creates more defined walls. Low tide is dangerous and too shallow.',
  wave_tips = 'Access is difficult via cliff scramble. Check your exit before paddling out and respect the locals.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Sunset Cliffs%Garbage%' OR name ILIKE '%Garbage%';

-- 25. Coronado (Hotel Del and North Jetty)
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Coronado needs water to push over the flat sandbars. Target a rising tide for the best shape—the incoming flow creates more defined peaks along the beachbreak.',
  wave_tips = 'Water quality can be an issue near the jetty. Check reports before paddling out, especially after rain.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Coronado%' OR name ILIKE '%Hotel Del%' OR name ILIKE '%Shipwrecks%';

-- 26. Imperial Beach (all variants)
UPDATE beaches SET
  preferred_tide_direction = 'rising',
  best_conditions_prose = 'Target an incoming tide at IB for the best shape. The rising water creates steeper faces on the beachbreak peaks. Low tide can be flat and undefined.',
  wave_tips = 'Check water quality reports before surfing—the Tijuana River can affect conditions after rain.',
  region = COALESCE(region, 'San Diego')
WHERE name ILIKE '%Imperial Beach%';

-- ============================================================================
-- PART 2: INSERT 5 missing beaches
-- ============================================================================

-- La Jolla Cove
INSERT INTO beaches (
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  region,
  slug,
  description
)
SELECT
  'La Jolla Cove',
  'La Jolla',
  'CA',
  'USA',
  32.8503,
  -117.2729,
  'reef',
  'advanced',
  'either',
  'La Jolla Cove is a protected reef that works on most tides. The kelp forest can affect wave shape, but when it''s clean, the reef produces fun walls.',
  'The cove is more famous for snorkeling and diving. Surf only when conditions align—it''s rare but rewarding.',
  'San Diego',
  'la-jolla-cove',
  'Protected cove with reef breaks that occasionally produce surfable waves. More famous for marine life and diving than surfing.'
WHERE NOT EXISTS (
  SELECT 1 FROM beaches WHERE lower(name) = lower('La Jolla Cove')
);

-- Bird Rock
INSERT INTO beaches (
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  region,
  slug,
  description
)
SELECT
  'Bird Rock',
  'La Jolla',
  'CA',
  'USA',
  32.8135,
  -117.2739,
  'reef',
  'intermediate',
  'slack',
  'Bird Rock prefers a mid-tide when the reef has enough water but the waves still have shape. Avoid extreme lows when the reef is exposed.',
  'Multiple peaks along the reef—scout from above before paddling out. Respect the local crew.',
  'San Diego',
  'bird-rock',
  'Reef break in the Bird Rock neighborhood of La Jolla. Multiple peaks along a rocky coastline provide intermediate-level waves.'
WHERE NOT EXISTS (
  SELECT 1 FROM beaches WHERE lower(name) = lower('Bird Rock')
);

-- Pumphouse
INSERT INTO beaches (
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  region,
  slug,
  description
)
SELECT
  'Pumphouse',
  'La Jolla',
  'CA',
  'USA',
  32.8098,
  -117.2728,
  'reef',
  'intermediate',
  'falling',
  'Pumphouse needs a dropping tide to work. As the water drains, the reef creates steeper, more hollow sections. High tide washes out the shape.',
  'Named for the nearby pump station. The left can be particularly hollow on the right swell and tide.',
  'San Diego',
  'pumphouse-la-jolla',
  'Reef break near Bird Rock known for hollow lefts on dropping tides. Works best with west-northwest swell and light offshore winds.'
WHERE NOT EXISTS (
  SELECT 1 FROM beaches WHERE lower(name) = lower('Pumphouse')
);

-- South Mission Jetty
INSERT INTO beaches (
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  region,
  slug,
  description
)
SELECT
  'South Mission Jetty',
  'San Diego',
  'CA',
  'USA',
  32.7549,
  -117.2534,
  'jetty',
  'intermediate',
  'slack',
  'The South Mission Jetty works best on a mid-tide when the sandbars next to the jetty have definition. The jetty creates wedging rights and lefts.',
  'Watch for the current that runs along the jetty. The rocks can be hazardous at low tide.',
  'San Diego',
  'south-mission-jetty',
  'Jetty break at the south end of Mission Beach. Creates wedging peaks on both sides of the rock structure.'
WHERE NOT EXISTS (
  SELECT 1 FROM beaches WHERE lower(name) = lower('South Mission Jetty')
);

-- Ocean Beach Jetty
INSERT INTO beaches (
  name,
  city,
  state,
  country,
  lat,
  lon,
  break_type,
  skill_level,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  region,
  slug,
  description
)
SELECT
  'Ocean Beach Jetty',
  'San Diego',
  'CA',
  'USA',
  32.7516,
  -117.2489,
  'jetty',
  'intermediate',
  'slack',
  'The OB Jetty prefers a mid-tide when the sandbars along the rocks create defined peaks. Extreme tides either expose the rocks or drown the shape.',
  'Dog beach runoff can affect water quality. The jetty creates a strong current—be aware of the pull.',
  'San Diego',
  'ocean-beach-jetty',
  'Jetty break at Ocean Beach creating wedging peaks. Works best on mid-tides with west-northwest swell.'
WHERE NOT EXISTS (
  SELECT 1 FROM beaches WHERE lower(name) = lower('Ocean Beach Jetty')
);

COMMIT;
