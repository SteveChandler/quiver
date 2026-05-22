BEGIN;

CREATE TEMP TABLE temp_socal_sandy_beginner_profiles (
  canonical_name text PRIMARY KEY,
  aliases text[] NOT NULL,
  slug text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'CA',
  country text NOT NULL DEFAULT 'USA',
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  lat double precision,
  lon double precision,
  region text NOT NULL DEFAULT 'Orange County',
  coverage_action text NOT NULL,
  beginner_fit text NOT NULL,
  break_type text NOT NULL,
  bottom_type text NOT NULL,
  skill_level text NOT NULL,
  features text[] NOT NULL,
  hazards text[] NOT NULL,
  preferred_tide_ft_min numeric,
  preferred_tide_ft_max numeric,
  preferred_tide_direction text,
  max_wind_any_mph integer,
  max_wind_onshore_mph integer,
  best_conditions_prose text NOT NULL,
  wave_tips text NOT NULL,
  parking_tips text NOT NULL,
  access_tips text NOT NULL,
  crowd_tips text NOT NULL,
  warnings text[] NOT NULL,
  local_etiquette text NOT NULL,
  real_takeaways text[] NOT NULL,
  beginner_window jsonb NOT NULL,
  source_urls text[] NOT NULL,
  insert_if_missing boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

INSERT INTO temp_socal_sandy_beginner_profiles (
  canonical_name,
  aliases,
  slug,
  city,
  lat,
  lon,
  region,
  coverage_action,
  beginner_fit,
  break_type,
  bottom_type,
  skill_level,
  features,
  hazards,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  preferred_tide_direction,
  max_wind_any_mph,
  max_wind_onshore_mph,
  best_conditions_prose,
  wave_tips,
  parking_tips,
  access_tips,
  crowd_tips,
  warnings,
  local_etiquette,
  real_takeaways,
  beginner_window,
  source_urls,
  insert_if_missing
) VALUES
  (
    'Blackies',
      ARRAY['Blackie''s Beach', 'Blackies Beach', 'Newport Pier northside', 'Newport Pier north side', 'Newport Municipal Beach northside']::text[],
    'blackies',
    'Newport Beach',
    33.60905,
    -117.93205,
    'Orange County',
    'add',
    'primary',
    'beach',
    'sand',
    'beginner-intermediate',
    ARRAY['sand bottom', 'beginner sandy beachbreak', 'longboard friendly', 'Newport Pier northside', 'surf-school presence', 'wide sandy beach']::text[],
    ARRAY['crowds', 'rip currents', 'summer blackball or crowd-management restrictions near the pier', 'pier-adjacent traffic', 'stingrays', 'shorebreak on bigger days']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
      'Blackies is the clearest missing North OC add: a Newport Pier northside sandy beachbreak and longboard zone that works for learners on genuinely small, clean mornings.',
      'Treat Blackies as a beginner and longboard beachbreak only when it is small. Avoid tiny high-tide sessions, summer restrictions, crowded pier traffic, or any punchy inside setup.',
      'Use nearby Newport Pier city lots, meters, or on-street spaces and arrive early because peninsula parking fills quickly.',
    'Public beach access is from the Newport Pier and boardwalk area; keep learners north of the main pier traffic.',
      'Go early. The longboard crowd and lesson traffic build quickly once the pier zone wakes up.',
      ARRAY['Avoid crowding the pier takeoff', 'Watch posted blackball and beach restrictions', 'Bigger south or west swell can make the inside punchy', 'Shuffle for stingrays in warm months']::text[],
      'Treat it like a classic longboard lineup: hold your line, do not snake, and stay clear of surf-school clusters and inside learners.',
      ARRAY['Soft whitewater and slower longboard-friendly peaks on smaller days', 'Wide sandy takeoff and landing zone', 'Easy pier-area access and parking options', 'Strong local tradition of surf instruction nearby']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2.5},"acceptable_wave_height_ft":{"min":0.5,"max":3},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Avoid tiny high-tide sessions and any crowded summer restrictions near the pier; the wave is more forgiving when there is enough shape and not too much backwash."}'::jsonb,
      ARRAY['https://www.wannasurf.com/spot/North_America/USA/California/Orange_County/blackies/', 'https://www.surfline.com/surf-report/blackies/584204204e65fad6a7709115', 'https://www.newportbeachca.gov/how-do-i-/find/beach-information', 'https://www.newportbeachca.gov/i-am-a/visitor/parking/city-parking-lots-and-metered-parking', 'https://www.newportbeachca.gov/government/departments/fire-department/marine-operations-division', 'https://www.newportbeachca.gov/government/departments/fire-department/marine-operations-division/blackball', 'https://www.endlesssunsurf.com/', 'https://wavehuggers.com/newport-beach-river-jetties/', 'https://almondsurfboards.com/blogs/news/an-ode-to-blackies', 'https://banzaisurfschool.com/learning-how-to-surf-best-beginner-surfing-areas/']::text[],
    true
  ),
  (
    'Bolsa Chica State Beach',
    ARRAY['Bolsa Chica', 'Bolsa Chica State Beach']::text[],
    'bolsa-chica',
    'Huntington Beach',
    NULL,
    NULL,
    'Orange County',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner',
    ARRAY['sand bottom', 'beginner sandy beachbreak', 'lifeguards', 'state beach parking', 'longboard friendly']::text[],
    ARRAY['crowds', 'stingrays', 'rip currents', 'afternoon wind']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Small 1-2 ft surf, light morning wind, and low-to-mid tide are the cleanest beginner filters at Bolsa Chica.',
      'Use the forgiving inside whitewater and slower outside shoulders instead of chasing the steepest peak. Low-to-mid tide is usually better than tiny high tide for actual breaking waves.',
      'Use the Bolsa Chica State Beach day-use lots along PCH; central lots around the visitor center and mid-beach towers are easiest for first-timer logistics.',
      'The state-beach map shows access ramps across the multi-use trail and parking lots strung along PCH, so access is usually straightforward.',
      'The easiest strategy is to walk a little away from the densest lesson clusters rather than surfing in the middle of them.',
      ARRAY['High tide on a tiny day may not break well', 'Afternoon sea breeze can add chop fast', 'Watch posted lifeguard and swim-zone rules', 'Lower tides with more push can sharpen channels and make some sandbars faster']::text[],
      'Stay out of organized lesson zones, do not drop into soft outside rollers someone is already trimming, and use the inside whitewater if you are still early-stage.',
      ARRAY['1-2 ft mornings can be ideal', 'Inside whitewater is dependable and forgiving', 'Outside waves can break slowly enough for longboards and progressing beginners', 'Large parking supply, ramps, restrooms, and seasonal staffed towers']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":1,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"This zone is tide sensitive. Very high tide can make tiny surf weak and inconsistent, while lower tides with more push can sharpen channels and make parts of the sandbar faster."}'::jsonb,
      ARRAY['https://www.parks.ca.gov/bolsachica/', 'https://www.parks.ca.gov/pages/642/files/Welcome%20to%20Bolsa%20Chica%20SB.pdf', 'https://www.parks.ca.gov/AccessibleFeatures/Details/642', 'https://www.surfschool.net/huntington-beach-surf-camp/', 'https://www.surfschool.net/blog/huntington-beaches-surf-spots/', 'https://www.surfschool.net/blog/best-beginner-surf-spot-california/', 'https://banzaisurfschool.com/learning-how-to-surf-best-beginner-surfing-areas/']::text[],
    false
  ),
  (
    'Huntington State Beach',
      ARRAY['Huntington State Beach', 'Huntington State Beach south', 'State Beach', 'Brookhurst', 'Magnolia']::text[],
    'huntington-state-beach',
    'Huntington Beach',
    NULL,
    NULL,
    'Orange County',
    'update',
    'conditional',
    'beach',
    'sand',
    'beginner-intermediate',
    ARRAY['sand bottom', 'beginner sandy beachbreak', 'lifeguards', 'state beach parking', 'whitewater practice']::text[],
    ARRAY['shorebreak', 'rip currents', 'stingrays', 'afternoon wind']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
      'Huntington State Beach has strong official logistics and a wide sandy platform, but beginner use should be framed as small-day whitewater and inside reforms.',
      'Use Huntington State Beach for whitewater and inside reforms on soft mornings. As tide and swell energy increase, the beachbreak gets steeper and less forgiving.',
      'Choose your lot by cross street; the official maps show Beach, Newland, Magnolia, and Brookhurst serving the state beach lots.',
      'Use the marked ramps and multi-use trail crossings rather than cutting across traffic lanes or berms.',
      'If routing beginners here, keep them away from established outside peaks and use open whitewater or reform zones.',
      ARRAY['Steeper shorebreak on the wrong tide', 'Wind can turn it choppy by late morning', 'Observe lifeguard flags and seasonal zones', 'Bird-preserve sensitivity at the far north extension']::text[],
      'Do not set beginners on the main peak if shortboarders are already using it. Stay inside and out of the way until conditions are clearly soft.',
      ARRAY['Lots of room to spread out', 'Good official access and parking infrastructure', 'Sandy bottom', 'Works for whitewater practice on small mornings']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"conditional","ideal_wave_height_ft":{"min":0.5,"max":1.5},"acceptable_wave_height_ft":{"min":0.5,"max":2},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Beginner use here is best framed as small-day inside reforms and whitewater. As tide and swell energy increase, the beachbreak gets steeper and less forgiving."}'::jsonb,
      ARRAY['https://www.parks.ca.gov/huntington', 'https://www.parks.ca.gov/pages/643/files/Welcome%20to%20Huntington%20SB.pdf', 'https://www.parks.ca.gov/pages/643/files/HuntingtonSBFinalWebMap072312.pdf', 'https://www.surfschool.net/private-surf-lessons/', 'https://www.surfcityusa.com/things-to-do/surfing/surfing-lessons/', 'https://www.surfline.com/surf-report/huntington-state-beach/584204204e65fad6a770998c/spot-guide']::text[],
    false
  ),
  (
      'Goldenwest',
      ARRAY['Goldenwest Street', 'North HB Streets', '17th Street', '20th Street', 'Huntington Streets']::text[],
      'goldenwest',
    'Huntington Beach',
    NULL,
    NULL,
    'Orange County',
    'update',
    'conditional',
    'beach',
    'sand',
    'beginner-intermediate',
    ARRAY['sand bottom', 'sandy beachbreak', 'Goldenwest naming', 'north Huntington streets', 'spread-out street peaks', 'blufftop parking']::text[],
    ARRAY['rip currents', 'shorebreak', 'crowds', 'afternoon wind', 'coastal bluff/path erosion between Goldenwest and Seapoint']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
      'Goldenwest is a public-taxonomy update for the North HB Streets cluster. It is workable for beginners only on genuinely small, clean mornings with room away from the main peaks.',
      'Do not sell Goldenwest broadly as a beginner wave when there is punchy size, street-to-street crowd pressure, or active bluff/path issues.',
      'Use the city blufftop day-use parking between Goldenwest and Seapoint; metered and neighborhood parking can also be part of the routine depending on entry.',
      'Primary public access is from the Goldenwest/Seapoint blufftop corridor via stairs or ramps down to the beach.',
      'Pick the least-concentrated street peak. If it starts surfing like a mini-pier, it stops being a beginner recommendation.',
      ARRAY['Not a default beginner spot', 'Beachbreak can get punchy quickly', 'Crowds and drift matter on cleaner days', 'Check current bluff/path access conditions']::text[],
      'This zone functions as a cluster of street peaks. Spread out, avoid the best-looking peak while learning, and yield to surfers already positioned.',
      ARRAY['Spread-out sandy peaks when the surf is small', 'Usually less iconic pressure than the pier', 'Straightforward blufftop access', 'Can be friendly for longboards on soft mornings']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"conditional","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Do not sell this broadly as a beginner wave when there is punchy size, a lot of street-to-street crowd pressure, or active bluff/path issues."}'::jsonb,
      ARRAY['https://www.huntingtonbeachca.gov/departments/fire/marine_safety.php', 'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/parking_camping.php', 'https://huntingtonbeachca.gov/news_detail_T4_R83.php', 'https://www.surfline.com/surf-report/north-hb-streets/5842041f4e65fad6a77088ea', 'https://teachme.to/venues/surfing/goldenwest', 'https://www.surf-escape.com/surfing-in-california/']::text[],
    false
  ),
  (
    'Huntington Beach Pier Northside',
    ARRAY['HB Pier Northside', 'Huntington Pier Northside']::text[],
    'huntington-beach-pier-northside',
    'Huntington Beach',
    NULL,
    NULL,
    'Orange County',
    'update',
    'conditional',
    'beach',
    'sand',
    'intermediate',
    ARRAY['sand bottom', 'pier break', 'inside reforms on small days']::text[],
      ARRAY['pier pilings', 'crowds', 'blackball restrictions when posted', 'rip currents', 'sweeping sets on bigger swells']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Beginner use should be limited to tiny clean inside reforms away from the main pier peak.',
      'Keep the public copy honest: the pier is a Huntington icon, not the first beginner recommendation. Inside reforms can work on tiny low-wind mornings only.',
    'Downtown and pier parking fill quickly; beginners should avoid carrying boards through peak crowd hours.',
    'Stay well clear of pier pilings and the main rotation.',
    'This is one of the busiest Huntington surf zones. Beginners should choose Bolsa or a quieter sandbar first.',
      ARRAY['Pier pilings', 'Crowded lineup', 'Blackball restrictions when posted', 'Not a primary beginner recommendation']::text[],
      'Watch the blackball signs, respect the main peak, and treat the inside reform as a separate beginner lane rather than entitlement to the outside takeoff.',
      ARRAY['Inside reforms can be softer than the headline pier image suggests', 'Very easy access and lifeguard presence', 'Useful for pop-up practice on tiny days', 'Wide sand and quick exits back to shore']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"conditional","ideal_wave_height_ft":{"min":0.5,"max":1.5},"acceptable_wave_height_ft":{"min":0.5,"max":2},"preferred_tide_stage":["low","rising"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"If beginners use this at all, keep it to tiny, low-tide or rising-tide inside reforms. Once tide and size rise, the inside gets dumpier and the crowd pressure matters more."}'::jsonb,
      ARRAY['https://www.huntingtonbeachca.gov/departments/fire/marine_safety.php', 'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/index.php', 'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/parking_camping.php', 'https://wavehuggers.com/huntington-beach/', 'https://www.reddit.com/r/surfing/comments/ps0lbi/surfing_in_huntington_beach_and_orange_county/', 'https://www.surfline.com/surf-report/huntington-beach-pier-northside/5842041f4e65fad6a7708827']::text[],
    false
  ),
  (
    'Huntington Beach Pier Southside',
    ARRAY['HB Pier Southside', 'Huntington Pier Southside']::text[],
    'huntington-beach-pier-southside',
    'Huntington Beach',
    NULL,
    NULL,
    'Orange County',
    'update',
    'conditional',
    'beach',
    'sand',
    'intermediate',
    ARRAY['sand bottom', 'pier break', 'inside reforms on small days']::text[],
      ARRAY['pier pilings', 'performance crowd', 'blackball restrictions when posted', 'larger and more powerful pier-zone surf', 'rip currents']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Beginner use should be limited to tiny clean inside reforms away from the main pier peak.',
      'Keep the southside framed as conditional. If it is bigger, windy, crowded, or breaking near the pier, send learners elsewhere.',
      'The most direct public parking option is the south-beach municipal lot system with entrances at First Street, Huntington Street, and Beach Boulevard.',
      'Use the south-beach access points and keep beginners well away from the main southside takeoff.',
    'This is one of the busiest Huntington surf zones. Beginners should choose Bolsa or a quieter sandbar first.',
      ARRAY['Pier pilings', 'Crowded lineup', 'Blackball restrictions when posted', 'Not a primary beginner recommendation']::text[],
      'Southside is not a learner entitlement zone. If using the inside reform, stay clearly separate from the main peak and surfers driving down the line from outside.',
      ARRAY['Can offer soft inside foam and reforms on the very smallest mornings', 'Good city-beach logistics', 'Quick paddle-in and reset']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"conditional","ideal_wave_height_ft":{"min":0.5,"max":1.5},"acceptable_wave_height_ft":{"min":0.5,"max":2},"preferred_tide_stage":["low","rising"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Do not promote this broadly to beginners. Any workable learner use is restricted to tiny, clean inside reforms, not the main southside program."}'::jsonb,
      ARRAY['https://www.huntingtonbeachca.gov/departments/fire/marine_safety.php', 'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/index.php', 'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/parking_camping.php', 'https://www.surfcityusa.com/things-to-do/surfing/', 'https://www.reddit.com/r/surfing/comments/ps0lbi/surfing_in_huntington_beach_and_orange_county/', 'https://www.surfline.com/surf-report/huntington-beach-pier-southside/5842041f4e65fad6a77088ed/spot-guide']::text[],
    false
  ),
    (
      'Newland St.',
      ARRAY['Newland Street', 'Huntington State Beach Newland']::text[],
      'newland-st',
      'Huntington Beach',
      NULL,
      NULL,
      'Orange County',
      'exclude_from_beginner',
      'no',
      'beach',
      'sand',
    'intermediate',
    ARRAY['sand bottom', 'state-beach access', 'named local peak near Newland access']::text[],
    ARRAY['rips', 'fast closeouts', 'busy peak behavior']::text[],
    NULL,
    NULL,
      NULL,
      10,
      10,
      'Newland is a real local spot label with state-beach access, but public evidence is not strong enough to promote it as a beginner recommendation.',
      'Keep Newland out of public beginner lists. If learners use it at all, limit that to tiny, coached, uncrowded whitewater rather than the named peak.',
      'Use Huntington State Beach day-use parking at the Newland side of the park and the nearest legal state-beach lots.',
      'Access is via Huntington State Beach near Newland Boulevard, then across the multi-use trail and down the beach ramps.',
      'Do not route beginners here when Bolsa Chica or Blackies are working. If the peak is busy, the beginner case gets worse, not better.',
      ARRAY['Not a public beginner recommendation', 'Rips', 'Fast closeouts', 'Busy peak behavior']::text[],
      'Treat it as a standard intermediate street/state-beach peak and stay off the main takeoff if you are still learning.',
      ARRAY['Sandy bottom', 'State-beach parking and access', 'Can have whitewater on tiny days']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"no","ideal_wave_height_ft":{"min":0.5,"max":1.5},"acceptable_wave_height_ft":{"min":0.5,"max":2},"preferred_tide_stage":["low","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Public guidance is too thin to recommend this as a beginner zone; the better-supported local descriptions say the peak is often fast and can close out."}'::jsonb,
      ARRAY['https://www.parks.ca.gov/huntington', 'https://www.parks.ca.gov/pages/643/files/Welcome%20to%20Huntington%20SB.pdf', 'https://www.parks.ca.gov/pages/643/files/HuntingtonSBFinalWebMap072312.pdf', 'https://surfing-waves.com/atlas/north_america/usa/west_coast/california/southern_california/orange_county/spot/newland_st.html', 'https://www.reddit.com/r/orangecounty/comments/1lz9nap/learner_surf_spots/', 'https://teachme.to/v/newland-st']::text[],
      false
    ),
    (
      'Huntington St.',
      ARRAY['Huntington Street', 'HB South Beach Huntington St.']::text[],
      'huntington-st',
      'Huntington Beach',
      NULL,
      NULL,
      'Orange County',
      'exclude_from_beginner',
      'no',
      'beach',
      'sand',
    'intermediate',
    ARRAY['sand bottom', 'south-beach parking access', 'named city-beach peak']::text[],
    ARRAY['crowds', 'rip currents', 'faster beachbreak behavior than a true beginner spot']::text[],
    NULL,
    NULL,
      NULL,
      10,
      10,
      'Public evidence is too thin to recommend Huntington St. to beginners; keep it out of public beginner coverage.',
      'If it ever works for novice foam-riding, that is a tiny-day exception rather than a listable beginner pattern.',
      'Use the municipal south-beach lot entrances, including the Huntington Street entry.',
      'Access from the Huntington Street side of the municipal lot is straightforward, but convenience alone does not make this a beginner recommendation.',
      'If choosing between this and Bolsa, Blackies, or soft Seal Beach options, route beginners elsewhere.',
      ARRAY['Not a public beginner recommendation', 'Crowds', 'Rip currents', 'Faster beachbreak behavior than a true beginner spot']::text[],
      'Treat this as a standard intermediate Huntington peak and stay off the main takeoff if you are still learning.',
      ARRAY['Convenient city parking', 'Sand bottom']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"no","ideal_wave_height_ft":{"min":0.5,"max":1},"acceptable_wave_height_ft":{"min":0.5,"max":1.5},"preferred_tide_stage":["low","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Public evidence is too thin to recommend Huntington St. to beginners. If it ever works for novice foam-riding, that is a tiny-day exception rather than a listable beginner pattern."}'::jsonb,
      ARRAY['https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/parking_camping.php', 'https://www.huntingtonbeachca.gov/departments/transportation/parking/beach_and_camping_parking.php', 'https://www.huntingtonbeachca.gov/departments/fire/marine_safety.php', 'https://www.surfline.com/surf-report/huntington-st-/58bdebbc82d034001252e3d2', 'https://www.reddit.com/r/orangecounty/comments/1lz9nap/learner_surf_spots/']::text[],
      false
    ),
    (
      'HB Cliffs',
      ARRAY['HB Cliffs', 'Huntington Beach Cliffs', 'Huntington Cliffs', 'Seapoint', 'Dog Beach cliffs']::text[],
    'hb-cliffs',
    'Huntington Beach',
    NULL,
    NULL,
    'Orange County',
    'exclude_from_beginner',
    'no',
    'beach',
    'sand',
    'intermediate',
      ARRAY['sand bottom', 'exposed beachbreak', 'not primary beginner', 'blufftop parking', 'dog beach adjacency']::text[],
      ARRAY['rip currents', 'shorebreak', 'crowds of more experienced surfers', 'faster waves than Bolsa Chica', 'coastal bluff/path erosion', 'dog-beach traffic near Seapoint']::text[],
      NULL,
      NULL,
      NULL,
      10,
      10,
      'HB Cliffs should generally be excluded from beginner recommendation layers; the best-supported public beginner comments are cautionary.',
      'Do not use the sandy beginner alert override here unless a future research pass reclassifies a specific protected learner zone.',
      'Use the blufftop lot between Goldenwest and Seapoint or the Dog Beach lot at Seapoint depending on the exact access point.',
      'Check current path conditions because the city documented bluff-related path narrowing in this corridor.',
      'Do not send true beginners into the main surfing peak here. If someone is only standing in whitewater, keep them well away from the established lineup.',
      ARRAY['Not a beginner recommendation', 'More exposed than Bolsa', 'Beachbreak can get serious quickly', 'Coastal bluff/path access can change']::text[],
      'The cliffs are not a default learner zone. Stay out of the way of regulars and off the main takeoff area.',
      ARRAY['Possible whitewater practice on tiny days', 'Convenient blufftop parking']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"no","ideal_wave_height_ft":{"min":0.5,"max":1},"acceptable_wave_height_ft":{"min":0.5,"max":1.5},"preferred_tide_stage":["low","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"This zone should not be recommended as a beginner surf spot. At most, tiny-day whitewater practice may be possible, but public beginner sources more often caution against the cliffs area than endorse it."}'::jsonb,
      ARRAY['https://www.huntingtonbeachca.gov/departments/fire/marine_safety.php', 'https://www.huntingtonbeachca.gov/departments/parks_recreation/beach_information/parking_camping.php', 'https://huntingtonbeachca.gov/news_detail_T4_R83.php', 'https://banzaisurfschool.com/learning-how-to-surf-best-beginner-surfing-areas/', 'https://www.surfschool.net/blog/huntington-beaches-surf-spots/', 'https://www.reddit.com/r/huntingtonbeach/comments/1kz7zpf/looking_for_newbie_spots_and_friends_to_surf_with/', 'https://www.surfline.com/surf-report/hb-cliffs/640a3f7c606c45fdf1b09880/spot-guide']::text[],
    false
  ),
  (
    'Seal Beach Pier',
      ARRAY['Seal Beach', 'Seal Beach Pier', 'Seal Beach Pier Northside', 'Pier Northside', 'Seal Beach Northside']::text[],
    'seal-beach-pier-seal-beach-ca',
    'Seal Beach',
    NULL,
    NULL,
    'Orange County',
    'update',
    'conditional',
    'beach',
    'sand',
    'beginner-intermediate',
      ARRAY['sand bottom', 'pier break', 'small-day alternate', 'lifeguards', 'gentler northside waves', 'marine-safety staffing']::text[],
      ARRAY['pier pilings', 'river currents', 'rip currents', 'fishing lines/hooks', 'water-quality concerns after rain', 'northside longboard crowding on good small days']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
      'Seal Beach Pier is a credible softer alternate, especially on the north side of the pier on small clean days, but the cautions should stay visible.',
      'Use Seal Beach as a small-day northside fallback when the inside is soft, uncrowded, and away from the pier structure, fishing activity, river current, and post-rain runoff.',
      'Best public beach-lot options are the 1st Street, 8th Street, and 10th Street lots; Main Street lots are another option but have time limits and paid-hour enforcement.',
      'The 8th Street area is especially practical because Marine Safety headquarters is located in that beach-lot zone.',
      'Northside is the friendlier beginner side, but it can still get packed with longboards on clean small days.',
      ARRAY['Pier pilings', 'River current', 'Rip currents', 'Fishing lines/hooks', 'Observe lifeguard flags', 'Avoid post-rain water-quality windows']::text[],
      'Stay clear of fishing zones, give the northside longboard line room, and if current or rain runoff is a concern, leave it for another day.',
      ARRAY['Small, gentle northside waves on many days', 'Sandy shore and family-friendly vibe', 'Less intense than a full-power Huntington pier session', 'Good public parking and clear marine-safety presence']::text[],
      '{"model":"socal_sandy_beginner","beginner_fit":"conditional","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Best treated as a small-day northside option. Avoid post-rain sessions, be careful around the pier and fishing activity, and do not oversell it when the current or tide looks sketchy."}'::jsonb,
      ARRAY['https://www.sealbeachca.gov/Departments/Marine-Safety-Lifeguards', 'https://www.sealbeachca.gov/Departments/Marine-Safety-Lifeguards/Rip-Currents', 'https://www.sealbeachca.gov/Departments/Marine-Safety-Lifeguards/Water-Quality', 'https://www.sealbeachca.gov/Departments/Marine-Safety-Lifeguards/Beach-Rules', 'https://www.sealbeachca.gov/Departments/Parking/Beach-Lot-Parking', 'https://www.sealbeachca.gov/Departments/Parking/Main-Street-Parking', 'https://wavehuggers.com/seal-beach/', 'https://www.surfline.com/travel/united-states/california/orange-county/seal-beach-surfing-and-beaches/5394086']::text[],
    false
  ),
  (
    'Doheny State Beach',
    ARRAY['Doheny Beach', 'Doheny', 'Doheny State Beach']::text[],
    'doheny-state-beach',
    'Dana Point',
    NULL,
    NULL,
    'Orange County',
    'update',
    'primary',
    'beach',
    'sand and cobble',
    'beginner',
    ARRAY['soft rolling waves', 'beginner lessons', 'state beach access', 'longboard friendly', 'inside whitewater']::text[],
    ARRAY['crowds', 'rocks or cobble in places', 'stingrays', 'water quality after rain', 'stronger south swell sets']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Doheny is the clearest South OC beginner profile: slow rolling waves, state-beach logistics, and a long lesson tradition when the surf is small.',
    'Keep beginners on the soft inside and avoid bigger south-swell days or crowded outside lanes.',
    'Use Doheny State Beach day-use parking and arrive early on weekends.',
    'Use official state-beach access and keep learners in the supervised, open sandy sections.',
    'Crowd pressure is the main limitation; if the inside is packed, wait or move rather than forcing it.',
    ARRAY['Crowds', 'Rocks or cobble in places', 'Avoid post-rain water-quality windows', 'Bigger south swell can overpower beginners']::text[],
    'Share the soft inside, yield to surfers already trimming, and keep lessons out of the main outside rotation.',
    ARRAY['Soft rolling inside waves', 'Well-known lesson zone', 'State-beach parking and facilities', 'Good longboard progression on small days']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":3},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Favor low-to-mid tide and small clean surf; avoid bigger south-swell energy and crowded outside lanes."}'::jsonb,
    ARRAY['https://www.parks.ca.gov/?page_id=645', 'https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[],
    false
  ),
  (
    'Old Man''s (SanO)',
    ARRAY['Old Man''s', 'Old Mans', 'San Onofre Old Man''s', 'San Onofre State Beach']::text[],
    'old-mans-sano',
    'San Clemente',
    NULL,
    NULL,
    'Orange County',
    'update',
    'primary',
    'point',
    'sand and cobble',
    'beginner-intermediate',
    ARRAY['soft rolling waves', 'longboard friendly', 'classic progression wave', 'state beach access']::text[],
    ARRAY['rocks or cobble', 'crowds', 'long paddle or walk logistics', 'larger south swell']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Old Man''s is source-backed as a beginner and longboard progression wave, but the model should still require small clean surf and room in the lineup.',
    'Use Old Man''s for rolling waves and controlled longboard practice, not bigger south-swell days.',
    'San Onofre parking is limited and the walk/carry is part of the session planning.',
    'Use official San Onofre State Beach access and watch the lineup before paddling out.',
    'The wave is mellow, but the crowd is real. Beginners should stay away from the main takeoff until they can steer.',
    ARRAY['Rocks or cobble', 'Crowds', 'Long access logistics', 'Bigger south swell changes the risk profile']::text[],
    'Wait your turn, use a controlled board, and keep learners clear of the main peak rotation.',
    ARRAY['Soft rolling longboard waves', 'Classic progression setting', 'State-beach setting', 'Better margin than faster beachbreaks on small days']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2.5},"acceptable_wave_height_ft":{"min":0.5,"max":3},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Favor small clean rolling surf with enough tide for forgiving takeoffs; do not promote bigger south-swell days to beginners."}'::jsonb,
    ARRAY['https://www.parks.ca.gov/?page_id=647', 'https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[],
    false
  ),
  (
    'La Jolla Shores',
    ARRAY['La Jolla Shores Beach', 'Shores']::text[],
    'la-jolla-shores',
    'La Jolla',
    NULL,
    NULL,
    'San Diego',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner',
    ARRAY['sand bottom', 'beginner lessons', 'wide beach', 'soft inside whitewater', 'lifeguards']::text[],
    ARRAY['crowds', 'stingrays', 'rip currents', 'shorebreak on bigger days', 'lesson traffic']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'La Jolla Shores is the primary San Diego sandy beginner profile when the surf is small, clean, and not overloaded with lessons.',
    'Use the whitewater and soft inside bars; avoid larger surf, strong drift, or punchy shorebreak.',
    'Main beach lots and street parking fill early, especially in warm months.',
    'Use official beach access around Kellogg Park and watch posted lifeguard guidance.',
    'Lesson density can be high. Choose open space before choosing the most obvious peak.',
    ARRAY['Crowds', 'Stingrays', 'Rip currents', 'Bigger surf can create shorebreak']::text[],
    'Stay clear of lesson groups, communicate early, and keep beginner boards under control in the inside.',
    ARRAY['Wide sand-bottom learner area', 'Reliable whitewater reps', 'Strong lesson ecosystem', 'Clear public beach access']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":3},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Small clean mornings are the beginner window; avoid larger surf, strong drift, and punchy shorebreak."}'::jsonb,
    ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[],
    false
  ),
  (
    'Tourmaline Beach',
    ARRAY['Tourmaline', 'Tourmaline Surf Park', 'Tourmaline Beach']::text[],
    'tourmaline',
    'San Diego',
    NULL,
    NULL,
    'San Diego',
    'update',
    'primary',
    'beach',
    'sand and reef',
    'beginner-intermediate',
    ARRAY['soft rolling waves', 'longboard friendly', 'progression wave', 'parking lot access']::text[],
    ARRAY['crowds', 'mixed craft', 'rocks or reef patches', 'stingrays', 'wind texture']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Tourmaline is a strong progression and longboard profile, with beginner use limited to small soft windows and controlled boards.',
    'Choose Tourmaline for soft rolling waves, not crowded bigger sets or windy texture.',
    'The main lot is convenient but fills early; parking scarcity is part of the call.',
    'Use the official access from the Tourmaline lot and avoid rocks or reefy edges.',
    'Mixed craft and longboard traffic mean learners need spacing and board control.',
    ARRAY['Crowds', 'Mixed craft', 'Rocks or reef patches', 'Wind texture']::text[],
    'Yield to the established longboard rotation and keep early learners on the inside shoulder or whitewater.',
    ARRAY['Soft rolling waves on small days', 'Longboard-friendly pace', 'Clear public access', 'Useful backup when La Jolla Shores is packed']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Promote only small, soft, clean windows; the crowd and mixed-craft lineup can make marginal days a poor beginner call."}'::jsonb,
    ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[],
    false
  ),
  (
    'Santa Monica Beach',
    ARRAY['Santa Monica', 'Santa Monica State Beach']::text[],
    'santa-monica-beach-santa-monica-ca',
    'Santa Monica',
    NULL,
    NULL,
    'Los Angeles',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner',
    ARRAY['sand bottom', 'wide beach', 'surf-school presence', 'soft whitewater']::text[],
    ARRAY['crowds', 'shorebreak', 'rip currents', 'water quality after rain', 'wind']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Santa Monica is a source-backed LA beginner beach on small, clean mornings, with the usual caveat that crowds and shorebreak change the call.',
    'Keep learners in soft whitewater and avoid bigger, steeper inside sections.',
    'Use official beach lots or nearby paid parking and expect summer congestion.',
    'Use marked beach access and stay clear of crowded pier-adjacent lanes.',
    'Space matters more than fame; pick an open sandbar over the busiest zone.',
    ARRAY['Crowds', 'Shorebreak', 'Rip currents', 'Avoid post-rain water-quality windows']::text[],
    'Respect lesson zones and do not paddle beginners into tight pier or main-peak traffic.',
    ARRAY['Wide sand-bottom beach', 'Soft whitewater on small mornings', 'Surf-school ecosystem', 'Easy public access']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Small clean low-to-mid tide mornings only; avoid post-rain water, crowd compression, and punchy shorebreak."}'::jsonb,
    ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[],
    false
  ),
  (
    'Venice Beach',
    ARRAY['Venice', 'Venice Beach']::text[],
    'venice-beach-venice-ca',
    'Venice',
    NULL,
    NULL,
    'Los Angeles',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner-intermediate',
    ARRAY['sand bottom', 'wide beach', 'small-day whitewater', 'urban beach access']::text[],
    ARRAY['crowds', 'shorebreak', 'rip currents', 'wind', 'water quality after rain']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Venice can be a beginner sandy option when it is small and clean, but it is not a blanket recommendation on fast or crowded beachbreak days.',
    'Use Venice only when the inside is soft and organized enough for whitewater practice.',
    'Parking and beach traffic are heavy; plan around official lots and early arrival.',
    'Use public beach paths and stay away from dense swimmer or boardwalk traffic.',
    'If the peak is crowded or closing out, the beginner call is no.',
    ARRAY['Crowds', 'Shorebreak', 'Rip currents', 'Wind', 'Avoid post-rain water-quality windows']::text[],
    'Pick open whitewater and stay out of established peak traffic.',
    ARRAY['Wide sand-bottom beach', 'Can offer soft whitewater', 'Easy public beach access', 'Good backup to compare against Santa Monica and Dockweiler']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Promote only when small, clean, and soft; fast inside bars or crowd compression should suppress beginner routing."}'::jsonb,
    ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[],
    false
  ),
  (
    'Dockweiler State Beach',
    ARRAY['Dockweiler', 'Dockweiler Beach']::text[],
    'dockweiler-state-beach-playa-del-rey-ca',
    'Playa Del Rey',
    NULL,
    NULL,
    'Los Angeles',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner',
    ARRAY['sand bottom', 'wide beach', 'official beach access', 'small-day whitewater']::text[],
    ARRAY['shorebreak', 'rip currents', 'wind', 'water quality after rain', 'airport noise and beach traffic']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Dockweiler is a source-backed LA sandy beginner candidate on small clean days, helped by wide beach logistics and official access.',
    'Use soft inside whitewater only; avoid windy closeouts and heavy shorebreak.',
    'Use LA County beach lots and check posted parking rules before peak hours.',
    'Use official access points and avoid fire-pit or crowd-heavy sections when carrying boards.',
    'Choose open sand and avoid pushing beginners into the densest beach-day traffic.',
    ARRAY['Shorebreak', 'Rip currents', 'Wind', 'Avoid post-rain water-quality windows']::text[],
    'Keep learners in open whitewater and away from stronger peak traffic.',
    ARRAY['Wide sand-bottom beach', 'Official beach facilities', 'Good small-day whitewater space', 'Useful LA fallback when Santa Monica is crowded']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Small, clean, low-to-mid tide mornings only; suppress beginner routing when wind or shorebreak is up."}'::jsonb,
    ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles', 'https://beaches.lacounty.gov/dockweiler-beach/']::text[],
    false
  ),
  (
    'Will Rogers State Beach',
    ARRAY['Will Rogers', 'Will Rogers Beach']::text[],
    'will-rogers-state-beach-santa-monica-ca',
    'Santa Monica',
    NULL,
    NULL,
    'Los Angeles',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner',
    ARRAY['sand bottom', 'official beach access', 'small-day whitewater', 'gentler LA option']::text[],
    ARRAY['crowds', 'rip currents', 'shorebreak', 'water quality after rain', 'wind']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Will Rogers is a source-backed LA beginner option when the surf stays small, clean, and softer than nearby beachbreaks.',
    'Use the small soft inside and avoid bigger or windier setups.',
    'Use LA County beach lots and arrive early during busy beach seasons.',
    'Use official beach access and watch posted lifeguard guidance.',
    'It can still crowd up; route beginners to space, not to the most convenient peak.',
    ARRAY['Crowds', 'Rip currents', 'Shorebreak', 'Avoid post-rain water-quality windows']::text[],
    'Give lesson groups and existing lineups room; beginner boards need space.',
    ARRAY['Wide public beach', 'Often softer than punchier LA peaks on small days', 'Official parking and facilities', 'Good low-stress whitewater option']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Keep the beginner call to small, clean, soft mornings with manageable crowd spacing."}'::jsonb,
    ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles', 'https://beaches.lacounty.gov/will-rogers-beach/']::text[],
    false
  ),
  (
    'Torrance Beach (RAT Beach)',
    ARRAY['Torrance Beach', 'RAT Beach', 'Rat Beach']::text[],
    'torrance-beach-rat-beach-torrance-ca',
    'Torrance',
    NULL,
    NULL,
    'Los Angeles',
    'update',
    'primary',
    'beach',
    'sand',
    'beginner',
    ARRAY['sand bottom', 'South Bay beginner candidate', 'small-day whitewater', 'wide beach']::text[],
    ARRAY['shorebreak', 'rip currents', 'rocks near edges', 'crowds', 'wind']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Torrance/RAT Beach is a source-backed South Bay beginner option when the surf is small, soft, and away from rocky edges.',
    'Use open sand-bottom whitewater and avoid bigger shorebreak or rocky edges.',
    'Use Torrance beach parking and plan for the hill/stairs logistics.',
    'Access through official beach paths and keep beginners in the open sandy sections.',
    'If local crowd or shorebreak pressure builds, it stops being a beginner call.',
    ARRAY['Shorebreak', 'Rip currents', 'Rocks near edges', 'Crowds']::text[],
    'Stay out of established takeoff lanes and keep learners away from rocky boundary zones.',
    ARRAY['Open sand-bottom beginner space on small days', 'South Bay fallback from busier north LA beaches', 'Good whitewater potential', 'Public parking and beach access']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2},"acceptable_wave_height_ft":{"min":0.5,"max":2.5},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Small, soft, clean windows only; avoid rocky edges, bigger shorebreak, and crowd compression."}'::jsonb,
    ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[],
    false
  ),
  (
    'Mondos Beach',
    ARRAY['Mondos', 'Mondo''s', 'Mondos Beach']::text[],
    'mondos-beach-ventura-ca',
    'Ventura',
    NULL,
    NULL,
    'Ventura',
    'update',
    'primary',
    'point',
    'sand and cobble',
    'beginner',
    ARRAY['soft rolling waves', 'longboard friendly', 'beginner lessons', 'small-day point wave']::text[],
    ARRAY['rocks or cobble', 'crowds', 'roadside parking', 'larger west swell', 'limited facilities']::text[],
    NULL,
    NULL,
    NULL,
    10,
    10,
    'Mondos is the strongest Ventura/Santa Barbara-adjacent beginner profile: a small-day soft point with a clear learner reputation.',
    'Use Mondos only when the surf is small, soft, and not packed; bigger west swell and rocks change the risk.',
    'Roadside parking is limited and fills on good learner days.',
    'Access is straightforward from PCH pullouts, but beginners should watch footing around cobble and rocks.',
    'The easy reputation attracts crowds; choose space and patience over the most obvious takeoff.',
    ARRAY['Rocks or cobble', 'Crowds', 'Roadside parking', 'Larger west swell changes the wave']::text[],
    'Wait turns, use a controlled board, and stay clear of surfers already trimming from outside.',
    ARRAY['Soft rolling small-day wave', 'Longboard and soft-top friendly', 'Known lesson destination', 'Useful Ventura/Santa Barbara beginner anchor']::text[],
    '{"model":"socal_sandy_beginner","beginner_fit":"primary","ideal_wave_height_ft":{"min":0.5,"max":2.5},"acceptable_wave_height_ft":{"min":0.5,"max":3},"preferred_tide_stage":["low","rising","mid"],"avoid_high_tide_under_ft":2,"best_time_local":{"start":"06:00","end":"10:00"},"max_beginner_wind_mph":10,"avoid_tide_notes":"Promote only small clean soft windows; rocks, crowd, and larger west swell make it a different call."}'::jsonb,
    ARRAY['https://www.surfspots.co/spot/mondos', 'https://www.santabarbarasurfschool.com/surf-locations/']::text[],
    false
  );

CREATE TEMP TABLE temp_socal_sandy_beginner_classifications (
  slug text PRIMARY KEY,
  aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  region text NOT NULL,
  coverage_action text NOT NULL,
  beginner_fit text NOT NULL CHECK (beginner_fit IN ('primary', 'conditional', 'no')),
  beginner_window jsonb NOT NULL,
  source_urls text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO temp_socal_sandy_beginner_classifications (
  slug,
  aliases,
  region,
  coverage_action,
  beginner_fit,
  beginner_window,
  source_urls
)
SELECT
  slug,
  aliases,
  region,
  coverage_action,
  beginner_fit,
  beginner_window,
  source_urls
FROM temp_socal_sandy_beginner_profiles
ON CONFLICT (slug) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  region = EXCLUDED.region,
  coverage_action = EXCLUDED.coverage_action,
  beginner_fit = EXCLUDED.beginner_fit,
  beginner_window = EXCLUDED.beginner_window,
  source_urls = EXCLUDED.source_urls;

WITH lightweight_rows (
  slug,
  aliases,
  region,
  beginner_fit,
  coverage_action,
  source_urls,
  avoid_tide_notes
) AS (
  VALUES
    ('scripps', ARRAY['Scripps', 'Scripps Pier']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Use only small, clean, low-wind beachbreak windows; avoid pier-adjacent crowding, closeouts, and larger surf.'),
    ('mission-beach-central', ARRAY['Mission Beach (Central)', 'Mission Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; suppress beginner routing when the beachbreak is fast, windy, or drifting.'),
    ('pacific-beach', ARRAY['Pacific Beach', 'PB']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean low-wind mornings only; avoid crowded peak traffic and closeouts.'),
    ('moonlight-state-beach', ARRAY['Moonlight State Beach', 'Moonlight Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Use only small, soft, supervised whitewater windows; do not promote faster sandbar days.'),
    ('carlsbad-state-beach', ARRAY['Carlsbad State Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; avoid shorebreak, drift, and crowd pressure.'),
    ('ponto', ARRAY['Ponto']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean mornings only; avoid stronger bars, closeouts, and rips.'),
    ('del-mar', ARRAY['Del Mar']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small, soft, low-wind sandbar windows only; avoid shorebreak and current.'),
    ('d-street', ARRAY['D Street']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Use only tiny clean whitewater windows; skip faster or crowded peaks.'),
    ('grandview-beach', ARRAY['Grandview Beach', 'Grandview']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean windows only; avoid reefy or crowded edge behavior and stronger surf.'),
    ('san-elijo-state-beach', ARRAY['San Elijo State Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; avoid fast bars, reefs, and larger combo swell.'),
    ('imperial-beach', ARRAY['Imperial Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean windows only; suppress for water-quality, current, or closeout risk.'),
    ('forster-st-oceanside', ARRAY['Forster St. Oceanside', 'Forster Street Oceanside']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; avoid stronger beachbreak days.'),
    ('oceanside-pier', ARRAY['Oceanside Pier']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Tiny inside reforms only, well away from pier traffic and stronger peaks.'),
    ('hotel-del-coronado', ARRAY['Hotel Del Coronado', 'Coronado']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; avoid shorebreak, drift, and crowded swim zones.'),
    ('silver-strand-state-beach', ARRAY['Silver Strand State Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; avoid exposed closeout or strong-current setups.'),
    ('torrey-pines-state-beach', ARRAY['Torrey Pines State Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; exposed beachbreak and drift should suppress beginner routing.'),
    ('solana-beach', ARRAY['Solana Beach']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean whitewater only; avoid steep or rocky-edge sections.'),
    ('georges', ARRAY['George''s', 'Georges']::text[], 'San Diego', 'conditional', 'classify_current_candidate', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Small clean and uncrowded only; do not treat as a default learner call.'),
    ('marine-street-beach', ARRAY['Marine Street Beach']::text[], 'San Diego', 'no', 'exclude_from_beginner', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Keep Marine Street out of sandy beginner promotion; shorebreak and power make the fallback too risky.'),
    ('new-break-nubes', ARRAY['New Break (Nubes)', 'New Break', 'Nubes']::text[], 'San Diego', 'no', 'exclude_from_beginner', ARRAY['https://www.sandiegosurfrental.com/surf-spot-education']::text[], 'Keep Nubes out of sandy beginner promotion; current metadata is too weak for a learner alert override.'),
    ('middles', ARRAY['Middles']::text[], 'San Diego', 'no', 'exclude_from_beginner', ARRAY['https://www.parks.ca.gov/?page_id=647']::text[], 'Keep Middles out of sandy beginner promotion; San Onofre learner copy should point beginners toward softer Old Man''s-style windows.'),
    ('trails', ARRAY['Trails']::text[], 'San Diego', 'no', 'exclude_from_beginner', ARRAY['https://www.parks.ca.gov/?page_id=647']::text[], 'Keep Trails out of sandy beginner promotion; access and setup vary too much for a generic learner alert override.'),
    ('72nd-place-long-beach-ca', ARRAY['72nd Place']::text[], 'Los Angeles', 'primary', 'classify_current_candidate', ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[], 'Small clean sandy whitewater only; avoid wind, current, or shorebreak.'),
    ('el-porto-manhattan', ARRAY['El Porto (Manhattan)', 'El Porto']::text[], 'Los Angeles', 'conditional', 'classify_current_candidate', ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[], 'Small clean low-wind windows only; do not promote stronger South Bay beachbreak days.'),
    ('leo-carrillo-state-beach-malibu-ca', ARRAY['Leo Carrillo State Beach']::text[], 'Los Angeles', 'conditional', 'classify_current_candidate', ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[], 'Small clean and supervised only; rocks, reefs, and stronger swell should suppress beginner routing.'),
    ('zuma-beach-malibu-ca', ARRAY['Zuma Beach']::text[], 'Los Angeles', 'conditional', 'classify_current_candidate', ARRAY['https://sandermaps.com/blogs/articles/16-best-beginner-surf-spots-in-los-angeles']::text[], 'Small clean whitewater only; avoid exposed shorebreak and larger west swell.'),
    ('salt-creek', ARRAY['Salt Creek']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Salt Creek out of sandy beginner promotion; it is too punchy and crowded for fallback beginner alerts.'),
    ('strands', ARRAY['Strands']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Strands out of sandy beginner promotion; current source support is not enough for learner alerts.'),
    ('agate-street', ARRAY['Agate Street']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Agate out of sandy beginner promotion; reef and local peak behavior make fallback alerts unsafe.'),
    ('brooks-street', ARRAY['Brooks Street']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Brooks out of sandy beginner promotion; it is not a broad learner sandbar.'),
    ('thalia-street', ARRAY['Thalia Street']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Thalia out of sandy beginner promotion; local peak behavior and rocks are not a default learner setup.'),
    ('corona-del-mar', ARRAY['Corona del Mar']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Corona del Mar out of sandy beginner promotion; shorebreak and crowd risk make fallback alerts too broad.'),
    ('newport-56th-st', ARRAY['Newport 56th St', '56th Street']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.surfline.com/surf-report/blackies/584204204e65fad6a7709115']::text[], 'Keep 56th Street out of beginner promotion; Newport jetties and faster sandbars are not Blackies-style learner zones.'),
    ('newport-lower-jetties', ARRAY['Newport Lower Jetties', 'Lower Jetties']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.surfline.com/surf-report/blackies/584204204e65fad6a7709115']::text[], 'Keep Lower Jetties out of beginner promotion; jetties and current risk are not a broad learner alert fit.'),
    ('newport-upper-jetties', ARRAY['Newport Upper Jetties', 'Upper Jetties']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.surfline.com/surf-report/blackies/584204204e65fad6a7709115']::text[], 'Keep Upper Jetties out of beginner promotion; jetties and current risk are not a broad learner alert fit.'),
    ('river-jetties', ARRAY['River Jetties']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.surfline.com/surf-report/blackies/584204204e65fad6a7709115']::text[], 'Keep River Jetties out of beginner promotion; current and jetty behavior should not inherit Blackies metadata.'),
    ('crystal-cove', ARRAY['Crystal Cove']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Crystal Cove out of sandy beginner promotion; reef/rock and access complexity do not fit this alert model.'),
    ('204s', ARRAY['204s']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep 204s out of sandy beginner promotion; current source support is too weak for learner alerts.'),
    ('poche-beach', ARRAY['Poche Beach']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep Poche out of sandy beginner promotion; do not infer a broad learner alert from weak metadata.'),
    ('san-clemente-state-beach', ARRAY['San Clemente State Beach']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep San Clemente State Beach out of this sandy learner alert model; treat as a separate researched spot if needed.'),
    ('t-street', ARRAY['T-Street']::text[], 'Orange County', 'no', 'exclude_from_beginner', ARRAY['https://www.theorangecountycityguide.com/articles/best-surf-beaches-in-orange-county']::text[], 'Keep T-Street out of sandy beginner promotion; it is not a broad learner sandbar.'),
    ('refugio-state-beach-goleta-ca', ARRAY['Refugio State Beach']::text[], 'Santa Barbara', 'conditional', 'classify_current_candidate', ARRAY['https://www.santabarbarasurfschool.com/surf-locations/']::text[], 'Small clean and supervised only; do not promote stronger point or reef days to beginners.'),
    ('solimar-reef', ARRAY['Solimar Reef']::text[], 'Ventura', 'no', 'exclude_from_beginner', ARRAY['https://www.surfspots.co/spot/mondos', 'https://www.santabarbarasurfschool.com/surf-locations/']::text[], 'Keep Solimar Reef out of sandy beginner promotion; Mondos is the source-backed soft learner anchor.')
)
INSERT INTO temp_socal_sandy_beginner_classifications (
  slug,
  aliases,
  region,
  coverage_action,
  beginner_fit,
  beginner_window,
  source_urls
)
SELECT
  slug,
  aliases,
  region,
  coverage_action,
  beginner_fit,
  jsonb_build_object(
    'model', 'socal_sandy_beginner',
    'beginner_fit', beginner_fit,
    'ideal_wave_height_ft',
      CASE beginner_fit
        WHEN 'primary' THEN jsonb_build_object('min', 0.5, 'max', 2)
        ELSE jsonb_build_object('min', 0.5, 'max', 1.5)
      END,
    'acceptable_wave_height_ft',
      CASE beginner_fit
        WHEN 'primary' THEN jsonb_build_object('min', 0.5, 'max', 2.5)
        WHEN 'conditional' THEN jsonb_build_object('min', 0.5, 'max', 2)
        ELSE jsonb_build_object('min', 0.5, 'max', 1.5)
      END,
    'preferred_tide_stage', jsonb_build_array('low', 'rising', 'mid'),
    'avoid_high_tide_under_ft', 2,
    'best_time_local', jsonb_build_object('start', '06:00', 'end', '10:00'),
    'max_beginner_wind_mph', 10,
    'avoid_tide_notes', avoid_tide_notes
  ),
  source_urls
FROM lightweight_rows
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.beaches (
  name,
  slug,
  city,
  state,
  country,
  timezone,
  lat,
  lon,
  region,
  break_type,
  skill_level,
  hazards,
  features,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  parking_tips,
  access_tips,
  crowd_tips,
  warnings,
  local_etiquette,
  real_takeaways,
  preference_model,
  is_private
)
SELECT
  canonical_name,
  slug,
  city,
  state,
  country,
  timezone,
  lat,
  lon,
  region,
  break_type,
  skill_level,
  hazards,
  features,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  preferred_tide_direction,
  best_conditions_prose,
  wave_tips,
  parking_tips,
  access_tips,
  crowd_tips,
  warnings,
  local_etiquette,
  real_takeaways,
  jsonb_build_object(
    'beginner_window', beginner_window,
    'aliases', to_jsonb(aliases),
    'source_urls', to_jsonb(source_urls),
    'coverage_action', coverage_action
  ),
  false
FROM temp_socal_sandy_beginner_profiles profile
WHERE insert_if_missing = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.beaches b
    WHERE b.deleted_at IS NULL
      AND (
        b.slug = profile.slug
        OR lower(b.name) = lower(profile.canonical_name)
        OR lower(b.name) IN (
          SELECT lower(alias_value)
          FROM unnest(profile.aliases) AS alias_value
        )
      )
  );

UPDATE public.beaches AS b
SET
  name = CASE
    WHEN profile.canonical_name = 'Goldenwest' THEN profile.canonical_name
    ELSE b.name
  END,
  slug = CASE
    WHEN profile.canonical_name = 'Goldenwest' THEN profile.slug
    ELSE COALESCE(b.slug, profile.slug)
  END,
  city = profile.city,
  state = profile.state,
  country = profile.country,
  timezone = profile.timezone,
  lat = COALESCE(b.lat, profile.lat),
  lon = COALESCE(b.lon, profile.lon),
  region = profile.region,
  break_type = profile.break_type,
  skill_level = profile.skill_level,
  hazards = profile.hazards,
  features = (
    SELECT ARRAY(
      SELECT DISTINCT feature
      FROM unnest(COALESCE(b.features, ARRAY[]::text[]) || profile.features) AS feature
      ORDER BY feature
    )
  ),
  preferred_tide_ft_min = COALESCE(profile.preferred_tide_ft_min, b.preferred_tide_ft_min),
  preferred_tide_ft_max = COALESCE(profile.preferred_tide_ft_max, b.preferred_tide_ft_max),
  preferred_tide_direction = COALESCE(profile.preferred_tide_direction, b.preferred_tide_direction),
  best_conditions_prose = profile.best_conditions_prose,
  wave_tips = profile.wave_tips,
  parking_tips = profile.parking_tips,
  access_tips = profile.access_tips,
  crowd_tips = profile.crowd_tips,
  warnings = profile.warnings,
  local_etiquette = profile.local_etiquette,
  real_takeaways = profile.real_takeaways,
  preference_model =
    COALESCE(b.preference_model, '{}'::jsonb) ||
    jsonb_build_object(
      'beginner_window', profile.beginner_window,
      'aliases', to_jsonb(profile.aliases),
      'source_urls', to_jsonb(profile.source_urls),
      'coverage_action', profile.coverage_action
    ),
  description = COALESCE(
    b.description,
    profile.best_conditions_prose
  )
FROM temp_socal_sandy_beginner_profiles profile
WHERE b.deleted_at IS NULL
  AND (
    b.slug = profile.slug
    OR lower(b.name) = lower(profile.canonical_name)
    OR lower(b.name) IN (
      SELECT lower(alias_value)
      FROM unnest(profile.aliases) AS alias_value
    )
  );

INSERT INTO public.beach_editorial_content (
  beach_id,
  content_type,
  content
)
SELECT
  b.id,
  'beginner_notes',
  jsonb_build_object(
    'description', profile.best_conditions_prose,
    'why_beginners_love_it', to_jsonb(profile.real_takeaways),
    'logistics', jsonb_build_object(
      'parking', profile.parking_tips,
      'walk_distance', profile.access_tips,
      'lifeguards', profile.beginner_fit <> 'no',
      'best_hours', '6-10am, earlier if possible',
      'facilities', 'Use official city or state beach facilities and follow posted lifeguard guidance.'
    ),
    'what_to_expect', jsonb_build_object(
      'wave_size', '1-2 ft is ideal; up to 3 ft can be manageable for learners when clean.',
      'wave_type', 'Sandy beachbreak with whitewater or inside reforms on the right small morning.',
      'bottom', profile.bottom_type,
      'hazards', to_jsonb(profile.hazards),
      'water_temp', 'Seasonal Southern California range; check the live water-temperature page before choosing a wetsuit.',
      'skill_level', profile.skill_level
    ),
    'seasonal_guide', jsonb_build_object(
      'summer', 'Best for true beginners when the surf is small and the morning wind stays light.',
      'fall', 'Can be excellent, but stronger combo swells may push learners to softer zones.',
      'winter', 'More variable and often less beginner-friendly; avoid bigger swell and strong drift.',
      'spring', 'Good progression season on small clean mornings before afternoon wind.'
    ),
    'important_note', 'The shared Southern California sandy learner rule is small, clean, early, and low-to-mid tide. Do not treat high tide on a tiny day as automatically beginner-friendly.'
  )
FROM temp_socal_sandy_beginner_profiles profile
JOIN public.beaches b
  ON b.deleted_at IS NULL
  AND (
    b.slug = profile.slug
    OR lower(b.name) = lower(profile.canonical_name)
    OR lower(b.name) IN (
      SELECT lower(alias_value)
      FROM unnest(profile.aliases) AS alias_value
    )
  )
WHERE profile.beginner_fit <> 'no'
ON CONFLICT (beach_id, content_type)
DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now(),
  generated_at = now();

UPDATE public.beaches AS b
SET
  preference_model =
    COALESCE(b.preference_model, '{}'::jsonb) ||
    jsonb_build_object(
      'beginner_window', classification.beginner_window,
      'sandy_beginner_inventory',
        jsonb_build_object(
          'scope', 'southern_california',
          'region', classification.region,
          'beginner_fit', classification.beginner_fit,
          'coverage_action', classification.coverage_action,
          'source_urls', to_jsonb(classification.source_urls)
        )
    )
FROM temp_socal_sandy_beginner_classifications classification
WHERE b.deleted_at IS NULL
  AND (
    b.slug = classification.slug
    OR lower(b.name) IN (
      SELECT lower(alias_value)
      FROM unnest(classification.aliases) AS alias_value
    )
  );

CREATE OR REPLACE FUNCTION public.preset_default_conditions(p_preset text, p_beach_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tide_min numeric;
  v_tide_max numeric;
  v_effective_tide_min numeric;
  v_effective_tide_max numeric;
  v_preference_model jsonb;
  v_beginner_window jsonb;
  v_beginner_fit text;
  v_apply_sandy_beginner boolean;
  v_result jsonb;
  v_wind_mph numeric;
  v_time_start text;
  v_time_end text;
BEGIN
  CASE p_preset
    WHEN 'glass_off' THEN
      RETURN jsonb_build_object(
        'wind_direction', 'offshore',
        'wind_speed_max_kt', 5,
        'swell_height_min', 2
      );
    WHEN 'big_day' THEN
      RETURN jsonb_build_object(
        'swell_height_min', 6,
        'swell_period_min', 10
      );
    WHEN 'mellow_session' THEN
      SELECT
        b.preferred_tide_ft_min,
        b.preferred_tide_ft_max,
        b.preference_model
      INTO
        v_tide_min,
        v_tide_max,
        v_preference_model
      FROM public.beaches b
      WHERE b.id = p_beach_id;

      v_beginner_window := v_preference_model -> 'beginner_window';
      v_beginner_fit := lower(v_beginner_window ->> 'beginner_fit');
      v_effective_tide_min := COALESCE(
        NULLIF(v_beginner_window ->> 'preferred_tide_ft_min', '')::numeric,
        v_tide_min
      );
      v_effective_tide_max := COALESCE(
        NULLIF(v_beginner_window ->> 'preferred_tide_ft_max', '')::numeric,
        v_tide_max
      );
      v_apply_sandy_beginner :=
        v_beginner_window IS NOT NULL
        AND v_beginner_fit IN ('primary', 'conditional');

      IF v_apply_sandy_beginner THEN
        v_wind_mph := COALESCE(
          NULLIF(v_beginner_window ->> 'max_beginner_wind_mph', '')::numeric,
          10
        );
        v_time_start := COALESCE(v_beginner_window #>> '{best_time_local,start}', '06:00');
        v_time_end := COALESCE(v_beginner_window #>> '{best_time_local,end}', '10:00');
        v_result := jsonb_build_object(
          'swell_height_min',
          COALESCE(
            NULLIF(v_beginner_window #>> '{acceptable_wave_height_ft,min}', '')::numeric,
            0.5
          ),
          'swell_height_max',
          COALESCE(
            NULLIF(v_beginner_window #>> '{acceptable_wave_height_ft,max}', '')::numeric,
            3
          ),
          'wind_speed_max_kt',
          round(v_wind_mph * 0.868976)::integer,
          'avoid_tide_statuses',
          jsonb_build_array('high'),
          'local_time_start',
          v_time_start,
          'local_time_end',
          v_time_end,
          'beginner_sandy_window',
          true
        );
      ELSE
        v_result := jsonb_build_object(
          'swell_height_min', 1.5,
          'swell_height_max', 4,
          'wind_speed_max_kt', 8
        );
      END IF;

      IF v_effective_tide_min IS NOT NULL THEN
        v_result := v_result || jsonb_build_object('tide_height_min_ft', v_effective_tide_min);
      END IF;
      IF v_effective_tide_max IS NOT NULL THEN
        v_result := v_result || jsonb_build_object('tide_height_max_ft', v_effective_tide_max);
      END IF;
      RETURN v_result;
    ELSE
      RAISE EXCEPTION 'Unknown preset_type: %', p_preset;
  END CASE;
END;
$$;

WITH sandy_beginner_beaches AS (
  SELECT b.id, b.preferred_tide_ft_min, b.preferred_tide_ft_max
  FROM public.beaches b
  WHERE b.deleted_at IS NULL
    AND b.preference_model ? 'beginner_window'
    AND lower(COALESCE(b.preference_model #>> '{beginner_window,beginner_fit}', '')) IN ('primary', 'conditional')
),
legacy_mellow_rules AS (
  SELECT r.id
  FROM public.alert_rules r
  JOIN sandy_beginner_beaches b ON b.id = r.beach_id
  WHERE r.preset_type = 'mellow_session'
    AND COALESCE(r.conditions ->> 'beginner_sandy_window', 'false') <> 'true'
    AND jsonb_typeof(r.conditions) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(
        CASE
          WHEN jsonb_typeof(r.conditions) = 'object' THEN r.conditions
          ELSE '{}'::jsonb
        END
      ) AS keys(condition_key)
      WHERE condition_key NOT IN (
        'swell_height_min',
        'swell_height_max',
        'wind_speed_max_kt',
        'tide_height_min_ft',
        'tide_height_max_ft'
      )
    )
    AND (r.conditions ->> 'swell_height_min') ~ '^[0-9]+(\.[0-9]+)?$'
    AND (r.conditions ->> 'swell_height_max') ~ '^[0-9]+(\.[0-9]+)?$'
    AND (r.conditions ->> 'wind_speed_max_kt') ~ '^[0-9]+(\.[0-9]+)?$'
    AND (r.conditions ->> 'swell_height_min')::numeric IN (1, 1.5)
    AND (r.conditions ->> 'swell_height_max')::numeric = 4
    AND (r.conditions ->> 'wind_speed_max_kt')::numeric = 8
    AND (
      NOT (r.conditions ? 'tide_height_min_ft')
      OR (
        b.preferred_tide_ft_min IS NOT NULL
        AND (r.conditions ->> 'tide_height_min_ft') ~ '^[0-9]+(\.[0-9]+)?$'
        AND (r.conditions ->> 'tide_height_min_ft')::numeric = b.preferred_tide_ft_min
      )
    )
    AND (
      NOT (r.conditions ? 'tide_height_max_ft')
      OR (
        b.preferred_tide_ft_max IS NOT NULL
        AND (r.conditions ->> 'tide_height_max_ft') ~ '^[0-9]+(\.[0-9]+)?$'
        AND (r.conditions ->> 'tide_height_max_ft')::numeric = b.preferred_tide_ft_max
      )
    )
)
UPDATE public.alert_rules r
SET
  conditions = public.preset_default_conditions('mellow_session', r.beach_id),
  updated_at = now()
FROM legacy_mellow_rules legacy
WHERE r.id = legacy.id;

COMMIT;
