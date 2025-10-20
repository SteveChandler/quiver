-- Add structured beach content fields for better UX and SEO

-- Features array (filterable beach characteristics)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS features TEXT[];

-- Practical tips (structured from local knowledge)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS parking_tips TEXT;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS access_tips TEXT;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS wave_tips TEXT;
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS crowd_tips TEXT;

-- Best conditions (human-readable)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS best_conditions_prose TEXT;

-- Warnings (safety/hazards)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS warnings TEXT[];

-- Local etiquette
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS local_etiquette TEXT;

-- Crowd level
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS crowd_level TEXT;

-- Description (2-3 paragraphs)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS description TEXT;

-- Real takeaways (emoji-prefixed local tips)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS real_takeaways TEXT[];

-- Best months for surfing (1-12)
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS best_months INTEGER[];

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_beaches_features ON beaches USING GIN (features);
CREATE INDEX IF NOT EXISTS idx_beaches_crowd_level ON beaches (crowd_level);
CREATE INDEX IF NOT EXISTS idx_beaches_best_months ON beaches USING GIN (best_months);

-- Column descriptions
COMMENT ON COLUMN beaches.features IS 'Feature tags for filtering (e.g., "Beginner friendly", "Lifeguard on duty")';
COMMENT ON COLUMN beaches.best_conditions_prose IS 'Human-readable best conditions (e.g., "Mid tide with offshore winds")';
COMMENT ON COLUMN beaches.warnings IS 'Safety warnings and hazards';
COMMENT ON COLUMN beaches.real_takeaways IS 'Emoji-prefixed local tips';

-- Populate curated beach content for top San Diego spots
-- Pacific Beach
UPDATE beaches SET
  description = 'Popular beachbreak near Crystal Pier with consistent waves year-round. Best for beginners and intermediates, with plenty of peaks to spread out. The crowd can be heavy with surf schools and rentals, especially on weekends. Parking is challenging but the easy access and amenities make it a go-to spot for many San Diego surfers.',
  features = ARRAY['Beginner friendly', 'Sandy bottom', 'Board rental nearby', 'Lifeguard on duty', 'Year-round surf', 'Surf schools'],
  parking_tips = 'Street parking tight; aim a few blocks inland after 7am',
  wave_tips = 'Peaky beachbreak; best on combo swells at mid tide',
  crowd_tips = 'Beginners + rentals = heavy crowd; spread north toward Law St',
  warnings = ARRAY['Rip by Crystal Pier pilings when sets stack'],
  best_conditions_prose = 'Combo swells at mid tide with offshore winds',
  crowd_level = 'heavy',
  best_months = ARRAY[8, 9, 10, 11, 12, 1, 2, 3]
WHERE name ILIKE '%Pacific Beach%';

-- Ocean Beach
UPDATE beaches SET
  description = 'Powerful beachbreak near the OB Pier with shifting sandbars that can handle serious size. The pier creates banks that often produce the best waves in the area. Morning offshore winds during Santa Ana conditions make for epic sessions. Be mindful of the jetty and pier - both create strong rips when the swell is up.',
  features = ARRAY['Handles size', 'Powerful waves', 'Pier creates banks', 'Parking lot', 'Year-round surf'],
  parking_tips = 'Big lots at Dog Beach/Voltaire fill by 8am weekends',
  wave_tips = 'Sandbars near pier handle more size; kelp can clean up winds. Morning offshore on Santa Ana days = go time',
  crowd_tips = 'Moderate crowd levels',
  warnings = ARRAY['Jetty rips + pier pull; be sharp on exits'],
  best_conditions_prose = 'Morning offshore Santa Ana days, sandbars near pier handle size',
  crowd_level = 'moderate',
  best_months = ARRAY[10, 11, 12, 1, 2, 3]
WHERE name ILIKE '%Ocean Beach%' AND NOT name ILIKE '%Pier%';

-- La Jolla Shores
UPDATE beaches SET
  description = 'Gentle beachbreak perfect for beginners and longboarders. The inside reform provides soft, forgiving waves ideal for learning. Best on small days under 4ft. The large parking lot at Kellogg Park makes access easy, though it fills up quickly on sunny days. Watch for shifting channels that can create lateral drift.',
  features = ARRAY['Beginner friendly', 'Longboard spot', 'Sandy bottom', 'Parking lot', 'Lifeguard on duty', 'Gentle waves'],
  parking_tips = 'Large lot at Kellogg Park; gone early on sunny days',
  wave_tips = 'Inside reform = beginner gold on <4 ft. Mellow on high tide, soft/mushy; better push mid tide',
  crowd_tips = 'Gentle vibe; watch for drifting learners',
  warnings = ARRAY['Channels move—watch lateral drift near towers'],
  best_conditions_prose = 'Mid tide, small waves <4ft, perfect for beginners',
  crowd_level = 'heavy',
  best_months = ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
WHERE name ILIKE '%La Jolla Shores%';

-- Windansea
UPDATE beaches SET
  description = 'Iconic reef break with a compact takeoff zone and powerful waves. Best on S/SSW swells at low to mid tide. This is not a beginner spot - the reef is uneven with urchins, and there''s a strong local presence. Respect the lineup, wait your turn, and be prepared for the consequences if you don''t. One of the most photogenic spots in San Diego.',
  features = ARRAY['Reef break', 'Powerful waves', 'Scenic', 'Compact takeoff', 'Strong etiquette'],
  wave_tips = 'Reef, compact takeoff zone; best low→mid tide on S/SSW',
  crowd_tips = 'Localism-lite: strong etiquette matters',
  warnings = ARRAY['Uneven reef + urchins; avoid fat high tides (backwash)'],
  best_conditions_prose = 'Low to mid tide on S/SSW swell, clean conditions',
  local_etiquette = 'Strong etiquette expected, respect locals',
  crowd_level = 'heavy',
  best_months = ARRAY[5, 6, 7, 8, 9, 10]
WHERE name ILIKE '%Windansea%';

-- Blacks Beach
UPDATE beaches SET
  description = 'Legendary big-wave spot accessible via steep hike from the Gliderport. Canyon orientation focuses swell energy into powerful, hollow waves. Best on clean NE morning winds at low to mid tide. The crowd is heavy with experienced chargers - watch and learn before paddling out. Strong rips and longshore currents make this an advanced-only spot. Pack light for the hike and plan your exit strategy before going out.',
  features = ARRAY['Advanced only', 'Powerful waves', 'Canyon focus', 'Steep hike access', 'Clothing optional'],
  access_tips = 'Steep hike (Gliderport); pack light, sandals bad idea',
  wave_tips = 'Canyon power; best low→mid tide, clean NE mornings',
  crowd_tips = 'Crowded with chargers; sit wide till you read it',
  warnings = ARRAY['Strong rip/longshore; commit to your exit plan'],
  best_conditions_prose = 'Low to mid tide, clean NE morning winds, powerful waves',
  local_etiquette = 'Respect the chargers, watch and learn before paddling out',
  crowd_level = 'heavy',
  best_months = ARRAY[11, 12, 1, 2, 3]
WHERE name ILIKE '%Black%';

-- Scripps Pier
UPDATE beaches SET
  description = 'Consistent pier break near UCSD with the pier creating reliable sandbars. Mid tide is the sweet spot when the banks are working. Limited close parking means you''ll often walk from La Jolla Shores lots. The UCSD crowd maintains tighter etiquette near the pier. Watch for weird rebounds and suckout from the pilings.',
  features = ARRAY['Pier break', 'Consistent', 'Sandy bottom', 'University crowd', 'Year-round surf'],
  parking_tips = 'Limited close parking; walk from Shores lots when packed',
  wave_tips = 'Pier banks like a magnet; mid tide is the sweet spot',
  crowd_tips = 'UCSD crowd; tighter etiquette near the pier',
  warnings = ARRAY['Pier pilings create weird rebound + suckout'],
  best_conditions_prose = 'Mid tide, pier creates banks',
  crowd_level = 'moderate',
  best_months = ARRAY[8, 9, 10, 11, 12, 1, 2, 3, 4]
WHERE name ILIKE '%Scripps%';

-- Tourmaline
UPDATE beaches SET
  description = 'Longboard and fish heaven with soft, rolling waves and cruisey shoulders. Best on mid to high tide with small W/NW or combo swells. The parking lot fills late morning but has decent turnover. Gentle vibe overall, though watch for drifting learners. Perfect spot for a mellow session on a small day.',
  features = ARRAY['Longboard spot', 'Fish friendly', 'Gentle waves', 'Parking lot', 'Relaxed vibe', 'Good for learning'],
  parking_tips = 'Lot fills late morning; turnover after lunchtime',
  wave_tips = 'Log/fish heaven; soft rollers, cruisey shoulders. Likes mid→high tide on small W/NW or combo',
  crowd_tips = 'Gentle vibe; watch for drifting learners',
  best_conditions_prose = 'Mid to high tide on small W/NW or combo swells, longboard spot',
  local_etiquette = 'Gentle vibe, longboard friendly',
  crowd_level = 'moderate',
  best_months = ARRAY[9, 10, 11, 12, 1, 2, 3, 4]
WHERE name ILIKE '%Tourmaline%';

-- Swami's
UPDATE beaches SET
  description = 'Classic point break producing long right-handers on lined-up WNW swells in winter or long-period S swells in summer. Early paddle pays off as rotations form by 8am. Strict lineup etiquette - sit wide and wait your turn to snipe insiders. Kelp beds can slow boards, keep your rails clean. One of the most consistent and revered spots in North County.',
  features = ARRAY['Point break', 'Right-handers', 'Long rides', 'Consistent', 'Strict etiquette', 'Advanced spot'],
  wave_tips = 'Point-rights; best on lined-up WNW (winter) or long-period S. Early paddle pays—rotations form by 8am',
  crowd_tips = 'Strict etiquette; sit wide to snipe insiders',
  warnings = ARRAY['Kelp beds can slow boards—keep rails clean'],
  best_conditions_prose = 'Lined-up WNW (winter) or long-period S swell, point break rights',
  local_etiquette = 'Strict lineup etiquette, arrive early',
  crowd_level = 'heavy',
  best_months = ARRAY[11, 12, 1, 2, 3, 6, 7, 8]
WHERE name ILIKE '%Swami%';

-- Cardiff Reef
UPDATE beaches SET
  description = 'Playful reef break that excels on mid tide with fishes and logs. State lot and shoulder parking available (bring a pass or pay). Mixed craft lineups mean you''ll see SUPs and foils - give them space. Watch for reef fingers and eelgrass on the inside. Fun, approachable reef for intermediates.',
  features = ARRAY['Reef break', 'Fish friendly', 'Longboard spot', 'State park lot', 'Mixed craft', 'Playful waves'],
  parking_tips = 'State lot + shoulder parking; bring a pass or pay',
  wave_tips = 'Playful reef; mid tide, fishes/logs excel',
  crowd_tips = 'Mixed craft lineups—give space to SUPs/foils',
  warnings = ARRAY['Reef fingers + eelgrass = watch the inside'],
  best_conditions_prose = 'Mid tide, playful reef good for fish/logs',
  crowd_level = 'moderate',
  best_months = ARRAY[9, 10, 11, 12, 1, 2, 3, 4]
WHERE name ILIKE '%Cardiff%';

-- Del Mar
UPDATE beaches SET
  description = 'Beachbreak near 15th Street and the river mouth with peaks that work best on SSW/WNW combo swells. Mid tide provides the best shape. When the river is flowing, peaks can get rippy. The river mouth creates a strong rip that can be turbo on big tide swings. Parking via meters and neighborhood streets.',
  features = ARRAY['Beachbreak', 'River mouth', 'Sandy bottom', 'Multiple peaks', 'Consistent'],
  parking_tips = '15th St meters + neighborhood shuffle',
  wave_tips = 'Best on SSW/WNW combo; mid tide for shape',
  crowd_tips = 'Peaks get rippy when the river''s flowing',
  warnings = ARRAY['River mouth rip can be turbo on big tide swings'],
  best_conditions_prose = 'SSW/WNW combo swells, mid tide',
  crowd_level = 'moderate',
  best_months = ARRAY[8, 9, 10, 11, 12, 1, 2]
WHERE name ILIKE '%Del Mar%';

-- Oceanside Pier
UPDATE beaches SET
  description = 'Peaky and punchy beachbreak that loves offshore Santa Ana mornings. The pier creates competitive packs directly underneath, but there''s plenty of room north and south. Meters and lots available for parking - arrive early for civilized vibes, afternoons get hectic. Watch positioning around pier pilings and sneaker sets.',
  features = ARRAY['Pier break', 'Peaky waves', 'Parking lots', 'Lifeguard on duty', 'Year-round surf', 'Plenty of peaks'],
  parking_tips = 'Meters + lots; early is civilized, afternoons aren''t',
  wave_tips = 'Peaky and punchy; loves offshore Santa Ana mornings',
  crowd_tips = 'Competitive pack under the pier; plenty of room north/south',
  warnings = ARRAY['Pier pilings + sneaker sets—mind positioning'],
  best_conditions_prose = 'Offshore Santa Ana mornings, peaky and punchy',
  crowd_level = 'heavy',
  best_months = ARRAY[8, 9, 10, 11, 12, 1, 2, 3]
WHERE name ILIKE '%Oceanside%' AND name ILIKE '%Pier%';

-- Lower Trestles
UPDATE beaches SET
  description = 'World-class high-performance wave producing perfect A-frames on long-period SSW swells. Requires 10-15 minute walk or bike (pack water, light leash). Wind sensitive - dawn patrol or evening glass-off are prime times. Alpha crowd with rotations - sit patient and pick the runners carefully. Worth every step of the walk.',
  features = ARRAY['World-class', 'High-performance', 'A-frame peaks', 'Walk/bike access', 'Consistent', 'Advanced spot'],
  access_tips = '10–15 min walk/bike; pack water, light leash',
  wave_tips = 'High-performance A-frames; best on long-period SSW. Wind sensitive—dawn patrol or late glass-off',
  crowd_tips = 'Alpha crowd; sit patient and pick the runners',
  best_conditions_prose = 'Long-period SSW swell, dawn patrol or evening glass-off',
  local_etiquette = 'Alpha crowd, wait your turn and pick your waves carefully',
  crowd_level = 'very_heavy',
  best_months = ARRAY[5, 6, 7, 8, 9, 10]
WHERE name ILIKE '%Trestles%' OR name ILIKE '%Lower T%';

-- Sunset Cliffs
UPDATE beaches SET
  description = 'Collection of reef breaks accessed via stairs and trails. Needs W/WNW energy to light up properly. Mid tide provides the best reef shape. Shallow rock and sea caves mean you need to check your exit before paddling out - don''t get pinned on high tide. Respect locals and small takeoff zones. Advanced surfers only.',
  features = ARRAY['Reef breaks', 'Multiple spots', 'Scenic', 'Trail access', 'Advanced only', 'Strong etiquette'],
  access_tips = 'Access via stairs/trails; check your exit before paddling',
  wave_tips = 'Needs W/WNW energy; mid tide for reef shape',
  crowd_tips = 'Respect locals, small takeoff zones',
  warnings = ARRAY['Shallow rock + sea caves—don''t get pinned on high tide'],
  best_conditions_prose = 'W/WNW swell, mid tide for reef shape',
  local_etiquette = 'Respect locals, small takeoff zones',
  crowd_level = 'moderate',
  best_months = ARRAY[10, 11, 12, 1, 2, 3, 4]
WHERE name ILIKE '%Sunset Cliff%';

-- Mission Beach
UPDATE beaches SET
  description = 'Beachbreak at South Mission with a jetty that creates wedging waves. Big parking lot fills with volleyball crowds mid-day. Mid tide steadies the wave shape. Onshores wreck afternoons so go early for best conditions. The jetty rip runs hard on overhead pulses - keep eyes on the current.',
  features = ARRAY['Beachbreak', 'Jetty wedges', 'Parking lot', 'Lifeguard on duty', 'Sandy bottom', 'Tourist area'],
  parking_tips = 'Big lot at South Mission; volleyball crowds mid-day',
  wave_tips = 'Jetty wedges; mid tide steadies the shape. Onshores wreck afternoons—go early',
  crowd_tips = 'Heavy tourist crowds, especially mid-day',
  warnings = ARRAY['Jetty rip runs hard on overhead pulses'],
  best_conditions_prose = 'Mid tide, early morning before onshores, jetty creates wedges',
  crowd_level = 'heavy',
  best_months = ARRAY[8, 9, 10, 11, 12, 1, 2, 3]
WHERE name ILIKE '%Mission Beach%';

-- Tamarack
UPDATE beaches SET
  description = 'Family-friendly beachbreak in Carlsbad with jetty assistance creating reliable banks. Mid tide is money for shape. PCH shoulder parking turns over consistently. Family beach means swimmers - watch lifeguard flags and guarded zones. Jetty rip activates on bigger sets, keep an eye on downcoast drift.',
  features = ARRAY['Beachbreak', 'Jetty breaks', 'Family friendly', 'Beginner friendly', 'Lifeguard on duty', 'Consistent'],
  parking_tips = 'PCH shoulder parking; turns over consistently',
  wave_tips = 'Beachbreak with jetty help; mid tide is money',
  crowd_tips = 'Family beach = swimmers; watch flags + guarded zones',
  warnings = ARRAY['Jetty rip on bigger sets; keep an eye downcoast drift'],
  best_conditions_prose = 'Mid tide, jetty creates banks',
  crowd_level = 'moderate',
  best_months = ARRAY[8, 9, 10, 11, 12, 1, 2, 3]
WHERE name ILIKE '%Tamarack%';

