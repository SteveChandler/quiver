-- Complete Quiver's curated public Oahu catalog with 16 forecast anchors.
-- NOAA/NWS verification (2026-07-12): each coordinate was shifted 5 km offshore
-- along its shoreline aspect and resolved successfully to office HFO gridpoints.
-- No terrain factors, CDIP stations, or photos are inferred by this seed.

BEGIN;

WITH new_spots (
  id, name, city, state, country, lat, lon, break_type, skill_level,
  hazards, features, swell_window_min_deg, swell_window_max_deg,
  wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt,
  wind_onshore_bad_kt, preferred_tide_ft_min, preferred_tide_ft_max,
  preferred_tide_direction, preference_model, aspect_deg,
  swell_window_center_deg, swell_window_halfwidth_deg, best_months, slug,
  region, timezone, description, parking_tips, access_tips, wave_tips,
  crowd_tips, best_conditions_prose, warnings, local_etiquette, crowd_level,
  real_takeaways, is_private, cdip_eligible, persona, deepwater_decay_factor,
  nws_office, nws_forecast_zone
) AS (
  VALUES
    (
      'bb286d50-ad8d-4315-b966-5dbc31605a26'::uuid, 'Makaha', 'Waianae', 'HI', 'USA',
      21.470800, -158.220300, 'reef', 'advanced',
      ARRAY['shallow reef', 'strong currents', 'large winter surf', 'localism']::text[],
      ARRAY['historic west-side point break', 'long rights', 'lifeguarded beach park']::text[],
      245, 25, 75, 40, 12, 9, 0.5, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":300,"period_s":15},"noaa_grid":"HFO/138,151","noaa_offshore_shift_km":5}'::jsonb,
      225, 315, 70, ARRAY[10,11,12,1,2,3], 'makaha', 'West Oahu', 'Pacific/Honolulu',
      'Mākaha is a historic west-side reef and point break with powerful, long rights and occasional lefts. Winter north and northwest swell can turn it into a serious big-wave venue; smaller days still demand reef awareness and respect for the established lineup.',
      'Use Mākaha Beach Park parking and follow posted hours. Secure valuables and avoid blocking neighborhood access.',
      'Enter from the beach park and study the channel, current, and lineup before paddling. Ask lifeguards about hazards when surf is elevated.',
      'Look for organized northwest swell with light east wind. Sit wide until the current and shifting takeoff are clear.',
      'The lineup has a deep local history and defined rotation. Visitors should wait, observe, and avoid paddling straight to the peak.',
      'Mid or rising tide, light east wind, and a clean northwest swell provide the most organized conditions.',
      ARRAY['Winter surf can be life-threatening', 'Strong currents', 'Shallow reef', 'Respect the local lineup']::text[],
      'Show aloha, wait your turn, and do not treat the lineup as a tourist attraction.', 'high',
      ARRAY['Best for experienced surfers', 'Check with lifeguards', 'West-side wind shelter can preserve clean faces']::text[],
      false, false, 'point_break'::beach_persona, 1.05, 'HFO', NULL
    ),
    (
      'c18f586b-85fb-47d2-8e0a-7786cd1eb341'::uuid, 'White Plains', 'Ewa Beach', 'HI', 'USA',
      21.303600, -158.045000, 'beach', 'beginner',
      ARRAY['shorebreak', 'rip currents', 'crowds']::text[],
      ARRAY['beginner friendly', 'multiple sandbar peaks', 'parking', 'restrooms', 'showers']::text[],
      145, 245, 0, 45, 14, 10, 0.5, 2.5, 'either',
      '{"tide":"mid","primary_swell":{"dir_deg":195,"period_s":11},"noaa_grid":"HFO/146,142","noaa_offshore_shift_km":5}'::jsonb,
      180, 195, 50, ARRAY[4,5,6,7,8,9,10], 'white-plains', 'West Oahu', 'Pacific/Honolulu',
      'White Plains is a broad, forgiving beach break with several peaks and a long history as an Oʻahu learning beach. It is usually softer than the island’s reef breaks but can develop shorebreak and rips when south or west swell rises.',
      'Use the public beach parking lot and observe posted closing times. Weekends fill early.',
      'Walk through the beach park and choose a peak away from swimmers and surf lessons.',
      'A larger board helps on typical soft surf. Watch several sets because sandbar peaks and currents move.',
      'Give learners extra room and keep control of your board. Move to a quieter peak instead of crowding lessons.',
      'Small south to southwest swell, light north wind, and a moderate tide are the easiest setup.',
      ARRAY['Shorebreak increases with swell', 'Rip currents can form', 'Keep clear of swimmers']::text[],
      'Share the many peaks and give beginners a safe buffer.', 'moderate',
      ARRAY['Good learning option on small days', 'Multiple peaks spread the crowd', 'Conditions become serious when swell jumps']::text[],
      false, false, 'exposed_beach_break'::beach_persona, 0.95, 'HFO', NULL
    ),
    (
      '11fc4aab-e5d2-4439-a726-fd4bd31b6acd'::uuid, 'Laniakea', 'Haleiwa', 'HI', 'USA',
      21.618000, -158.086000, 'reef', 'intermediate-advanced',
      ARRAY['shallow reef', 'strong currents', 'turtles', 'traffic', 'localism']::text[],
      ARRAY['long right reef', 'north-shore winter swell', 'scenic beach']::text[],
      275, 45, 150, 40, 12, 9, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":325,"period_s":14},"noaa_grid":"HFO/143,160","noaa_offshore_shift_km":5}'::jsonb,
      315, 340, 65, ARRAY[10,11,12,1,2,3,4], 'laniakea', 'North Shore Oahu', 'Pacific/Honolulu',
      'Laniakea is a long North Shore right over reef with a shorter left and enough room to show several sections. It works on winter north and northwest swell and becomes powerful as period and size increase.',
      'Use legal roadside parking only and never stop in the travel lane. Expect congestion and pedestrian crossings.',
      'Cross Kamehameha Highway carefully, respect wildlife viewing areas, and use the channel after watching the current.',
      'Start on the shoulder and learn how the sections connect before moving toward the main takeoff.',
      'Crowds mix experienced regulars and visitors. Maintain rotation and stay clear of resting sea turtles.',
      'Mid to rising tide, light southeast wind, and an organized north-northwest swell.',
      ARRAY['Powerful winter surf', 'Shallow reef', 'Strong current', 'Do not approach sea turtles']::text[],
      'Respect lineup rotation, wildlife, residents, and highway safety.', 'high',
      ARRAY['Long right on the correct angle', 'Winter energy rises quickly', 'Roadside access requires care']::text[],
      false, false, 'point_break'::beach_persona, 1.05, 'HFO', NULL
    ),
    (
      'e12b9c1b-c500-47e0-a31c-3765736fe270'::uuid, 'Chun’s Reef', 'Haleiwa', 'HI', 'USA',
      21.613000, -158.094000, 'reef', 'intermediate',
      ARRAY['shallow reef', 'rip currents', 'crowds', 'localism']::text[],
      ARRAY['right and left reef peaks', 'longboard friendly when small']::text[],
      275, 45, 150, 40, 12, 9, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":325,"period_s":13},"noaa_grid":"HFO/143,160","noaa_offshore_shift_km":5}'::jsonb,
      315, 340, 65, ARRAY[10,11,12,1,2,3,4], 'chuns-reef', 'North Shore Oahu', 'Pacific/Honolulu',
      'Chun’s Reef offers approachable right and left reef waves on smaller North Shore days, with longer walls that suit mid-lengths and longboards. It becomes faster, heavier, and less forgiving as winter swell grows.',
      'Use legal roadside spaces without blocking driveways or traffic. Do not leave valuables visible.',
      'Follow established paths, watch the reef and current, and avoid crossing through private property.',
      'On small days, wait for the wider sets and trim through soft sections. Step back when winter power exceeds your ability.',
      'The friendlier reputation does not remove lineup rules. Wait your turn and give beginners room on the inside.',
      'Mid or rising tide, light southeast wind, and a moderate north-northwest swell.',
      ARRAY['Reef is shallow at low tide', 'Winter sets can be much larger', 'Road crossing hazard']::text[],
      'Use legal access, respect residents, and follow the established rotation.', 'high',
      ARRAY['More approachable than nearby expert reefs when small', 'Still carries North Shore power', 'Best with some tide over the reef']::text[],
      false, false, 'sheltered_reef'::beach_persona, 1.0, 'HFO', NULL
    ),
    (
      '24dd2e18-f3a6-466e-b082-cd974df852c4'::uuid, 'Tracks', 'Kapolei', 'HI', 'USA',
      21.354000, -158.131000, 'reef', 'intermediate',
      ARRAY['shallow reef', 'rip currents', 'remote access', 'localism']::text[],
      ARRAY['west-side reef peaks', 'northwest and south swell exposure']::text[],
      185, 340, 45, 45, 12, 9, 0.5, 2.5, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":260,"period_s":12},"noaa_grid":"HFO/141,145","noaa_offshore_shift_km":5}'::jsonb,
      225, 262, 78, ARRAY[10,11,12,1,2,3,6,7,8,9], 'tracks', 'West Oahu', 'Pacific/Honolulu',
      'Tracks is a west-side reef zone with shifting lefts and rights that can receive both wrapping northwest energy and summer south swell. Quality depends on swell angle, tide, and the current sand-and-reef setup.',
      'Use only legal public parking and obey railroad, utility, and posted access restrictions.',
      'Do not cross active rail infrastructure or private land. Use a verified public route and turn around if access is closed.',
      'Watch the lineup before entering because peaks shift and exposed reef changes the safe path.',
      'The setting feels open but the lineup is locally known. Keep a low profile and do not bring a large group.',
      'Moderate wrapping swell, light northeast wind, and a rising mid tide.',
      ARRAY['Access conditions can change', 'Shallow reef', 'Strong currents', 'Do not trespass']::text[],
      'Use public access only, pack out trash, and respect the local lineup.', 'moderate',
      ARRAY['Can receive swell from two seasons', 'Access must be confirmed', 'Reef knowledge matters']::text[],
      false, false, 'sheltered_reef'::beach_persona, 0.95, 'HFO', NULL
    ),
    (
      '8809c326-c194-4b6a-aba0-dd25102294a5'::uuid, 'Kewalo Basin', 'Honolulu', 'HI', 'USA',
      21.289000, -157.858000, 'reef', 'intermediate-advanced',
      ARRAY['shallow reef', 'boat traffic', 'harbor channel', 'crowds', 'localism']::text[],
      ARRAY['south-shore performance wave', 'left and right reef peaks', 'nearby parking']::text[],
      155, 225, 0, 35, 12, 8, 0.5, 2.5, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":190,"period_s":13},"noaa_grid":"HFO/154,142","noaa_offshore_shift_km":5}'::jsonb,
      180, 190, 35, ARRAY[4,5,6,7,8,9,10], 'kewalo-basin', 'South Shore Oahu', 'Pacific/Honolulu',
      'Kewalo Basin is a high-performance south-shore reef break with fast lefts and rights near the harbor entrance. A clean south swell can produce punchy walls, but the shallow reef and active boat channel demand awareness.',
      'Use legal Kewalo Basin or adjacent park parking. Observe event restrictions and secure valuables.',
      'Enter from the public shoreline and stay outside the marked harbor channel and vessel path.',
      'Choose a shoulder until you understand the peak and current. Never chase a wave into the navigation channel.',
      'This is a competitive town lineup. Wait your turn, communicate, and avoid paddling around the pack.',
      'Mid to rising tide, light north wind, and a clean south swell.',
      ARRAY['Active harbor traffic', 'Shallow reef', 'Competitive lineup', 'Strong south swell']::text[],
      'Yield to vessels, respect rotation, and keep the harbor channel clear.', 'high',
      ARRAY['Fast performance wave', 'Excellent on summer south swell', 'Boat traffic is a non-negotiable hazard']::text[],
      false, false, 'jetty_harbor'::beach_persona, 1.05, 'HFO', NULL
    ),
    (
      '943e369c-2180-4152-b457-26dbbbb9c23e'::uuid, 'Rocky Point', 'Pupukea', 'HI', 'USA',
      21.672000, -158.052000, 'reef', 'advanced',
      ARRAY['shallow reef', 'heavy surf', 'strong currents', 'crowds', 'localism']::text[],
      ARRAY['high-performance lefts and rights', 'north-shore winter swell']::text[],
      285, 45, 150, 35, 12, 8, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":330,"period_s":14},"noaa_grid":"HFO/145,163","noaa_offshore_shift_km":5}'::jsonb,
      330, 345, 60, ARRAY[10,11,12,1,2,3,4], 'rocky-point', 'North Shore Oahu', 'Pacific/Honolulu',
      'Rocky Point is a high-performance North Shore reef with fast lefts and rights and shifting takeoffs. It handles a useful range of winter swell but becomes heavy, shallow, and extremely competitive when solid.',
      'Use legal roadside parking without blocking traffic, bike lanes, or residences.',
      'Follow public paths and watch multiple sets before choosing an entry across the reef.',
      'Expect quick takeoffs and changing peaks. Do not paddle out when the speed or crowd exceeds your control.',
      'The lineup is packed with highly capable surfers. Rotation and situational awareness are essential.',
      'Mid to rising tide, light southeast wind, and an organized north-northwest swell.',
      ARRAY['Expert winter conditions', 'Shallow reef', 'Strong currents', 'Dense crowd']::text[],
      'Respect the peak, do not snake, and avoid bringing a large group.', 'high',
      ARRAY['Fast lefts and rights', 'Professional-level crowd when good', 'Reef gets unforgiving at low tide']::text[],
      false, false, 'exposed_beach_break'::beach_persona, 1.1, 'HFO', NULL
    ),
    (
      '32c84ce9-ba42-464c-afad-58e4c8664d1e'::uuid, 'Off the Wall', 'Pupukea', 'HI', 'USA',
      21.664000, -158.049000, 'reef', 'expert',
      ARRAY['very shallow reef', 'heavy barrels', 'strong currents', 'crowds', 'localism']::text[],
      ARRAY['powerful right barrels', 'pipeline reef complex']::text[],
      285, 30, 155, 30, 10, 7, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":325,"period_s":15},"noaa_grid":"HFO/145,162","noaa_offshore_shift_km":5}'::jsonb,
      330, 337, 52, ARRAY[10,11,12,1,2,3], 'off-the-wall', 'North Shore Oahu', 'Pacific/Honolulu',
      'Off the Wall is an expert-only barreling reef adjacent to Pipeline. It favors powerful winter swell and offers short, intense right-hand tubes over very shallow coral with little room for error.',
      'Use Ehukai Beach Park or other legal parking and never block Kamehameha Highway or residences.',
      'Approach from the public beach, identify the channel and current, and stay clear of Pipeline’s takeoff zones.',
      'Only paddle out with expert tube-riding, reef, and rescue judgment. Straightening out can be dangerous.',
      'Expect elite surfers and photographers. Visitors must stay out of the impact zone and wait for a clear opportunity.',
      'Mid tide, light southeast wind, and a strong north-northwest swell with clean lines.',
      ARRAY['Expert only', 'Very shallow reef', 'Heavy hold-downs', 'Powerful current']::text[],
      'Observe before entering, respect priority, and never endanger others by surfing beyond your ability.', 'high',
      ARRAY['Short intense barrels', 'Part of the Pipeline reef complex', 'Consequences are severe']::text[],
      false, false, 'canyon_amplified'::beach_persona, 1.15, 'HFO', NULL
    ),
    (
      '86710207-89d0-4d3d-a44b-36648d0e9588'::uuid, 'Makapuʻu', 'Waimanalo', 'HI', 'USA',
      21.311000, -157.660000, 'beach', 'upper-intermediate',
      ARRAY['powerful shorebreak', 'rip currents', 'rocks', 'strong trade wind']::text[],
      ARRAY['windward beach', 'consistent trade swell', 'lifeguards', 'parking']::text[],
      20, 145, 270, 45, 14, 10, 0.5, 2.5, 'either',
      '{"tide":"mid","primary_swell":{"dir_deg":75,"period_s":9},"noaa_grid":"HFO/165,145","noaa_offshore_shift_km":5}'::jsonb,
      90, 82, 63, ARRAY[4,5,6,7,8,9,10,11], 'makapuu', 'Windward Oahu', 'Pacific/Honolulu',
      'Makapuʻu is an exposed windward beach known for energetic shorebreak, bodysurfing, and short surfable peaks. Trade swell is frequent, but current, rocks, and heavy shorebreak make it unsuitable for novice board surfers when active.',
      'Use Makapuʻu Beach Park parking and observe posted hours. Lots fill on weekends and holidays.',
      'Check with lifeguards, identify swimming and bodysurfing zones, and choose an entry away from rocks.',
      'Look for lighter wind and organized east swell. Maintain control near shore because the shorebreak can be abrupt.',
      'Share space with bodysurfers and bodyboarders and stay out of designated swimming areas.',
      'Moderate east swell, light west wind, and a tide that keeps the shorebreak manageable.',
      ARRAY['Powerful shorebreak', 'Strong rip currents', 'Rock hazards', 'Trade winds can become rough']::text[],
      'Follow lifeguard direction and give other wave riders a wide safety buffer.', 'high',
      ARRAY['Consistent windward energy', 'Often better for bodyboarding than board surfing', 'Lifeguard advice is valuable']::text[],
      false, false, 'exposed_beach_break'::beach_persona, 1.0, 'HFO', NULL
    ),
    (
      '99c6a506-e4b7-42e4-be2d-c3afb303c22e'::uuid, 'Publics', 'Honolulu', 'HI', 'USA',
      21.271000, -157.814000, 'reef', 'intermediate',
      ARRAY['shallow reef', 'rocks', 'sea urchins', 'crowds']::text[],
      ARRAY['long left reef', 'summer south swell', 'near Waikiki']::text[],
      155, 225, 0, 35, 12, 8, 0.5, 2.5, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":190,"period_s":12},"noaa_grid":"HFO/156,141","noaa_offshore_shift_km":5}'::jsonb,
      180, 190, 35, ARRAY[4,5,6,7,8,9,10], 'publics', 'South Shore Oahu', 'Pacific/Honolulu',
      'Publics is a long south-shore left over shallow reef near Waikīkī. Summer south swell produces workable walls and connecting sections, while low tide exposes more coral and rock.',
      'Use legal Waikīkī or Kapiʻolani Park parking and expect metered or paid options.',
      'Use the public shoreline, identify the reef channel, and keep clear of swimmers and marked recreation zones.',
      'A mid or rising tide gives more margin over the reef. Stay on the shoulder until you understand the sections.',
      'Crowds include regulars and visitors. Hold a line, communicate, and do not drop in on the long left.',
      'Mid to rising tide, light north wind, and a clean south swell.',
      ARRAY['Shallow reef', 'Sea urchins', 'Crowds', 'Long paddle']::text[],
      'Respect the rotation and keep clear of swimmers and other ocean users.', 'high',
      ARRAY['Long left on summer swell', 'Reef is exposed at low tide', 'Town parking takes planning']::text[],
      false, false, 'sheltered_reef'::beach_persona, 1.0, 'HFO', NULL
    ),
    (
      'dc3e8490-9560-4713-8b87-dcc1a6a89c53'::uuid, 'Velzyland', 'Kahuku', 'HI', 'USA',
      21.692000, -158.002000, 'reef', 'advanced',
      ARRAY['shallow reef', 'fast barrels', 'strong currents', 'localism']::text[],
      ARRAY['fast right reef', 'north-shore winter wave']::text[],
      285, 50, 170, 35, 12, 8, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":340,"period_s":14},"noaa_grid":"HFO/149,164","noaa_offshore_shift_km":5}'::jsonb,
      15, 347, 62, ARRAY[10,11,12,1,2,3,4], 'velzyland', 'North Shore Oahu', 'Pacific/Honolulu',
      'Velzyland is a fast North Shore right that can deliver clean barrels and high-performance walls over shallow reef. The takeoff is compact and the wave becomes demanding as winter swell grows.',
      'Use legal public parking only and do not block residences, farm roads, or highway access.',
      'Follow a confirmed public route, avoid private land, and watch the current and reef before paddling.',
      'Commit to the takeoff and maintain speed, but step back if the shallow reef or crowd exceeds your experience.',
      'This is a locally established lineup with limited waves. Wait patiently and avoid arriving with a group.',
      'Mid to rising tide, light south wind, and an organized north-northwest swell.',
      ARRAY['Advanced only when active', 'Shallow reef', 'Fast barrel', 'Access must remain legal']::text[],
      'Use public access, wait your turn, and respect residents and regulars.', 'high',
      ARRAY['Fast right-hand wave', 'Best with tide over the reef', 'Limited takeoff magnifies crowd pressure']::text[],
      false, false, 'point_break'::beach_persona, 1.05, 'HFO', NULL
    ),
    (
      '486929f4-c8f8-4ae8-9b10-5ba1b7be7bcf'::uuid, 'Backyards', 'Kahuku', 'HI', 'USA',
      21.681000, -157.962000, 'reef', 'advanced',
      ARRAY['shallow reef', 'strong currents', 'large surf', 'localism']::text[],
      ARRAY['spread-out reef peaks', 'northeast exposure', 'winter swell']::text[],
      300, 80, 210, 40, 12, 9, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":20,"period_s":13},"noaa_grid":"HFO/151,163","noaa_offshore_shift_km":5}'::jsonb,
      30, 10, 70, ARRAY[10,11,12,1,2,3,4], 'backyards', 'North Shore Oahu', 'Pacific/Honolulu',
      'Backyards is a broad reef zone east of Sunset with multiple powerful peaks and exposure to north and northeast swell. The open playing field can look inviting, but currents, shifting peaks, and shallow reef require advanced judgment.',
      'Use legal public parking and respect resort, residential, and private-property boundaries.',
      'Enter only through confirmed public access and study the current because the lineup spans a wide reef.',
      'Choose a defined peak rather than drifting through the lineup. Keep enough energy for the return paddle.',
      'Spread out without sitting inside another group. Local knowledge matters across the shifting reef.',
      'Mid to rising tide, light southwest wind, and an organized north or northeast swell.',
      ARRAY['Powerful winter surf', 'Shallow reef', 'Strong lateral current', 'Access boundaries']::text[],
      'Respect access boundaries, established peaks, and the surfers already positioned there.', 'moderate',
      ARRAY['Wide multi-peak reef', 'Handles northeast angle', 'Current and distance add risk']::text[],
      false, false, 'exposed_beach_break'::beach_persona, 1.05, 'HFO', NULL
    ),
    (
      'b8e6da01-3696-4d18-b00f-e71081e7a8dc'::uuid, 'Pops', 'Honolulu', 'HI', 'USA',
      21.278000, -157.835000, 'reef', 'lower-intermediate',
      ARRAY['shallow reef', 'long paddle', 'canoe traffic', 'crowds']::text[],
      ARRAY['mellow Waikiki reef', 'longboard friendly', 'long rides']::text[],
      155, 225, 0, 40, 13, 9, 0.5, 2.5, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":190,"period_s":11},"noaa_grid":"HFO/155,141","noaa_offshore_shift_km":5}'::jsonb,
      180, 190, 35, ARRAY[4,5,6,7,8,9,10], 'pops', 'South Shore Oahu', 'Pacific/Honolulu',
      'Pops is a mellow outer Waikīkī reef with long, rolling walls that favor longboards and patient surfers. The long paddle and shared canoe routes are as important as the wave itself.',
      'Use legal Waikīkī parking or paid garages and allow time for the paddle.',
      'Launch from the public beach, identify marked channels, and stay alert for outrigger canoes and boats.',
      'Use a board with glide, sit wide, and conserve energy for the return paddle.',
      'Share waves, avoid clustering at the peak, and yield early to canoes in navigation routes.',
      'Mid to rising tide, light north wind, and a small clean south swell.',
      ARRAY['Long paddle', 'Shallow reef', 'Canoe and boat traffic', 'Changing wind']::text[],
      'Yield to canoes, communicate clearly, and keep the relaxed rotation moving.', 'moderate',
      ARRAY['Longboard-friendly outer reef', 'Long paddle', 'Good glide matters more than aggression']::text[],
      false, false, 'sheltered_reef'::beach_persona, 0.95, 'HFO', NULL
    ),
    (
      'b97ebd24-dcf6-49ce-a503-f678b4de0019'::uuid, 'Threes', 'Honolulu', 'HI', 'USA',
      21.279000, -157.838000, 'reef', 'intermediate',
      ARRAY['shallow reef', 'long paddle', 'boat traffic', 'crowds']::text[],
      ARRAY['quality right reef', 'summer south swell', 'long walls']::text[],
      160, 225, 0, 35, 12, 8, 0.5, 2.5, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":192,"period_s":12},"noaa_grid":"HFO/155,141","noaa_offshore_shift_km":5}'::jsonb,
      180, 192, 32, ARRAY[4,5,6,7,8,9,10], 'threes', 'South Shore Oahu', 'Pacific/Honolulu',
      'Threes is a quality Waikīkī-area right over reef that produces long walls on clean summer south swell. It is faster and more technical than the beginner breaks inside and requires a substantial paddle.',
      'Use legal Waikīkī or harbor-area parking and secure valuables.',
      'Paddle from a public beach, stay outside navigation lanes, and identify the channel before crossing the reef.',
      'Position on the shoulder first and learn the sections before moving deeper.',
      'The takeoff can be competitive. Maintain rotation and do not paddle around waiting surfers.',
      'Mid to rising tide, light north wind, and a clean south-southwest swell.',
      ARRAY['Long paddle', 'Shallow reef', 'Boat traffic', 'Competitive peak']::text[],
      'Respect priority, keep navigation routes clear, and help maintain a fair rotation.', 'high',
      ARRAY['Long right-hand walls', 'More technical than inside Waikiki', 'Paddle and reef knowledge required']::text[],
      false, false, 'sheltered_reef'::beach_persona, 1.0, 'HFO', NULL
    ),
    (
      '785980ea-6213-48bf-8571-55f3267bd2da'::uuid, 'Kaisers', 'Honolulu', 'HI', 'USA',
      21.283000, -157.842000, 'reef', 'advanced',
      ARRAY['shallow reef', 'fast wave', 'boat traffic', 'crowds', 'localism']::text[],
      ARRAY['fast right reef', 'Ala Wai harbor vicinity', 'summer south swell']::text[],
      165, 225, 0, 35, 11, 8, 0.5, 2.5, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":195,"period_s":13},"noaa_grid":"HFO/155,142","noaa_offshore_shift_km":5}'::jsonb,
      180, 195, 30, ARRAY[4,5,6,7,8,9,10], 'kaisers', 'South Shore Oahu', 'Pacific/Honolulu',
      'Kaisers is a fast, high-performance right near the Ala Wai harbor entrance. Clean south swell can produce steep walls and barrels over shallow reef, with boat traffic adding a serious navigation hazard.',
      'Use legal harbor or Waikīkī parking and observe marina restrictions.',
      'Enter from public shoreline access and remain clear of the marked harbor channel and all vessels.',
      'The takeoff is quick and the reef is close. Surf the shoulder until the line and exit are clear.',
      'Expect a compact, competitive lineup. Wait for a legitimate turn and never chase waves into the channel.',
      'Mid to rising tide, light north wind, and a clean south-southwest swell.',
      ARRAY['Active boat channel', 'Shallow reef', 'Fast takeoff', 'Competitive lineup']::text[],
      'Vessels always take priority; respect the lineup and keep the harbor entrance open.', 'high',
      ARRAY['Fast performance right', 'Excellent on south swell', 'Harbor traffic requires constant attention']::text[],
      false, false, 'jetty_harbor'::beach_persona, 1.05, 'HFO', NULL
    ),
    (
      '3bee4922-90ff-442c-b173-05c5ffa0e127'::uuid, 'Puaʻena Point', 'Haleiwa', 'HI', 'USA',
      21.598000, -158.104000, 'point', 'intermediate',
      ARRAY['shallow reef', 'strong currents', 'large outside sets', 'crowds']::text[],
      ARRAY['long right point', 'more sheltered north-shore option', 'near Haleiwa harbor']::text[],
      280, 45, 145, 40, 12, 9, 1.0, 3.0, 'rising',
      '{"tide":"mid rising","primary_swell":{"dir_deg":325,"period_s":13},"noaa_grid":"HFO/142,159","noaa_offshore_shift_km":5}'::jsonb,
      300, 342, 62, ARRAY[10,11,12,1,2,3,4], 'puaena-point', 'North Shore Oahu', 'Pacific/Honolulu',
      'Puaʻena Point is a long right near Haleʻiwa that is more sheltered than many North Shore reefs and can offer manageable walls on moderate winter swell. Larger sets still carry real North Shore power and current.',
      'Use legal Haleʻiwa Beach Park parking and avoid harbor operations and reserved spaces.',
      'Paddle from the public beach, stay clear of harbor traffic, and use the channel after watching several sets.',
      'Start inside or on the shoulder on moderate days. Outside conditions can be dramatically larger.',
      'Its approachable reputation attracts mixed abilities. Maintain rotation and give learners room inside.',
      'Mid to rising tide, light southeast wind, and a moderate north-northwest swell.',
      ARRAY['Outside sets can be powerful', 'Shallow reef', 'Current near harbor', 'Mixed-ability crowd']::text[],
      'Share the long peak, keep harbor routes clear, and do not underestimate outside sets.', 'high',
      ARRAY['More sheltered North Shore right', 'Useful step-up spot when moderate', 'Outside reef remains serious']::text[],
      false, false, 'point_break'::beach_persona, 1.0, 'HFO', NULL
    )
)
INSERT INTO public.beaches (
  id, name, city, state, country, lat, lon, break_type, skill_level,
  hazards, features, swell_window_min_deg, swell_window_max_deg,
  wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt,
  wind_onshore_bad_kt, preferred_tide_ft_min, preferred_tide_ft_max,
  preferred_tide_direction, preference_model, aspect_deg,
  swell_window_center_deg, swell_window_halfwidth_deg, best_months, slug,
  region, timezone, description, parking_tips, access_tips, wave_tips,
  crowd_tips, best_conditions_prose, warnings, local_etiquette, crowd_level,
  real_takeaways, is_private, cdip_eligible, persona, deepwater_decay_factor,
  nws_office, nws_forecast_zone
)
SELECT
  spot.id, spot.name, spot.city, spot.state, spot.country, spot.lat, spot.lon,
  spot.break_type, spot.skill_level, spot.hazards, spot.features,
  spot.swell_window_min_deg, spot.swell_window_max_deg, spot.wind_offshore_deg,
  spot.wind_offshore_tol_deg, spot.wind_cross_shore_ok_kt,
  spot.wind_onshore_bad_kt, spot.preferred_tide_ft_min,
  spot.preferred_tide_ft_max, spot.preferred_tide_direction,
  spot.preference_model, spot.aspect_deg, spot.swell_window_center_deg,
  spot.swell_window_halfwidth_deg, spot.best_months, spot.slug, spot.region,
  spot.timezone, spot.description, spot.parking_tips, spot.access_tips,
  spot.wave_tips, spot.crowd_tips, spot.best_conditions_prose, spot.warnings,
  spot.local_etiquette, spot.crowd_level, spot.real_takeaways, spot.is_private,
  spot.cdip_eligible, spot.persona, spot.deepwater_decay_factor,
  spot.nws_office, spot.nws_forecast_zone
FROM new_spots AS spot
WHERE NOT EXISTS (
  SELECT 1
  FROM public.beaches AS existing
  WHERE existing.slug = spot.slug
    AND existing.deleted_at IS NULL
);

UPDATE public.beaches
SET name = 'Haleʻiwa Aliʻi Beach',
    city = 'Haleiwa',
    region = 'North Shore Oahu',
    timezone = 'Pacific/Honolulu',
    preferred_tide_direction = COALESCE(preferred_tide_direction, 'rising'),
    persona = COALESCE(persona, 'point_break'::beach_persona),
    deepwater_decay_factor = COALESCE(deepwater_decay_factor, 1.05),
    description = 'Haleʻiwa Aliʻi Beach is the North Shore gateway reef at the west end of Haleʻiwa. Its powerful right wraps toward the harbor on winter north and northwest swell, with current, shallow inside reef, and a competitive takeoff requiring advanced judgment when size rises.',
    parking_tips = 'Use Haleʻiwa Aliʻi Beach Park parking and follow posted restrictions. Event days fill early.',
    access_tips = 'Enter from the public beach park, identify the channel and current, and stay clear of harbor traffic.',
    wave_tips = 'Watch several sets because the outside peak and inside sections change with size. Do not drift into the harbor route.',
    crowd_tips = 'The peak has an established rotation and becomes highly competitive during winter swell.',
    best_conditions_prose = 'Mid to rising tide, light southeast wind, and an organized north-northwest swell.',
    local_etiquette = 'Respect the established rotation, harbor traffic, park users, and the history of the Aliʻi Beach lineup.'
WHERE id = '43cfaf0d-0376-45cb-a8bd-78087ba4ee15'
  AND slug = 'haleiwa'
  AND deleted_at IS NULL;

-- Platform-hosted public live stream, verified live through YouTube on 2026-07-12.
INSERT INTO public.beach_sources (
  beach_id, camera_url, thumbnail_url, youtube_channel_handle,
  youtube_stream_title_hint
)
SELECT
  b.id,
  'https://www.youtube.com/watch?v=Bk2qxqAill8',
  'https://img.youtube.com/vi/Bk2qxqAill8/hqdefault.jpg',
  '@wozereme',
  'Ala Moana'
FROM public.beaches AS b
WHERE b.id = '80fc2c1b-2d3f-4a94-bcc2-c8ea0e9b8fc5'
  AND b.slug = 'ala-moana-bowls'
  AND b.deleted_at IS NULL
ON CONFLICT (beach_id)
DO UPDATE SET
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  youtube_channel_handle = EXCLUDED.youtube_channel_handle,
  youtube_stream_title_hint = EXCLUDED.youtube_stream_title_hint
WHERE public.beach_sources.camera_url IS NULL
   OR public.beach_sources.camera_url = ''
   OR public.beach_sources.camera_url = EXCLUDED.camera_url;

COMMIT;
