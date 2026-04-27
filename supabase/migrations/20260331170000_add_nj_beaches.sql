-- Add ~21 new New Jersey surf beaches
-- Sources: Surfline, surf-forecast.com, DeepSwell, WannaSurf, Stormrider, Google Maps
BEGIN;

-- 1. 3rd Avenue Jetty (Belmar)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '3rd Avenue Jetty', 'Belmar', 'NJ', 'US', 40.1842, -74.0178,
  '3rd-avenue-jetty-belmar-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'beginner', 'moderate',
  'The 3rd Avenue Jetty is at the north end of Belmar''s beach-break stretch, where rock groins create wedgy peaks on both sides. The sand bottom and jetty protection make it more forgiving than the heavy 8th Avenue zone, attracting surf schools and intermediate surfers. Summertime Surf operates lessons here, keeping the vibe mellow and accessible.',
  280, 40,
  70, 180, 120, 55,
  1.0, 5.0, 'either',
  ARRAY[6,7,8,9,10,11],
  'Wedgy A-frame peaks form on both sides of the jetty. Longboards and funboards work well on smaller days; shortboards shine on hurricane swells. Sit close to the groin to catch the wedge but give it enough room to avoid getting pushed into rocks.',
  'Surf schools operate here in summer mornings, so afternoons and shoulder seasons are less congested. Winter sessions are generally uncrowded.',
  'Mid tide with a W to NW wind and 3-5 ft SE to E swell. The jetty funnels sand into defined bars that hold shape best at medium water levels.',
  'Walk over the boardwalk at 3rd Avenue; beach badge required in summer. ADA-accessible bathroom at 3rd Avenue.',
  'Metered street parking on Ocean Avenue and side streets. Badge booth at 3rd Avenue boardwalk entrance. Arrive early in summer or bike in.',
  ARRAY['jetty-protected','sandy bottom','beginner-friendly','surf school spot','boardwalk access','consistent'],
  ARRAY['rip currents near jetty','rocks along groin','summer beach badge required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('3rd Avenue Jetty'));

-- 2. 8th Avenue Jetty (Belmar)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '8th Avenue Jetty', 'Belmar', 'NJ', 'US', 40.1815, -74.0195,
  '8th-avenue-jetty-belmar-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'intermediate', 'crowded',
  'The 8th Avenue Jetty is one of Belmar''s heaviest and most localized peaks. The rock groin focuses swells into hollow, fast-breaking barrels over shallow sandbars. Strong localism and powerful waves make this a spot to earn your place in the lineup rather than casually paddle out.',
  280, 35,
  70, 180, 125, 55,
  0.5, 3.5, 'rising',
  ARRAY[9,10,11,12,1,2,3],
  'The jetty produces a heavy barrel on solid swells. Fast right-handers peel off the south side of the groin; lefts can be hollow on the north side. Shortboard territory when it is on. Watch for shallow sandbars at low tide.',
  'Strong local crew — do not paddle out if there are more than four surfers in the water unless you are known. Best to earn respect over time. Early mornings in winter offer the best chance at an uncrowded session.',
  'Low to mid incoming tide, W to NW wind, 4-8 ft SE to E swell. The shallow bars suck dry on low tide creating fast, hollow sections.',
  'Walk over the boardwalk at 8th Avenue. Bathrooms available at 8th Avenue.',
  'Metered parking along Ocean Avenue. Limited side-street spots. Same Belmar beach badge system applies in summer.',
  ARRAY['hollow','powerful','barrel','jetty-protected','sandy bottom','localized'],
  ARRAY['strong localism','heavy barrels on shallow sandbars','rip currents','rocks along groin','not beginner-friendly']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('8th Avenue Jetty'));

-- 3. Belmar Fishing Pier / 19th Avenue (Belmar)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Belmar Fishing Pier', 'Belmar', 'NJ', 'US', 40.1751, -74.0233,
  'belmar-fishing-pier-belmar-nj', 'Jersey Shore', 'America/New_York',
  'pier', 'intermediate', 'moderate',
  'The Belmar Fishing Pier at 19th Avenue marks the south end of Belmar''s mile-long beach-break stretch. The pier structure creates defined sandbars and can produce powerful, barreling waves when a solid swell wraps around it. Less consistent than mid-Belmar spots but capable of excellent surf on the right day.',
  270, 40,
  60, 180, 110, 60,
  1.0, 4.5, 'either',
  ARRAY[8,9,10,11,12,1,2],
  'The pier creates well-defined peaks on both sides. Rights off the south piling can barrel on overhead swells. Challenging and powerful — the pier amplifies swell energy. Longboards work when smaller, shortboards essential when bigger. Waves break for up to 100 meters.',
  'Less crowded than central Belmar due to the walk south. The pier itself attracts fishermen, so be mindful of lines. Best uncrowded windows are winter mornings.',
  'Mid tide, W wind, 4-6 ft ENE to SE swell. September is historically the most consistent month with clean waves about 22% of the time.',
  'South end of Belmar boardwalk at 19th Avenue. Longer walk from central parking areas.',
  'Metered parking on Ocean Avenue near 19th. Less competition for spots than central Belmar. Street parking on side streets.',
  ARRAY['pier break','powerful','barreling sections','sandy bottom','less crowded than central Belmar'],
  ARRAY['pilings present underwater hazard','strong currents near pier structure','fishing lines in water','inconsistent — needs solid swell']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Belmar Fishing Pier'));

-- 4. Washington Beach (Spring Lake)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Washington Beach', 'Spring Lake', 'NJ', 'US', 40.1571, -74.0218,
  'washington-beach-spring-lake-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'beginner', 'moderate',
  'Washington Beach is a designated surfing beach at the north end of Spring Lake, known as a longboard haven. Mushy, forgiving takeoffs over a sand bottom make it an ideal spot for beginners and log riders. The mellow wave quality and wide-open lineup keep the vibe relaxed, though the "log set" can create its own hassles when it gets crowded.',
  280, 40,
  70, 180, 120, 55,
  1.5, 5.0, 'either',
  ARRAY[5,6,7,8,9,10],
  'Mushy, rolling waves ideal for longboards and funboards. Do not expect hollow or fast-breaking surf here — this is a cruising wave. On bigger swells, the outside breaks can produce longer rides. Small summer south swells are the bread and butter.',
  'Popular with longboarders and beginners — the "log set" can hog waves. Surf early mornings or on weekday afternoons for more space. Less crowded than Surfer''s Beach due to less drive-up access.',
  'Mid to high tide, W to NW wind, 2-4 ft S to SE swell. Small, clean summer days are when Washington shines as a longboard playground.',
  'Walk from Washington Avenue to the beach. Designated surfing beach operates 9am-6pm. Beach badge required in summer.',
  'Street parking on Washington Avenue and surrounding blocks. No dedicated lot — limited availability in summer.',
  ARRAY['longboard-friendly','mellow','beginner-friendly','sandy bottom','forgiving','designated surf beach'],
  ARRAY['mushy takeoffs can frustrate shortboarders','rip currents near groins on bigger days','summer beach badge required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Washington Beach'));

-- 5. Surfer''s Beach / Kook Bay (Spring Lake)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Surfer''s Beach', 'Spring Lake', 'NJ', 'US', 40.1495, -74.0248,
  'surfers-beach-spring-lake-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'beginner', 'crowded',
  'Commonly called Surfer''s Beach or Kook Bay, this spot at the south end of Spring Lake is the town''s most popular surfing beach. Drive-up access makes it easy to check conditions, which means it is always crowded when good. On a south swell, the inside corner bowls up and produces a really fun, hollow left. Generally mushy and beginner-friendly, but capable of quality waves.',
  280, 40,
  80, 190, 130, 55,
  1.0, 4.5, 'rising',
  ARRAY[6,7,8,9,10,11],
  'Generally a mushy wave and great beginner spot, but south swells transform the inside corner into a fun, hollow left. Rights are mellower. Longboards dominate on small days; bring a shortboard when it is pumping overhead.',
  'Always crowded — you can just drive up and check it, drawing every surfer in the area. Early mornings and cold winter days are the only reliable uncrowded windows. Avoid summer weekends if you want waves to yourself.',
  'Low to mid incoming tide, W wind, 3-5 ft S to SE swell. South swells produce the best-shaped waves with that hollow inside left.',
  'Designated surfing beach at the very south end of Spring Lake, near Mercer Avenue. Easy drive-up access to check conditions.',
  'Street parking near the south end; easier to find than central Spring Lake. Drive-up convenience is part of why it is so crowded.',
  ARRAY['consistent','hollow lefts on south swell','sandy bottom','drive-up access','beginner-friendly on small days'],
  ARRAY['always crowded when good','rip currents on bigger swells','mushy on most days','summer beach badge required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Surfer''s Beach'));

-- 6. Mambo Beach (Spring Lake)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Mambo Beach', 'Spring Lake', 'NJ', 'US', 40.1560, -74.0222,
  'mambo-beach-spring-lake-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'intermediate', 'moderate',
  'Mambo Beach is a hollow beach-break at the north end of Spring Lake, just south of Washington Beach. When the sandbars align, Mambo produces punchy, hollow peaks that offer more performance surfing than the mellower Washington zone. It sits between the beginner-friendly Washington and the party-wave chaos of Kook Bay, attracting a solid intermediate crew.',
  280, 40,
  70, 180, 120, 55,
  0.5, 4.0, 'rising',
  ARRAY[8,9,10,11,12,1,2],
  'Hollow beach-break peaks — punchier and faster than neighboring Washington. A-frame peaks offer both lefts and rights. Works best on medium-period swells that organize the sandbars. Shortboards and fish are the go-to here.',
  'Less crowded than Kook Bay since it requires knowing the spot. The intermediate nature of the wave filters out true beginners. Midweek fall sessions can be uncrowded with quality waves.',
  'Low to mid incoming tide, NW wind, 3-6 ft E to SE swell. Needs more swell than Washington to turn on but rewards with hollow, performance-oriented waves.',
  'North end of Spring Lake beachfront. Walk from the boardwalk between Washington Avenue and Remsen Avenue.',
  'Street parking along Ocean Avenue and side streets. Similar to Washington Beach — limited but manageable outside of peak summer weekends.',
  ARRAY['hollow','punchy','performance wave','sandy bottom','less crowded than Kook Bay'],
  ARRAY['rip currents on bigger days','shallow sandbars at low tide','summer beach badge required','needs solid swell to work']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Mambo Beach'));

-- 7. South End Jetty (Spring Lake)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'South End Jetty', 'Spring Lake', 'NJ', 'US', 40.1465, -74.0260,
  'south-end-jetty-spring-lake-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'intermediate', 'light',
  'The South End Jetty at Spring Lake is longer than the rest of the groins, pushing the sandbar farther outside. This creates a bigger-wave option when the rest of the town is maxing out. The longer paddle and heavier wave quality keep crowds thin and attract experienced surfers looking for more size. Near Wreck Pond outlet.',
  280, 35,
  70, 180, 120, 55,
  1.0, 4.0, 'rising',
  ARRAY[9,10,11,12,1,2,3],
  'The longer jetty pushes the sandbar farther outside, so the wave is bigger and more powerful than other Spring Lake peaks. Good spot on bigger days when the rest of town is closing out. Longer paddle required. Shortboards only.',
  'Light crowds due to the longer paddle and more demanding waves. Worth the effort when everywhere else is maxed out. The few surfers here tend to be experienced.',
  'Mid incoming tide, W to NW wind, 5-8 ft E to SE swell. This is the big-wave option for Spring Lake — comes alive on solid hurricane or nor''easter swells.',
  'South end of Spring Lake beachfront, near the border with Sea Girt. Longer walk from parking areas.',
  'Street parking along the south end of Ocean Avenue. Less competition for spots due to the remote location.',
  ARRAY['bigger waves','less crowded','jetty-protected','sandy bottom','good on bigger days','longer ride'],
  ARRAY['longer paddle out','powerful waves on solid swells','rip currents near jetty','proximity to Wreck Pond outlet — water quality concern after rain','not for beginners']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('South End Jetty'));

-- 8. Seven Presidents Oceanfront Park (Long Branch)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Seven Presidents Oceanfront Park', 'Long Branch', 'NJ', 'US', 40.2945, -73.9848,
  'seven-presidents-oceanfront-park-long-branch-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'intermediate', 'light',
  'Seven Presidents Oceanfront Park is a 38-acre county park that was one of the first locations on the Jersey Shore to allow surfing. Named after the seven US presidents who vacationed in Long Branch, the park offers designated surf zones alongside swimming areas, a snack bar, showers, and volleyball courts. The beach break produces mellow peaks over sand with inconsistent but occasionally fun surf.',
  275, 40,
  60, 170, 110, 55,
  1.0, 4.0, 'rising',
  ARRAY[6,7,8,9,10,11],
  'Mellow beach-break peaks over sand. Best around low tide on the rise when bars are more defined. The inconsistency can be frustrating, but when it is on, the waves are fun and uncrowded. Longboards and funboards recommended for most days.',
  'Even when there are waves, it is not likely to be crowded. The park setting and designated areas spread surfers out. One of the best options for an uncrowded NJ session.',
  'Low incoming tide, W wind, 3-5 ft SE swell. The best conditions have historically been in summer (July) with clean surfable waves about 50% of the time.',
  '221 Ocean Avenue North, Long Branch. Enter through the park entrance. Lifeguards supervise designated surfing and swimming areas in summer.',
  'Large pay parking lot within the park. Ample spaces compared to other Jersey Shore spots. Park entrance fee applies in summer.',
  ARRAY['uncrowded','sandy bottom','parking lot','restrooms','showers','snack bar','family-friendly','historic surf spot'],
  ARRAY['inconsistent surf','rocks in some areas','park entrance fee in summer']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Seven Presidents Oceanfront Park'));

-- 9. 7th Street Beach (Ocean City)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '7th Street Beach', 'Ocean City', 'NJ', 'US', 39.2780, -74.5630,
  '7th-street-beach-ocean-city-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'intermediate', 'crowded',
  '7th Street is Ocean City''s original and most iconic surfing beach, with a legacy spanning over half a century since surfing became legal in the city in 1967. The exposed beach break creates consistent surf on good days, though three outfall pipes extending into the break can create intense currents and steep drops on rough days. The 7th Street Surf Shop anchors the local scene.',
  280, 40,
  50, 180, 100, 65,
  1.0, 4.5, 'either',
  ARRAY[7,8,9,10,11,12,1,2],
  'Beach-break peaks with occasional steep drops near the outfall pipes. The currents created by the pipes can be intense on rough days but also help shape defined peaks. Late summer through fall provides the most consistent surf. Works year-round.',
  'OCNJ''s primary surf beach — crowded on any good day, especially in summer. Early dawn patrols and winter sessions offer the best uncrowded windows. The surf shop community adds to the lineup density.',
  'Mid tide, W to NW wind, 3-6 ft E to SE swell. Late summer hurricane swells combined with autumn''s offshore winds create the best sessions.',
  'Boardwalk access at 7th Street. Designated surfing beach with lifeguard supervision in summer. Beach tags required.',
  'Street parking on 7th Street and surrounding blocks. Metered spots fill quickly in summer. Consider biking from further parking areas.',
  ARRAY['consistent','iconic OCNJ surf spot','sandy bottom','surf shop on-site','historic','boardwalk access'],
  ARRAY['three outfall pipes create intense currents','steep drops on rough days','crowded on good swells','summer beach tags required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('7th Street Beach'));

-- 10. Waverly Beach (Ocean City)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Waverly Beach', 'Ocean City', 'NJ', 'US', 39.2932, -74.5530,
  'waverly-beach-ocean-city-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'beginner', 'light',
  'Waverly Beach sits near the northern tip of Ocean City island, just off Waverly Boulevard and East Atlantic Boulevard. As the quietest of OCNJ''s three designated surfing beaches, its hundreds of feet of golden shoreline provide mellow, forgiving waves for surfers of all skill levels. The best surfing conditions typically peak in midsummer around July.',
  290, 40,
  40, 170, 90, 65,
  1.5, 5.0, 'either',
  ARRAY[6,7,8,9,10],
  'Mellow, forgiving beach-break waves. The northern location catches more NE swell energy. Longboards and funboards are ideal for the typically small, rolling surf. Midsummer provides surprisingly fun conditions when south swells wrap in.',
  'The quietest of OCNJ''s three surfing beaches. Even in summer, the crowd is manageable. The northern location means fewer walk-up visitors compared to central 7th Street.',
  'Mid tide, W to NW wind, 2-4 ft NE to E swell. The northern position means it catches NE swell energy well. July has historically been the best month.',
  'Access from Waverly Boulevard and East Atlantic Boulevard at the north end of Ocean City island. Designated surfing beach.',
  'Street parking in the north end neighborhood. Generally easier to find spots than central OCNJ.',
  ARRAY['uncrowded','mellow','beginner-friendly','sandy bottom','quiet neighborhood','wide beach'],
  ARRAY['inconsistent — needs right conditions','currents near inlet on big swells','summer beach tags required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Waverly Beach'));

-- 11. 1st Street Jetty (Ocean City)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '1st Street Jetty', 'Ocean City', 'NJ', 'US', 39.2965, -74.5498,
  '1st-street-jetty-ocean-city-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'intermediate', 'moderate',
  'The 1st Street Jetty at the very north end of Ocean City produces consistent rights that peak up off the rock structure and peel down the beach. Occasionally strong lefts form on the other side. The jetty''s proximity to the Longport/Ocean City inlet adds extra energy and current, making this a step up from the mellower beach breaks in town. A great off-season option.',
  290, 35,
  40, 170, 80, 65,
  1.0, 4.0, 'rising',
  ARRAY[9,10,11,12,1,2,3],
  'Consistent rights peak up off the jetty and peel down the beach in fun, workable walls. Lefts are occasionally strong on the other side. The inlet adds extra swell energy, so it often has more size than the beach breaks in town. Shortboards and fish work best.',
  'Moderate crowds — the jetty attracts intermediate to advanced surfers who know the spot. Less crowded than 7th Street but busier than Waverly. Off-season sessions can be uncrowded and excellent.',
  'Low to mid incoming tide, NW wind, 3-6 ft NE to E swell. The jetty focuses NE swell energy into defined rights. Fall and winter produce the most consistent surf.',
  'North end of Ocean City near the inlet. Walk from the boardwalk terminus.',
  'Street parking on 1st Street and surrounding blocks. Easier to find than central OCNJ.',
  ARRAY['jetty-protected','consistent rights','sandy bottom','inlet proximity adds energy','good off-season spot'],
  ARRAY['strong currents near inlet','rocks along jetty','rip currents on bigger swells','not for beginners']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('1st Street Jetty'));

-- 12. Broadway Beach (Cape May)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Broadway Beach', 'Cape May', 'NJ', 'US', 38.9345, -74.9098,
  'broadway-beach-cape-may-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'intermediate', 'very_crowded',
  'Broadway Beach is currently the most crowded surf spot in Cape May, offering the greatest variety of waves in town. The main peak is a consistently good left that breaks off the jetty, frequently shifting a little down the beach. Fun wedgy rights and lined-up lefts appear up and down the entire beach on a decent swell. On big nor''easters and hurricane swells, 100-150 surfers can pack the lineup when the rest of the coast is giant and unsurfable.',
  20, 40,
  30, 180, 120, 75,
  2.0, 5.0, 'either',
  ARRAY[8,9,10,11,12,1,2,3],
  'The main peak is a consistently good left off the jetty. Wedgy rights also form, and on decent swells the entire beach lights up with lined-up lefts. Cape May faces south, so NE winds are offshore here — different from the rest of NJ. Works on bigger swells that wrap around the cape.',
  'Be prepared to deal with aggressive crowds during big nor''easters and hurricane swells. 100-150 surfers is not uncommon on the best days. Respect the pecking order — this is a competitive lineup.',
  'Mid to high tide, NE wind (offshore here due to south-facing aspect), 3-6 ft NE to SE swell that wraps around the cape.',
  'Beach tags required. Surfing is only permitted before and after lifeguard hours in summer — dawn patrol or evening sessions only during beach season. Restrooms available along the beach at Broadway.',
  'Street parking on Broadway and surrounding blocks. Metered in summer. More available than central Cape May beaches.',
  ARRAY['consistent left off jetty','variety of waves','sandy bottom','south-facing (unique for NJ)','works on big swells'],
  ARRAY['extremely crowded on good days','surfing restricted to before/after lifeguard hours in summer','aggressive lineup on big days','strong currents']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Broadway Beach'));

-- 13. The Cove (Cape May)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'The Cove', 'Cape May', 'NJ', 'US', 38.9312, -74.9180,
  'the-cove-cape-may-nj', 'Jersey Shore', 'America/New_York',
  'point', 'intermediate', 'crowded',
  'The Cove is the king of Cape May surf spots — a rare NJ point break tucked at the southwest end of town where the coastline wraps south. The south-facing aspect allows it to handle big NE swells that manage to wrap in, producing long left-hand tubes. When good, three below-sea-level left-hand tubes on one wave are not uncommon. Quite reliable surf that works at any time of year.',
  20, 35,
  60, 200, 140, 70,
  1.0, 5.5, 'either',
  ARRAY[8,9,10,11,12,1,2,3],
  'Long left-hand point-break walls with tube sections. Three below-sea-level barrels on one wave are possible when it is firing. The point wraps NE and E swells beautifully. Shortboards essential. NE winds are offshore here due to the south-facing aspect — a huge advantage when the rest of NJ is blown out.',
  'Often crowded when good — the quality of the wave draws surfers from across the region. The pecking order is established. Best chance at uncrowded waves is midweek in fall or winter.',
  'All tides work. NNE wind (offshore), 4-8 ft SE swell. The best conditions occur in autumn, most often September. Wrap-around NE swells on big storm days can produce epic sessions.',
  'Far west end of Cape May''s beach. Surfing permitted all day (no lifeguard-hour restrictions). Walk from Beach Avenue.',
  'Street parking along the west end of Beach Avenue. The Sunset Pavilion overlooks The Cove.',
  ARRAY['point break','long left-hand walls','barrel sections','south-facing','works when rest of NJ blown out','all-day surfing'],
  ARRAY['rocks','man-made hazards (buoys)','crowded when good','powerful on big swells','unique wind/swell dynamics — study before surfing']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('The Cove'));

-- 14. Poverty Beach (Cape May)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Poverty Beach', 'Cape May', 'NJ', 'US', 38.9442, -74.8988,
  'poverty-beach-cape-may-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'advanced', 'moderate',
  'Poverty Beach is the northernmost beach in Cape May, a barrier spit approximately 2.5 miles long along the Atlantic Ocean coast. When the right combination of wind, swell, and tide align, Poverty produces hollow A-frame waves with high-performance potential. On larger days brought by N/NW winds, it becomes a hollow, expert-only wave. The spot is fickle but rewarding when conditions converge.',
  340, 35,
  90, 200, 150, 55,
  1.0, 3.5, 'falling',
  ARRAY[9,10,11,12,1,2],
  'Hollow A-frames with barreling sections on both sides. Expert-level waves on bigger days — fast, shallow, and powerful. The east-facing aspect means it handles SSE swells well. Shortboards only. The fickle nature means most swells are not ideal — patience is required.',
  'Moderate crowds when conditions align. The expert-level difficulty and fickle nature filter out casual surfers. The local neighborhood crowd is manageable. November has historically been the most consistent month.',
  'Low to mid falling tide, NNW wind, 4-6 ft SSE swell. Big E or SE swell combined with N or NE winds gets this spot cooking. November is the peak month with clean surfable waves about 35% of the time.',
  'Entrance at Wilmington Avenue (Wilmington Street). Surfing permitted all day. Free access — no beach tags required at Poverty Beach.',
  'Free street parking near Wilmington Avenue entrance. One of the few Cape May spots with free parking. Showers at the entrance.',
  ARRAY['hollow','A-frame peaks','high-performance','free parking','free access','sandy bottom','expert wave'],
  ARRAY['rocks and submerged pilings','fickle — needs specific conditions','expert-only on bigger days','strong currents','water quality concern after rain']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Poverty Beach'));

-- 15. 12th Street Jetty (Sea Isle City)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '12th Street Jetty', 'Sea Isle City', 'NJ', 'US', 39.1563, -74.6870,
  '12th-street-jetty-sea-isle-city-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'beginner', 'light',
  'The 12th Street Jetty in Sea Isle City is a longboarder''s sanctuary — a mellow jetty break that rolls over a sand bottom with easy-to-surf waves. The rock groin provides just enough structure to organize the sandbars without creating intimidating power. Waves break for up to 150 meters providing fun sections for cruising or maneuvers. The relaxed vibe and forgiving nature make it ideal for longboarders and intermediate surfers.',
  280, 40,
  50, 180, 100, 65,
  1.5, 5.0, 'either',
  ARRAY[6,7,8,9,10,11],
  'Mellow, rolling waves perfect for longboards and funboards. The jetty organizes the swell into defined, predictable peaks without adding too much power. Rides up to 150 meters possible on clean days. Shortboards work when it is bigger.',
  'Light crowds — Sea Isle City is less discovered than northern NJ surf towns. The mellow wave quality and longboard character keep the vibe relaxed. Midweek sessions are often empty.',
  'Mid tide, W wind, 2-4 ft E to SE swell. The forgiving nature means it works on a wider range of conditions than more demanding spots. All tides work but not ideal on very low.',
  'Beach access at 12th Street. Designated surfing areas enforced during lifeguard hours.',
  'Street parking on 12th Street and surrounding blocks. Easier to find than northern NJ shore towns.',
  ARRAY['longboard-friendly','mellow','jetty-protected','sandy bottom','long rides','uncrowded','forgiving'],
  ARRAY['rip currents near jetty on bigger days','summer beach tags required','inconsistent — needs swell to work']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('12th Street Jetty'));

-- 16. 36th-42nd Street (Sea Isle City)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '36th-42nd Street', 'Sea Isle City', 'NJ', 'US', 39.1398, -74.6952,
  '36th-42nd-street-sea-isle-city-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'intermediate', 'moderate',
  'The stretch from 36th to 42nd Street offers some of the best surf on Sea Isle City island. Northeast swells deliver quality lefts that break off the rock jetties in this southern section of town. Several peaks pop up between the streets, and a really good left shows up off the jetty on a NE swell. More power and performance potential than the northern part of the island.',
  280, 40,
  30, 170, 80, 70,
  1.0, 4.5, 'rising',
  ARRAY[8,9,10,11,12,1,2,3],
  'Quality lefts peel off the rock jetties on NE swells. Multiple peaks between 36th and 42nd Streets give options for spreading out. The southern location catches NE swell energy well. Shortboards and fish are ideal; longboards work on smaller days.',
  'More crowded than northern Sea Isle spots when a NE swell is running, as word gets out about the quality lefts. Still manageable compared to Monmouth County spots. Midweek sessions remain uncrowded.',
  'Low to mid incoming tide, W to NW wind, 3-6 ft NE swell. The rock jetties focus NE energy into defined left-hand walls.',
  'Beach access at 36th through 42nd Streets. Multiple entry points allow you to scout peaks before paddling out.',
  'Street parking along the 36th-42nd Street blocks. Ample availability outside summer weekends.',
  ARRAY['quality lefts','multiple peaks','jetty-protected','sandy bottom','consistent on NE swells','performance wave'],
  ARRAY['rip currents near jetties','rocks along groins','currents increase on bigger swells','summer beach tags required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('36th-42nd Street'));

-- 17. 3rd Avenue Beach (Bradley Beach)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  '3rd Avenue Beach', 'Bradley Beach', 'NJ', 'US', 40.2018, -74.0108,
  '3rd-avenue-beach-bradley-beach-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'beginner', 'moderate',
  'The 3rd Avenue surfing beach in Bradley Beach is a designated surf zone extending 400 feet north from the Third Avenue Jetty. A reliable beach/jetty break with consistent surf year-round, Bradley Beach will never have the best surf in the state but always offers something, especially in fall, winter, and spring. The jetty creates defined peaks, and the sand bottom keeps things forgiving.',
  280, 40,
  60, 180, 100, 60,
  0.5, 4.0, 'rising',
  ARRAY[8,9,10,11,12,1,2,3],
  'Defined peaks form off the 3rd Avenue Jetty with both lefts and rights. Longboards dominate on smaller days — expect company from the log set. Best wave quality around low tide on the rise. West winds clean everything up. September is historically the most consistent month.',
  'Popular with longboarders who can hog waves on smaller days. The 400-foot designated zone concentrates surfers. Midweek fall and winter sessions offer the best uncrowded windows.',
  'Low incoming tide, W wind, 3-5 ft E to SE swell. Autumn provides the most consistent clean waves, especially September.',
  'Designated surfing area extending 400 feet north from the Third Avenue Jetty. Surfing allowed in designated area during daylight hours only. Beach badge required in summer.',
  'Street parking on 3rd Avenue and surrounding blocks. Beach badge booth nearby. Metered in summer.',
  ARRAY['designated surf zone','jetty-protected','consistent','sandy bottom','longboard-friendly','year-round surf'],
  ARRAY['longboarders hog waves on small days','concentrated surf zone can feel crowded','rip currents near jetty','summer beach badge required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('3rd Avenue Beach'));

-- 18. Brinley Avenue (Bradley Beach)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Brinley Avenue', 'Bradley Beach', 'NJ', 'US', 40.1985, -74.0125,
  'brinley-avenue-bradley-beach-nj', 'Jersey Shore', 'America/New_York',
  'jetty', 'intermediate', 'light',
  'Brinley Avenue is Bradley Beach''s ace in the hole — when everywhere else is closing out on big east swells, Brinley can handle the size. The jetty at Brinley Avenue provides structure that tames overhead-plus E swell, making it the go-to call when other spots are maxed. Less known than the primary 3rd Avenue surf zone, keeping crowds light.',
  280, 40,
  50, 170, 90, 60,
  1.0, 4.5, 'either',
  ARRAY[9,10,11,12,1,2,3],
  'Brinley can take a straight E swell when everywhere else is closing out — that is its superpower. The jetty provides enough protection to organize big swells into surfable peaks. Fish and shortboards are the weapons of choice. A valuable backup spot in any NJ surfer''s quiver.',
  'Light crowds — most surfers default to the 3rd Avenue zone, leaving Brinley relatively empty even on good days. Local knowledge is required to know when to check it. The uncrowded factor is part of the appeal.',
  'Mid tide, W to NW wind, 4-8 ft E swell. Specifically valuable when a big E swell has everywhere else closing out. The jetty breaks up the swell energy into surfable waves.',
  'Brinley Avenue beach access. Fishing also permitted on the Brinley Avenue jetty at the discretion of lifeguards. Less formal than the 3rd Avenue designated zone.',
  'Street parking on Brinley Avenue and surrounding blocks. Easy to find — fewer visitors than 3rd Avenue area.',
  ARRAY['handles big E swells','jetty-protected','uncrowded','sandy bottom','backup spot when everywhere else is maxed','local knowledge spot'],
  ARRAY['powerful waves when it is working','rip currents near jetty','rocks along groin','needs big swell to be worth checking']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Brinley Avenue'));

-- 19. Bay Head Beach (Bay Head)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Bay Head Beach', 'Bay Head', 'NJ', 'US', 40.0725, -74.0418,
  'bay-head-beach-bay-head-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'intermediate', 'crowded',
  'Bay Head is a fun beach break peppered with rock groins (groynes) that unload over well-defined sandbars. Fast right-hand barrels are the signature wave here, breaking over shallow sandbars with power and speed. The break is somewhat consistent and produces both lefts and rights, but the rights are what draw surfers from across the region. When the sandbars align, Bay Head is one of the best beach breaks on the Jersey Shore.',
  270, 40,
  60, 180, 120, 60,
  1.0, 4.5, 'rising',
  ARRAY[8,9,10,11,12,1,2,3],
  'Fast right-hand barrels are the draw — shallow sandbars create hollow, quick waves. Tricky takeoffs over the shallow bottom require experience. Waves break for up to 100 meters with barreling sections. Gets good from chest high to double overhead. Multiple peaks along the groins offer options.',
  'Crowded when good — the quality of the wave draws surfers from a wide area. Multiple peaks help spread the crowd. Midweek and early morning sessions are the best bet. The localism is moderate but present.',
  'Low to mid incoming tide, W wind, 4-6 ft SE swell. The well-defined sandbars fire on medium-period SE groundswells. Works year-round but fall and winter are prime.',
  'Beach access from multiple street ends in Bay Head. Beach badges required in summer. The small borough feel keeps things manageable.',
  'Street parking throughout Bay Head. Limited availability in summer — the small town means few spots. Consider cycling.',
  ARRAY['fast right-hand barrels','well-defined sandbars','multiple peaks','sandy bottom','consistent','powerful'],
  ARRAY['shallow sandbars — risk of hitting bottom','rip currents','crowded on good swells','tricky takeoffs','summer beach badges required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Bay Head Beach'));

-- 20. Seaside Park (Seaside Park)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Seaside Park', 'Seaside Park', 'NJ', 'US', 39.9268, -74.0720,
  'seaside-park-seaside-park-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'intermediate', 'moderate',
  'Seaside Park is an exposed beach break on the Barnegat Peninsula with consistent surf that works year-round. Both left and right hand waves break over sand, equally likely from local windswells and distant groundswells. The break quality is not affected by tide, making it a forgiving, accessible option for a range of skill levels. The adjacent Seaside Heights boardwalk adds a fun, carnival-like atmosphere.',
  290, 45,
  50, 180, 110, 65,
  0.5, 5.5, 'either',
  ARRAY[8,9,10,11,12,1,2,3],
  'Beach-break peaks with lefts and rights. The surf is not tide-dependent, which makes timing easier. Windswells and groundswells in equal measure — check it on any swell direction from SE to E. Longboards work well on smaller days; shortboards when overhead. September and winter months provide the best consistency.',
  'Moderate crowds — the long stretch of beach provides space to spread out. Summer brings more swimmers than surfers. Fall through spring is the best time for uncrowded quality waves.',
  'Any tide, NW wind, 3-5 ft SE swell. The best consistent waves come in winter, and September is historically the peak month for clean surf.',
  'Beach access from multiple street ends in Seaside Park. Surfers need to stay in designated areas during guarded hours. Beach badges required. Restraining device (leash) required and must be attached.',
  'Street parking throughout Seaside Park. Boardwalk-area lots available in summer for a fee. More parking available than in smaller shore towns.',
  ARRAY['consistent','tide-independent','sandy bottom','works year-round','accessible','boardwalk nearby'],
  ARRAY['rip currents and undertow','must use leash','stay in designated surf areas during guarded hours','summer beach badges required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Seaside Park'));

-- 21. Ortley Beach (Toms River)
INSERT INTO beaches (
  name, city, state, country, lat, lon, slug, region, timezone,
  break_type, skill_level, crowd_level, description,
  wind_offshore_deg, wind_offshore_tol_deg,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg,
  preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
  best_months, wave_tips, crowd_tips, best_conditions_prose,
  access_tips, parking_tips, features, warnings
)
SELECT
  'Ortley Beach', 'Toms River', 'NJ', 'US', 39.9557, -74.0695,
  'ortley-beach-toms-river-nj', 'Jersey Shore', 'America/New_York',
  'beach', 'intermediate', 'moderate',
  'Ortley Beach is an unincorporated community within Toms River, situated on the Barnegat Peninsula between Lavallette and Seaside Heights. The beach break produces both left and right waves over a sandy bottom, with quality heavily dependent on sandbar configuration. When the sandbars are set up right, Ortley delivers fun, surfable peaks. The wide beach stretches from 3rd Avenue to Harding Avenue with multiple access points.',
  280, 45,
  50, 180, 110, 65,
  1.0, 5.0, 'either',
  ARRAY[9,10,11,12,1,2,3],
  'Beach-break peaks — lefts and rights over sand. Quality depends on sandbar setup, so check it regularly and stay flexible. Waves from 3-8 ft are surfable. SW to NW winds are preferred. Longboards for small days, shortboards when overhead.',
  'Moderate crowds. The long stretch of beach provides room to spread out and find your own peak. The boardwalk reconstruction has reinvigorated the local scene. Less crowded than Monmouth County spots.',
  'Mid tide, W to NW wind, 3-6 ft SE to E swell. Autumn through winter (September to March) is prime season. Sandbars shift frequently — flexibility is key.',
  'Multiple beach access points from the boardwalk between 3rd Avenue and Harding Avenue. Surfing permitted in designated areas during guarded hours. Beach badges required.',
  'Street parking and boardwalk-area lots. Beach badge or pass required for access during guarded season.',
  ARRAY['sandy bottom','long beach stretch','multiple peaks','works on various swells','boardwalk access'],
  ARRAY['sandbar-dependent — inconsistent','rip currents','must use leash','summer beach badges required']
WHERE NOT EXISTS (SELECT 1 FROM beaches WHERE lower(name) = lower('Ortley Beach'));

COMMIT;
