-- Reapply Virginia's public Atlantic surf catalog under a fresh migration version.
-- The original 20260830120000 version is tracked on production without its data effects.
-- Coordinates and spot identities are cross-checked against Surfline's public map;
-- access and safety copy uses City of Virginia Beach, NPS, and NWS guidance.

BEGIN;

CREATE TEMP TABLE _virginia_beaches (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  break_type text NOT NULL,
  skill_level text NOT NULL,
  hazards text[] NOT NULL,
  features text[] NOT NULL,
  description text NOT NULL,
  parking_tips text NOT NULL,
  access_tips text NOT NULL,
  wave_tips text NOT NULL,
  crowd_tips text NOT NULL,
  best_conditions_prose text NOT NULL,
  warnings text[] NOT NULL,
  crowd_level text NOT NULL,
  swell_min double precision NOT NULL,
  swell_max double precision NOT NULL,
  swell_center double precision NOT NULL,
  swell_halfwidth double precision NOT NULL,
  aspect double precision NOT NULL,
  offshore double precision NOT NULL,
  tide_min double precision NOT NULL,
  tide_max double precision NOT NULL,
  tide_stage text NOT NULL,
  tide_station text NOT NULL,
  nws_grid text NOT NULL,
  nws_zone text NOT NULL,
  v2_min double precision NOT NULL,
  v2_max double precision NOT NULL,
  v2_center double precision NOT NULL,
  v2_halfwidth double precision NOT NULL,
  persona public.beach_persona NOT NULL,
  editorial_sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _virginia_beaches VALUES
  (
    '49dcab29-7502-4835-b5f8-86716e7123f4', 'Assateague Beach (Virginia)',
    'assateague-beach-virginia-chincoteague-va', 'Chincoteague', 'Virginia Eastern Shore',
    37.8882, -75.3393, 'beach', 'intermediate',
    ARRAY['rip currents','longshore currents','shifting sandbars','remote shoreline','lightning'],
    ARRAY['National seashore','Wildlife refuge access','Restrooms seasonally','Undeveloped beach'],
    'The Virginia end of Assateague is an exposed Atlantic beach break with shifting sandbars and left and right peaks. Tropical swell and nor''easters produce the most useful surf, while ordinary summer days are often small and soft.',
    'Use the public Chincoteague National Wildlife Refuge beach parking and obey refuge closures, hours, and posted fees. Parking can fill during peak summer and pony-event periods.',
    'Reach the ocean only by the signed public refuge route. The map pin marks the surf zone, not a vehicle route or launch point; do not enter closed wildlife areas.',
    'Walk the shoreline to find a defined outer bar. The open beach accepts NE through S swell, but larger surf brings strong rips and longshore drift.',
    'The beach is broad enough to spread out. Keep clear of guarded swimming zones and anglers.',
    'Low to mid tide, W-NW wind, 3-7 ft E-SE swell',
    ARRAY['No lifeguards along much of the shoreline','Sandbars and channels change after storms','Follow NPS and refuge closures'],
    'moderate', 25, 190, 107.5, 82.5, 120, 300, -0.5, 2.5, 'low_to_mid', '8630413',
    'AKQ/119,102', 'VAZ099', 15, 225, 120, 105, 'exposed_beach_break',
    '[{"url":"https://www.surfline.com/surf-report/-assateague-beach/640a4473606c456797b1d7d7","kind":"spot_identity_and_coordinate"},{"url":"https://www.nps.gov/asis/planyourvisit/surf-and-beach-safety.htm","kind":"official_access_and_safety"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8630413","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/119,102","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '9a55000f-b70b-4318-bbe9-1347bd940b7f', 'North End',
    'north-end-virginia-beach-va', 'Virginia Beach', 'Virginia Beach',
    36.9102212316428, -75.98732471466064, 'beach', 'lower-intermediate',
    ARRAY['rip currents','shifting sandbars','shorebreak','crowds'],
    ARRAY['Public street access','Lifeguards only at posted seasonal zones','Multiple peaks','Longboard friendly on small days'],
    'North End covers the residential oceanfront north of the resort district. Its open sandbars are less structure-dependent than the city''s jetty breaks and can provide clean longboard peaks on small swell or faster walls when tropical and winter energy arrives.',
    'Use legal street parking and observe posted resident restrictions. Access and parking vary block by block; never block driveways or dune paths.',
    'Use signed public walkovers between 42nd Street and Fort Story. The coordinate is Surfline''s representative North End forecast point, not a single takeoff.',
    'Check several streets because the best bank moves. NE through S swell works, with W-SW wind cleaning the locally northeast-facing shoreline.',
    'Spread out among the many peaks and avoid concentrating at an occupied access.',
    'Mid tide, W-SW wind, 2-6 ft E-SE swell',
    ARRAY['Seasonal surfing and swimming rules vary by block','Strong rips develop on larger swell','Respect dunes and residential access'],
    'moderate', 25, 180, 102.5, 77.5, 75, 255, 0.75, 3, 'mid', '8639208',
    'AKQ/102,57', 'VAZ098', 330, 180, 75, 105, 'exposed_beach_break',
    '[{"url":"https://www.surfline.com/surf-report/north-end/5842041f4e65fad6a7708a23","kind":"spot_identity_and_coordinate"},{"url":"https://virginiabeach.gov/connect/blog/ocean-safety-beach-rules","kind":"official_access_and_safety"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639208","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/102,57","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '67d08afe-542e-4efb-9b78-c51e6ecfbf53', 'Virginia Beach Pier',
    'virginia-beach-pier-virginia-beach-va', 'Virginia Beach', 'Virginia Beach',
    36.84422, -75.97128, 'pier', 'intermediate',
    ARRAY['pier pilings','fishing lines','rip currents','shorebreak','seasonal restrictions'],
    ARRAY['Boardwalk access','Restrooms nearby','Surf cam nearby','Winter storm protection'],
    'The 15th Street fishing pier can organize a right on its south side during sizable nor''easters. The north-side shorebreak, known locally as The Box, can form fast small barrels when the sand is right and south swell reaches the resort beach.',
    'Use city garages, lots, or legal metered parking. Summer demand is high and the pier area is heavily enforced.',
    'Enter from signed public beach access and stay outside the legal setback from the pier. Daytime summer surfing restrictions can make this primarily a cold-season or off-hours break.',
    'Lower to mid tide is the safer starting window. Use the pier for wind protection, not as a paddle channel, and keep well clear of pilings and anglers.',
    'This is a compact, visible peak. Wait your turn and move away from the structure when swimmers or anglers reduce the safe area.',
    'Low to mid tide, W-SW wind, 3-7 ft E-SE swell',
    ARRAY['Surfing is restricted near the pier and during posted summer hours','Collision and fishing-line hazards','Check current city code before paddling out'],
    'crowded', 45, 180, 112.5, 67.5, 75, 255, 0, 2.75, 'low_to_mid', '8639208',
    'AKQ/103,54', 'VAZ098', 345, 165, 75, 90, 'jetty_harbor',
    '[{"url":"https://www.surfline.com/surf-report/virginia-beach-pier/5842041f4e65fad6a7708a27","kind":"spot_identity_coordinate_and_guide"},{"url":"https://cvb.virginiabeach.gov/resort-management/beach-rules","kind":"official_access_and_rules"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639208","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/103,54","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '5d9d578c-9f27-43eb-948a-ce23fa5e2aba', '1st Street Jetty (Virginia Beach)',
    '1st-street-jetty-virginia-beach-va', 'Virginia Beach', 'Virginia Beach',
    36.83135, -75.9677, 'jetty', 'lower-intermediate',
    ARRAY['rock jetty','rip currents','dense crowds','loose boards','inlet current'],
    ARRAY['Year-round designated surf zone','Restrooms nearby','Surf cams','Jetty-stabilized sandbar'],
    'First Street is Virginia Beach''s most established surf zone. The north jetty at Rudee Inlet traps sand and often produces a rideable right when nearby open beach is flat, with more push on E to SE tropical or nor''easter swell.',
    'Use legal Oceanfront parking or city lots and arrive early. Events and summer weekends can fill the area before dawn.',
    'Use the designated surf zone north of Rudee Inlet. Stay away from the rocks and inlet mouth, and follow posted contest or lifeguard boundaries.',
    'The spot works through much of the tide cycle, but sandbar shape matters more than the label. E-SE swell around 3-6 ft with W-SW wind is the established target.',
    'This is the city''s highest-pressure lineup. Control your board, do not paddle inside blindly, and yield clearly.',
    'All tides, W-SW wind, 3-6 ft E-SE swell',
    ARRAY['Very crowded when rideable','Jetty and inlet currents can pull south','Leash and seasonal city rules are enforced'],
    'very_crowded', 45, 180, 112.5, 67.5, 65, 245, -0.25, 4.5, 'all', '8639208',
    'AKQ/103,54', 'VAZ098', 355, 135, 65, 70, 'jetty_harbor',
    '[{"url":"https://www.surfline.com/surf-report/1st-street-jetty/584204214e65fad6a7709ce7","kind":"spot_identity_coordinate_and_guide"},{"url":"https://www.surfline.com/surf-news/spot-check-1st-street-jetty-virginia-beach/29500","kind":"specialist_swell_guidance"},{"url":"https://cvb.virginiabeach.gov/resort-management/beach-rules","kind":"official_access_and_rules"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639208","kind":"official_tide_predictions"}]'::jsonb
  ),
  (
    'f636e4b4-b76f-4305-aa5c-a35e796e14ec', 'Croatan Jetty',
    'croatan-jetty-virginia-beach-va', 'Virginia Beach', 'Virginia Beach',
    36.82827, -75.96778, 'jetty', 'intermediate',
    ARRAY['rock jetty','wooden groin','rip currents','shorebreak','crowds'],
    ARRAY['Public beach','Seasonal lifeguards','Restrooms nearby','Wind shelter from north jetty'],
    'Croatan Jetty is the north end of Croatan Beach, where a wooden groin and Rudee Inlet''s south jetty can bend swell into a predominantly left wedge. It is fickle but becomes punchier around high tide during nor''easters.',
    'Use the Croatan municipal lot or legal neighborhood parking. Fees and seasonal restrictions apply; never block residential access.',
    'Walk north from the public Croatan entrance. Stay clear of the jetty, groin, and inlet current.',
    'High tide is the established target. E-NE and SE energy can wedge, while W to NW wind offers the cleanest or most sheltered faces depending on the bar.',
    'The takeoff is compact and attracts mixed abilities. Give the inside wedge room and avoid straight-handing through the pack.',
    'High tide, W-NW wind, 4-7 ft E-SE swell',
    ARRAY['Submerged structure shifts with sand','Crowded and chaotic on good days','Strong current near Rudee Inlet'],
    'very_crowded', 60, 195, 127.5, 67.5, 127.5, 280, 2.5, 4.5, 'high', '8639208',
    'AKQ/104,51', 'VAZ098', 60, 195, 127.5, 67.5, 'jetty_harbor',
    '[{"url":"https://www.surfline.com/surf-report/croatan-jetty/584204214e65fad6a7709ce9","kind":"spot_identity_coordinate_guide_and_tide"},{"url":"https://virginiabeach.gov/connect/blog/ocean-safety-beach-rules","kind":"official_access_and_safety"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639208","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/104,51","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    'd18eb3aa-6647-4a92-a044-c352ea392d1b', 'Croatan Beach',
    'croatan-beach-virginia-beach-va', 'Virginia Beach', 'Virginia Beach',
    36.81843, -75.96608, 'beach', 'intermediate',
    ARRAY['rip currents','shifting sandbars','shorebreak','crowds','military boundary'],
    ARRAY['Municipal parking','Restrooms','Seasonal lifeguards','Surf lessons nearby'],
    'South Croatan is an open beach break beside Camp Pendleton. It favors SE tropical swell and offers more room than the jetty peak, with shifting outside bars that can produce left and right walls.',
    'Use the municipal lot at the end of Vanderbilt Avenue or legal neighborhood parking. Observe fees, hours, and residential signs.',
    'Enter from the public Croatan facility and stay between posted boundaries. Do not cross military fences or drift into restricted training areas.',
    'Mid to high tide is the useful starting range. Check the outside bar before committing; larger SE swell can be faster and stronger than the central Oceanfront.',
    'Lessons, residents, and visiting surfers share the zone. Move away from the main access when space is tight.',
    'Mid to high tide, W wind, 3-7 ft SE swell',
    ARRAY['Respect Camp Pendleton boundary markers','Currents strengthen on larger tropical swell','Seasonal surfing zones apply'],
    'crowded', 45, 180, 112.5, 67.5, 87.5, 267.5, 1.5, 4.5, 'mid_to_high', '8639208',
    'AKQ/104,52', 'VAZ098', 5, 170, 87.5, 82.5, 'exposed_beach_break',
    '[{"url":"https://www.surfline.com/surf-report/croatan/5842041f4e65fad6a7708a26","kind":"spot_identity_coordinate_and_guide"},{"url":"https://virginiabeach.gov/connect/blog/ocean-safety-beach-rules","kind":"official_access_and_safety"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639208","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/104,52","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '6ee5c419-ebaa-416f-8026-85b144767eba', 'Camp Pendleton',
    'camp-pendleton-virginia-beach-va', 'Virginia Beach', 'Virginia Beach',
    36.81735875786576, -75.96624, 'beach', 'intermediate',
    ARRAY['rip currents','outer sandbar','shorebreak','military boundary','crowds'],
    ARRAY['Public surfing area','Large nearby lot','Outside sandbar','Handles larger swell'],
    'The public Camp Pendleton surfing area sits beside the Virginia Army National Guard installation. Its outside sandbar can handle more E, SE, and S energy than First Street and may produce hollow sections when tide, period, and offshore wind align.',
    'Use the public surfing-area lot and verify current city access. Do not enter the military installation or use restricted roads.',
    'Follow the signed public beach corridor and boundary fencing. Training activity does not authorize entry onto base property.',
    'Lower to mid tide and W-SW wind are the established performance window. Larger tropical swell can create a demanding paddle and stronger rips.',
    'There is more room than at First Street, but the public zone still fills on summer swells. Keep clear of lessons and boundary markers.',
    'Low to mid tide, W-SW wind, 4-8 ft E-S swell',
    ARRAY['Public access is bounded by military property','Outer-bar currents can be strong','Verify posted training or emergency closures'],
    'crowded', 45, 180, 112.5, 67.5, 82.5, 262.5, -0.25, 2.5, 'low_to_mid', '8639208',
    'AKQ/104,52', 'VAZ098', 5, 160, 82.5, 77.5, 'exposed_beach_break',
    '[{"url":"https://www.surfline.com/surf-report/camp-pendleton/5842041f4e65fad6a7708a22","kind":"spot_identity_coordinate_guide_and_tide"},{"url":"https://virginiabeach.gov/connect/blog/ocean-safety-beach-rules","kind":"official_access_and_safety"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639208","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/104,52","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '7b08a935-aa5b-475f-a9a2-9f8b7ac6cd08', 'Sandbridge Beach',
    'sandbridge-beach-virginia-beach-va', 'Virginia Beach', 'Sandbridge',
    36.74626, -75.94224, 'beach', 'lower-intermediate',
    ARRAY['rip currents','shifting sandbars','shorebreak','coastal flooding'],
    ARRAY['Public beach facility','Parking','Restrooms','Outdoor showers'],
    'Sandbridge is a more open and less urban Atlantic beach south of the resort district. Shifting sandbars create left and right peaks, with the strongest opportunities during tropical swell and nor''easters.',
    'Use the city Sandbridge Beach Facility at 2549 Sandfiddler Road. Parking fees apply seasonally and lots fill on summer weekends.',
    'Beach access is directly across from the public facility. Stay on walkovers and protect the dunes.',
    'Check several bars along the beach. The spot has broad NE-through-S exposure and is cleanest with W-SW wind; use a neutral all-tide profile until the day''s sandbar shows a clear preference.',
    'The shoreline spreads people out. Avoid guarded swimming areas and private walkovers.',
    'All tides, W-SW wind, 2-7 ft E-SE swell',
    ARRAY['Storms can change access and sandbars quickly','Rip currents persist outside guarded areas','Follow coastal flooding and evacuation notices'],
    'moderate', 25, 180, 102.5, 77.5, 55, 235, -0.25, 4.75, 'all', '8639428',
    'AKQ/105,50', 'VAZ098', 340, 130, 55, 75, 'exposed_beach_break',
    '[{"url":"https://www.surfline.com/surf-report/sandbridge-beach/5842041f4e65fad6a7708a24","kind":"spot_identity_coordinate_and_guide"},{"url":"https://parks.virginiabeach.gov/outdoors/beach-boat-facilities/sandbridge-beach-facility","kind":"official_access"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639428","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/105,50","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    'b3c15951-443a-44c9-a415-7f0a40927164', 'S-Turn',
    's-turn-sandbridge-virginia-beach-va', 'Virginia Beach', 'Sandbridge',
    36.71948580300678, -75.93125917268634, 'beach', 'intermediate',
    ARRAY['rip currents','shifting sandbars','limited public parking','shorebreak'],
    ARRAY['Open beach break','Multiple peaks','Lower crowd than resort area'],
    'S-Turn is a named Sandbridge beach-break zone between the market area and Little Island. It shares the peninsula''s open Atlantic exposure but has no fixed structure, so quality depends heavily on the current bank.',
    'Use only legal public parking and signed beach access. Do not use private driveways or rental-home walkovers.',
    'The forecast coordinate identifies the surf zone, not a parking location. Confirm the nearest legal public access before arrival.',
    'Use a neutral all-tide profile and inspect the bank. W-SW wind cleans up NE-through-S swell; larger storm surf can produce fast closeouts and strong drift.',
    'Crowds are usually lighter than central Virginia Beach. Give residents and existing peaks space.',
    'All tides, W-SW wind, 3-7 ft E-SE swell',
    ARRAY['Public access and parking are limited','No guaranteed lifeguard at the forecast pin','Strong longshore drift in storm surf'],
    'moderate', 25, 180, 102.5, 77.5, 75, 255, -0.25, 4.75, 'all', '8639428',
    'AKQ/106,49', 'VAZ098', 340, 170, 75, 95, 'exposed_beach_break',
    '[{"url":"https://www.surfline.com/surf-report/s-turn/69f220ffd56708a0dc143599","kind":"spot_identity_and_coordinate"},{"url":"https://cvb.virginiabeach.gov/resort-management/beach-rules","kind":"official_regional_rules"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639428","kind":"official_tide_predictions"},{"url":"https://api.weather.gov/gridpoints/AKQ/106,49","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    'fcc2fcea-529b-4e0c-b745-f2505335b487', 'Little Island Fishing Pier',
    'little-island-fishing-pier-virginia-beach-va', 'Virginia Beach', 'Sandbridge',
    36.6941363, -75.92274, 'pier', 'lower-intermediate',
    ARRAY['pier pilings','fishing lines','rip currents','shorebreak'],
    ARRAY['City park','Large parking lot','Restrooms','Designated surfing beach north of pier'],
    'Little Island is the southern public anchor of Sandbridge. The fishing pier influences nearby sandbars, and the city maintains a surfing beach north of the structure with room for small-wave progression and stronger storm-swell peaks.',
    'Use Little Island Park at 3820 Sandpiper Road. Parking fees and facility hours vary by season.',
    'Use the signed surfing beach north of the pier and remain outside pier setbacks and fishing lines. Do not enter Back Bay refuge closures farther south.',
    'Use a neutral all-tide profile and select the best visible bank north of the pier. W-SW wind is cleanest; larger E-SE swell increases rip strength.',
    'The park attracts families, anglers, lessons, and surfers. Keep a wide buffer from the pier and guarded swimming zones.',
    'All tides, W-SW wind, 2-7 ft E-SE swell',
    ARRAY['Stay clear of pier pilings and anglers','Surf only in current designated zones','Rip currents strengthen during tropical and nor''easter swell'],
    'crowded', 25, 180, 102.5, 77.5, 75, 255, -0.25, 4.75, 'all', '8639428',
    'AKQ/106,47', 'VAZ098', 345, 165, 75, 90, 'jetty_harbor',
    '[{"url":"https://www.surfline.com/surf-report/little-island-fishing-pier/600b1f97b6558f622e14c0da","kind":"spot_identity_and_coordinate"},{"url":"https://virginiabeach.gov/connect/blog/seven-parks-and-natural-areas-to-visit-this-summer","kind":"official_access"},{"url":"https://dwr.virginia.gov/wp-content/uploads/media/March_April-2020_021320_final-magazine_ONLINE.pdf","kind":"official_surf_zone"},{"url":"https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8639428","kind":"official_tide_predictions"}]'::jsonb
  );

INSERT INTO public.beaches (
  id, name, slug, city, state, country, region, timezone, lat, lon,
  break_type, skill_level, hazards, features, description, parking_tips,
  access_tips, wave_tips, crowd_tips, best_conditions_prose, warnings,
  crowd_level, swell_window_min_deg, swell_window_max_deg,
  swell_window_center_deg, swell_window_halfwidth_deg, aspect_deg,
  wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt,
  wind_onshore_bad_kt, preferred_tide_ft_min, preferred_tide_ft_max,
  preferred_tide_direction, tide_direction_sensitivity, preference_model,
  best_months, nws_office, nws_forecast_zone, cdip_eligible, persona,
  deepwater_decay_factor, editorial_sources, editorial_reviewed_at,
  seo_indexable, is_private,
  swell_window_min_deg_v2, swell_window_max_deg_v2,
  swell_window_center_deg_v2, swell_window_halfwidth_deg_v2,
  swell_window_v2_method, swell_window_v2_analyzed_at
)
SELECT
  id, name, slug, city, 'VA', 'USA', region, 'America/New_York', lat, lon,
  break_type, skill_level, hazards, features, description, parking_tips,
  access_tips, wave_tips, crowd_tips, best_conditions_prose, warnings,
  crowd_level, swell_min, swell_max, swell_center, swell_halfwidth, aspect,
  offshore, 50, 12, 8, tide_min, tide_max, 'either', 'low',
  jsonb_build_object(
    'tide', tide_stage,
    'primary_swell', jsonb_build_object('dir_deg', swell_center, 'period_s', 10),
    'tide_calibration', jsonb_build_object(
      'station_id', tide_station,
      'datum', 'MLLW',
      'preferred_range_ft', jsonb_build_array(tide_min, tide_max),
      'hard_gate', false,
      'note', 'Published stage guidance is a soft ranking input; numeric bounds are calibrated to the local NOAA prediction range, not a safety cutoff.'
    ),
    'skill_validation', jsonb_build_object(
      'minimum_skill', skill_level,
      'conditions_dependent', true,
      'hard_safety_gate', false
    ),
    'forecast_anchors', jsonb_build_object(
      'marine_provider', 'open_meteo',
      'nws_grid', nws_grid,
      'nws_offshore_shift_km', 5,
      'ndbc_reference_buoy', '44014'
    ),
    'terrain_fingerprint', jsonb_build_object(
      'model', 'custom_spot_terrain_v1',
      'method', 'dem_horizon_v1',
      'dem_coverage_pct', 100,
      'bathymetric_amplification_claim', false,
      'note', 'Directional land exposure is modeled from coordinates; no unvalidated scalar bathymetric gain or loss is applied.'
    )
  ),
  ARRAY[8,9,10,11,12,1,2,3], 'AKQ', nws_zone, false, persona, 1.0,
  (
    SELECT jsonb_agg(
      source || jsonb_build_object(
        'publisher', CASE
          WHEN source->>'url' LIKE '%surfline.com%' THEN 'Surfline'
          WHEN source->>'url' LIKE '%nps.gov%' THEN 'National Park Service'
          WHEN source->>'url' LIKE '%tidesandcurrents.noaa.gov%' THEN 'NOAA CO-OPS'
          WHEN source->>'url' LIKE '%api.weather.gov%' THEN 'National Weather Service'
          WHEN source->>'url' LIKE '%dwr.virginia.gov%' THEN 'Virginia DWR'
          WHEN source->>'url' LIKE '%virginiabeach.gov%' THEN 'City of Virginia Beach'
          ELSE 'Virginia Beach Parks'
        END,
        'retrievedAt', '2026-08-30'
      )
    )
    FROM jsonb_array_elements(editorial_sources) AS source
  ),
  '2026-08-30T00:00:00Z'::timestamptz, true, false,
  v2_min, v2_max, v2_center, v2_halfwidth,
  'dem_horizon_v1_coordinate_fingerprint', '2026-08-30T00:00:00Z'::timestamptz
FROM _virginia_beaches
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  region = EXCLUDED.region,
  timezone = EXCLUDED.timezone,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  break_type = EXCLUDED.break_type,
  skill_level = EXCLUDED.skill_level,
  hazards = EXCLUDED.hazards,
  features = EXCLUDED.features,
  description = EXCLUDED.description,
  parking_tips = EXCLUDED.parking_tips,
  access_tips = EXCLUDED.access_tips,
  wave_tips = EXCLUDED.wave_tips,
  crowd_tips = EXCLUDED.crowd_tips,
  best_conditions_prose = EXCLUDED.best_conditions_prose,
  warnings = EXCLUDED.warnings,
  crowd_level = EXCLUDED.crowd_level,
  swell_window_min_deg = EXCLUDED.swell_window_min_deg,
  swell_window_max_deg = EXCLUDED.swell_window_max_deg,
  swell_window_center_deg = EXCLUDED.swell_window_center_deg,
  swell_window_halfwidth_deg = EXCLUDED.swell_window_halfwidth_deg,
  aspect_deg = EXCLUDED.aspect_deg,
  wind_offshore_deg = EXCLUDED.wind_offshore_deg,
  wind_offshore_tol_deg = EXCLUDED.wind_offshore_tol_deg,
  wind_cross_shore_ok_kt = EXCLUDED.wind_cross_shore_ok_kt,
  wind_onshore_bad_kt = EXCLUDED.wind_onshore_bad_kt,
  preferred_tide_ft_min = EXCLUDED.preferred_tide_ft_min,
  preferred_tide_ft_max = EXCLUDED.preferred_tide_ft_max,
  preferred_tide_direction = EXCLUDED.preferred_tide_direction,
  tide_direction_sensitivity = EXCLUDED.tide_direction_sensitivity,
  preference_model = EXCLUDED.preference_model,
  best_months = EXCLUDED.best_months,
  nws_office = EXCLUDED.nws_office,
  nws_forecast_zone = EXCLUDED.nws_forecast_zone,
  cdip_eligible = EXCLUDED.cdip_eligible,
  persona = EXCLUDED.persona,
  deepwater_decay_factor = EXCLUDED.deepwater_decay_factor,
  editorial_sources = EXCLUDED.editorial_sources,
  editorial_reviewed_at = EXCLUDED.editorial_reviewed_at,
  seo_indexable = EXCLUDED.seo_indexable,
  is_private = EXCLUDED.is_private,
  swell_window_min_deg_v2 = EXCLUDED.swell_window_min_deg_v2,
  swell_window_max_deg_v2 = EXCLUDED.swell_window_max_deg_v2,
  swell_window_center_deg_v2 = EXCLUDED.swell_window_center_deg_v2,
  swell_window_halfwidth_deg_v2 = EXCLUDED.swell_window_halfwidth_deg_v2,
  swell_window_v2_method = EXCLUDED.swell_window_v2_method,
  swell_window_v2_analyzed_at = EXCLUDED.swell_window_v2_analyzed_at,
  deleted_at = NULL;

WITH terrain_factors (beach_id, swell_factors, wind_factors, coordinate_hash) AS (
  VALUES
    ('49dcab29-7502-4835-b5f8-86716e7123f4'::uuid, ARRAY[0.315835,0.385762,0.47117,0.575489,0.740404,0.92398,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.118812,0.052097,0.022627,0.022627,0.020645,0.01668,0.01668,0.020645,0.022627,0.022627,0.022627,0.022627,0.022627,0.024876,0.029374,0.058843,0.121061,0.173334,0.21171,0.258584]::real[], ARRAY[0.932883,0.93378,0.934091,0.934292,0.934556,0.934883,0.935029,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935024,0.934822,0.93429,0.933691,0.932691,0.930969,0.929666,0.929205,0.929387,0.929858,0.929421,0.928677,0.928931,0.929709,0.930191,0.92998,0.929133,0.928742,0.928988,0.928944,0.928959,0.929177,0.929485,0.929861,0.929774,0.929885,0.930452,0.930748,0.930838,0.931532]::real[], '68adfde34f6e10a757ee5f332f715db30162ec44808e3853937fb462a63bca0c'),
    ('9a55000f-b70b-4318-bbe9-1347bd940b7f'::uuid, ARRAY[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.116829,0.046149,0.014697,0.014697,0.014697,0.014697,0.014697,0.014697,0.014697,0.014697,0.013023,0.011348,0.013023,0.014697,0.014697,0.046149,0.116829,0.173334,0.21171,0.258584,0.315835,0.385762,0.47117,0.575489,0.740404,0.92398,1,1,1]::real[], ARRAY[0.935027,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935027,0.935018,0.93501,0.935008,0.935008,0.935008,0.935008,0.935008,0.935008,0.935008,0.935008,0.935008,0.935014,0.935023,0.935025,0.935024,0.935023,0.935022,0.935022,0.935007,0.934951,0.934712,0.934124,0.933252,0.932412,0.930937,0.928552,0.926617,0.924669,0.922498,0.92143,0.920939,0.920258,0.919292,0.918324,0.917449,0.917079,0.918443,0.920144,0.920764,0.919215,0.915756,0.915259,0.916877,0.917077,0.918099,0.919557,0.92054,0.921585,0.922503,0.925202,0.929039,0.932014,0.933837,0.934549,0.934819,0.934957,0.934991,0.935012]::real[], 'e77c5a2061d8774efab3959c0d4ca78edcc7ff5d4a23a3f2ea7cd3de454ffd3f'),
    ('67d08afe-542e-4efb-9b78-c51e6ecfbf53'::uuid, ARRAY[0.771941,0.771941,0.847961,0.740404,0.601309,0.601309,0.740404,0.92398,1,1,1,1,1,1,1,0.92398,0.740404,0.632847,0.740404,0.92398,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.113155,0.035126,0.000707,0.002121,0.002828,0.002828,0.002828,0.002121,0.000707,0,0,0,0.000707,0.003414,0.005414,0.007088,0.008763,0.005088,0.000707,0,0.000707,0.03654,0.113862,0.173334,0.21171,0.258584,0.315835,0.385762,0.47117,0.575489,0.740404,0.847961]::real[], ARRAY[0.850532,0.882737,0.893092,0.874458,0.856941,0.762564,0.702412,0.809673,0.869268,0.869268,0.91311,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.923857,0.90151,0.898358,0.917552,0.931878,0.935031,0.935031,0.928176,0.914468,0.914468,0.928176,0.932255,0.929479,0.932255,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.929754,0.91908,0.899039,0.861337]::real[], '0d86c69ac37c1ec4c8cba49a1568fb976f5bfd03511ffd10d1f324da7c839167'),
    ('5d9d578c-9f27-43eb-948a-ce23fa5e2aba'::uuid, ARRAY[0.740404,0.92398,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.518131,0.575489,0.740404,0.92398,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.113862,0.037247,0.010027,0.017226,0.010027,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.037247,0.113862,0.173334,0.21171,0.258584,0.315835,0.385762,0.47117,0.575489]::real[], ARRAY[0.934894,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.932702,0.928046,0.925717,0.925717,0.925717,0.925717,0.925717,0.918083,0.902816,0.895182,0.887167,0.853868,0.670096,0.477458,0.569942,0.716163,0.75796,0.802358,0.827385,0.832619,0.82232,0.797378,0.822593,0.897533,0.935002,0.934941,0.934849,0.934581,0.933261,0.932311,0.932297,0.93207,0.9332,0.934606,0.934853,0.934834,0.934736,0.934605,0.934517,0.934668,0.93472,0.934599,0.934697,0.934875,0.934904,0.934917,0.934946,0.934901,0.931827,0.925184,0.924501,0.931095]::real[], '4d5b64ce67dd73d67f9222cb18723082934a8ae0586c58bfe465766c083382b4'),
    ('f636e4b4-b76f-4305-aa5c-a35e796e14ec'::uuid, ARRAY[0.575489,0.740404,0.92398,0.92398,0.847961,0.92398,1,0.92398,0.740404,0.575489,0.49231,0.49231,0.575489,0.740404,0.92398,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.632847,0.740404,0.847961,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.113862,0.037247,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002121,0.001414,0.03654,0.113862,0.173334,0.21171,0.258584,0.315835,0.385762,0.47117]::real[], ARRAY[0.248035,0.186687,0.210527,0.293141,0.278832,0.241754,0.339783,0.535842,0.48234,0.179278,0.027747,0.118326,0.219205,0.149226,0.068946,0.060231,0.042801,0.034086,0.034697,0.03592,0.036531,0.261156,0.710406,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.910088,0.860202,0.860202,0.910006,0.934783,0.934781,0.934947,0.935031,0.935025,0.934986,0.934926,0.934893,0.934888,0.934633,0.933273,0.932326,0.933572,0.93479,0.934958,0.934955,0.934887,0.934356,0.931033,0.925924,0.923538,0.923369,0.921823,0.91883,0.91731,0.912886,0.899229,0.878072,0.855247,0.69438,0.408896]::real[], 'e64930730d7f7f2ec84e7852113251b30b28e2f182ea8ebcad7288e28d819e0d'),
    ('d18eb3aa-6647-4a92-a044-c352ea392d1b'::uuid, ARRAY[0.47117,0.575489,0.740404,0.92398,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.115155,0.039833,0.003414,0.000707,0.000707,0.002121,0.002828,0.002121,0.000707,0,0,0,0.000707,0.001414,0.000707,0.000707,0.005088,0.008763,0.005796,0.002828,0.002828,0.002828,0.002828,0.002828,0.037247,0.113862,0.173334,0.21171,0.258584,0.315835,0.385762]::real[], ARRAY[0.929025,0.933644,0.934495,0.934954,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.934974,0.929986,0.923576,0.924951,0.927075,0.925812,0.923728,0.920372,0.918267,0.917022,0.915789,0.916385,0.917869,0.916212,0.910986,0.908048,0.908081,0.907949,0.906257,0.903307,0.903327,0.905962,0.907193,0.908345,0.910555,0.912448,0.914304,0.915626,0.915122,0.913569,0.913422,0.915231,0.917543,0.919185,0.920647,0.923218,0.926567,0.928893,0.926174,0.923857]::real[], '0ce336d2a573b4ca66aacd4d075704e591c63bbaf9f3eeca8d0edb539c3a20c1'),
    ('6ee5c419-ebaa-416f-8026-85b144767eba'::uuid, ARRAY[0.47117,0.575489,0.740404,0.92398,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.121061,0.051645,0.010027,0.004121,0.004707,0.002,0,0,0,0,0,0,0,0,0,0,0.000707,0.001414,0.002707,0.006,0.006,0.005674,0.008056,0.005796,0.002121,0.001414,0.03654,0.113862,0.173334,0.21171,0.258584,0.315835,0.385762]::real[], ARRAY[0.883699,0.8995,0.91146,0.912271,0.91518,0.92058,0.923291,0.923312,0.92243,0.920651,0.919761,0.91976,0.921514,0.925026,0.926782,0.926206,0.925053,0.924477,0.924477,0.924477,0.924477,0.924281,0.923888,0.921726,0.917793,0.915825,0.91582,0.915788,0.915725,0.91568,0.915636,0.91884,0.925252,0.928026,0.926566,0.924193,0.918872,0.905292,0.890613,0.886344,0.887122,0.887288,0.887596,0.887629,0.876791,0.85534,0.844664,0.844515,0.844239,0.843942,0.84391,0.847142,0.853257,0.856133,0.855932,0.855957,0.855941,0.861475,0.872745,0.878091,0.877789,0.877958,0.877675,0.880236,0.891976,0.905973,0.911552,0.911999,0.912375,0.91292,0.908048,0.891051]::real[], '939192713f540e85a545913104dfc92108c64a73a6b898e4997bff9feafa8436'),
    ('7b08a935-aa5b-475f-a9a2-9f8b7ac6cd08'::uuid, ARRAY[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.116829,0.048131,0.022894,0.025142,0.018928,0.013023,0.008381,0.004121,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.037247,0.113862,0.173334,0.21171,0.258584,0.315835,0.385762,0.47117,0.575489,0.740404,0.92398,1]::real[], ARRAY[0.934895,0.934987,0.934993,0.935019,0.935031,0.935031,0.935031,0.935014,0.93498,0.934971,0.934985,0.934994,0.935008,0.935025,0.935031,0.935031,0.935031,0.935031,0.935031,0.934993,0.934916,0.934663,0.934238,0.933998,0.933711,0.933168,0.932558,0.931962,0.931744,0.93174,0.931631,0.931651,0.924669,0.912709,0.909692,0.915089,0.922176,0.924675,0.922722,0.921113,0.919955,0.919789,0.918599,0.916089,0.915438,0.915928,0.915943,0.914574,0.912885,0.913613,0.914876,0.914153,0.913231,0.913893,0.914729,0.915001,0.915242,0.915464,0.915459,0.916221,0.91837,0.920645,0.92257,0.923441,0.923779,0.925548,0.928124,0.929883,0.931278,0.932888,0.934011,0.934567]::real[], '77fcb99b3c7571e741a8624ed616745c1321159c97033ad46bc8df5898dd3470'),
    ('b3c15951-443a-44c9-a415-7f0a40927164'::uuid, ARRAY[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.21171,0.173334,0.116829,0.043182,0.005796,0.002828,0.002828,0.004121,0.006707,0.008,0.006707,0.004121,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.002828,0.034134,0.103833,0.15797,0.192945,0.235664,0.287841,0.351569,0.429408,0.52448,0.674777,0.864241,0.977841,1]::real[], ARRAY[0.93484,0.934933,0.934929,0.934932,0.934938,0.934962,0.935008,0.935028,0.935018,0.935005,0.935001,0.935004,0.935012,0.935016,0.935016,0.935014,0.934999,0.934974,0.934963,0.934951,0.934931,0.934912,0.93489,0.934877,0.934877,0.934898,0.934935,0.934956,0.934966,0.934969,0.934898,0.934657,0.934088,0.9332,0.932081,0.930805,0.928985,0.926764,0.925538,0.924584,0.923658,0.923432,0.922691,0.921174,0.918332,0.916737,0.918696,0.920867,0.920108,0.910168,0.894494,0.88651,0.894524,0.910901,0.917671,0.917707,0.918541,0.91943,0.920918,0.922016,0.923123,0.924486,0.924811,0.924768,0.926304,0.928969,0.931282,0.932345,0.932985,0.933987,0.934533,0.934646]::real[], '46764e7ed4a4cfdc83a09e762c3f648ef5a4e52d7963aafd73d6d1afb8a6925f'),
    ('fcc2fcea-529b-4e0c-b745-f2505335b487'::uuid, ARRAY[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.92398,0.740404,0.575489,0.47117,0.385762,0.315835,0.258584,0.216565,0.206247,0.235664,0.287841,0.351569,0.429408,0.52448,0.674777,0.772801,0.674777,0.560637,0.588684,0.740404,0.92398,1,0.92398,0.740404,0.575489,0.47117,0.447773,0.439857,0.320595,0.21171,0.173334,0.156058,0.173334,0.21171,0.258584,0.315835,0.385762,0.47117,0.575489,0.740404,0.92398]::real[], ARRAY[0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.935031,0.934824,0.934212,0.932818,0.930546,0.928681,0.928516,0.929314,0.929873,0.928757,0.925073,0.922631,0.923506,0.925205,0.925563,0.92439,0.925207,0.92818,0.92923,0.927997,0.926691,0.926313,0.925351,0.923423,0.922363,0.920902,0.918245,0.916463,0.914681,0.912768,0.913346,0.916284,0.919647,0.923207,0.927522,0.930863,0.932065,0.931987,0.932282,0.933948,0.935031,0.935031]::real[], 'a6ca71e8e6fc47d04ff56ed0dea6170da82aa94da044507e04ec86f7a7ca9f96')
)
UPDATE public.beaches AS b
SET
  swell_access_factors = terrain.swell_factors,
  wind_exposure_factors = terrain.wind_factors,
  terrain_method = 'dem_horizon_v1',
  terrain_params = '{"max_radius_m":5000,"blockage_threshold_m":3000,"swell_ray_length_m":3500,"step_m":60,"angle_mid":8,"k":3,"min_exposure":0.15,"wrap_lambda":0.04,"max_wrap_angle":45,"smoothing_kernel":[0.25,0.5,0.25],"dem_source":"aws_terrarium_z12","resolution_m":30,"near_far_split_m":500}'::jsonb,
  terrain_params_hash = 'c8d4e197287448c53dd42b1024ee878722e6908f71c4930a560946f727706af5',
  terrain_analyzed_at = '2026-08-30T00:00:00Z'::timestamptz,
  wind_analyzed_at = '2026-08-30T00:00:00Z'::timestamptz,
  swell_analyzed_at = '2026-08-30T00:00:00Z'::timestamptz,
  terrain_status = 'ok',
  terrain_enabled = true,
  terrain_analysis_debug = jsonb_build_object(
    'analysis_metadata', jsonb_build_object('dem_coverage_pct', 100),
    'coordinate_hash', terrain.coordinate_hash,
    'model_version', 'custom_spot_terrain_v1'
  )
FROM terrain_factors AS terrain
WHERE b.id = terrain.beach_id;

WITH photo_library (
  photo_key, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html
) AS (
  VALUES
    ('assateague', 'File:Beach at Assateague VA.JPG', 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Beach_at_Assateague_VA.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Beach_at_Assateague_VA.JPG/1280px-Beach_at_Assateague_VA.JPG', 'Beach at Assateague VA', 'Ivy Main', 'https://commons.wikimedia.org/wiki/File:Beach_at_Assateague_VA.JPG', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'Photo by Ivy Main, licensed CC BY-SA 3.0 via Wikimedia Commons.'),
    ('north_end', 'File:Ocean waves in Virginia Beach, VA.jpg', 'https://upload.wikimedia.org/wikipedia/commons/3/34/Ocean_waves_in_Virginia_Beach%2C_VA.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Ocean_waves_in_Virginia_Beach%2C_VA.jpg/1280px-Ocean_waves_in_Virginia_Beach%2C_VA.jpg', 'Ocean waves in Virginia Beach, VA', 'Bruce Emmerling', 'https://commons.wikimedia.org/wiki/User:Bruce_Emmerling', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Photo by Bruce Emmerling, licensed CC BY-SA 4.0 via Wikimedia Commons.'),
    ('pier', 'File:Virginia Beach Fishing pier.jpg', 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Virginia_Beach_Fishing_pier.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Virginia_Beach_Fishing_pier.jpg/1280px-Virginia_Beach_Fishing_pier.jpg', 'Virginia Beach Fishing pier', 'JBTHEMILKER', 'https://commons.wikimedia.org/wiki/User:JBTHEMILKER', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Photo by JBTHEMILKER, licensed CC BY-SA 4.0 via Wikimedia Commons.'),
    ('rudee', 'File:Rudee Inlet Jetty (235126577).jpeg', 'https://upload.wikimedia.org/wikipedia/commons/8/88/Rudee_Inlet_Jetty_%28235126577%29.jpeg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Rudee_Inlet_Jetty_%28235126577%29.jpeg/1280px-Rudee_Inlet_Jetty_%28235126577%29.jpeg', 'Rudee Inlet Jetty', 'Randy Everette', 'https://500px.com/halfgig57', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'Photo by Randy Everette, licensed CC BY-SA 3.0 via Wikimedia Commons.'),
    ('croatan', 'File:Croatan Beach looking north toward Rudee Inlet.jpg', 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Croatan_Beach_looking_north_toward_Rudee_Inlet.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Croatan_Beach_looking_north_toward_Rudee_Inlet.jpg/1280px-Croatan_Beach_looking_north_toward_Rudee_Inlet.jpg', 'Croatan Beach looking north toward Rudee Inlet', 'Lago Mar', 'https://commons.wikimedia.org/wiki/File:Croatan_Beach_looking_north_toward_Rudee_Inlet.jpg', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Photo by Lago Mar, licensed CC BY-SA 4.0 via Wikimedia Commons.'),
    ('sandbridge', 'File:Sandbridge Hurricane and Beach Proection and Beach Renourishment (9142128047).jpg', 'https://upload.wikimedia.org/wikipedia/commons/4/48/Sandbridge_Hurricane_and_Beach_Proection_and_Beach_Renourishment_%289142128047%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Sandbridge_Hurricane_and_Beach_Proection_and_Beach_Renourishment_%289142128047%29.jpg/1280px-Sandbridge_Hurricane_and_Beach_Proection_and_Beach_Renourishment_%289142128047%29.jpg', 'Sandbridge beach renourishment', 'U.S. Army Corps of Engineers Norfolk District', 'https://www.flickr.com/people/29327036@N03', 'Public domain', 'https://commons.wikimedia.org/wiki/Template:PD-USGov-Military-Army-USACE', 'Public-domain photo by the U.S. Army Corps of Engineers Norfolk District via Wikimedia Commons.'),
    ('little_island', 'File:Little Island Park beach looking south LR.jpg', 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Little_Island_Park_beach_looking_south_LR.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Little_Island_Park_beach_looking_south_LR.jpg/1280px-Little_Island_Park_beach_looking_south_LR.jpg', 'Little Island Park beach looking south', 'PumpkinSky', 'https://commons.wikimedia.org/wiki/User:PumpkinSky', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Photo by PumpkinSky, licensed CC BY-SA 4.0 via Wikimedia Commons.')
),
photo_assignments (beach_id, photo_key) AS (
  VALUES
    ('49dcab29-7502-4835-b5f8-86716e7123f4'::uuid, 'assateague'),
    ('9a55000f-b70b-4318-bbe9-1347bd940b7f'::uuid, 'north_end'),
    ('67d08afe-542e-4efb-9b78-c51e6ecfbf53'::uuid, 'pier'),
    ('5d9d578c-9f27-43eb-948a-ce23fa5e2aba'::uuid, 'rudee'),
    ('f636e4b4-b76f-4305-aa5c-a35e796e14ec'::uuid, 'croatan'),
    ('d18eb3aa-6647-4a92-a044-c352ea392d1b'::uuid, 'croatan'),
    ('6ee5c419-ebaa-416f-8026-85b144767eba'::uuid, 'croatan'),
    ('7b08a935-aa5b-475f-a9a2-9f8b7ac6cd08'::uuid, 'sandbridge'),
    ('b3c15951-443a-44c9-a415-7f0a40927164'::uuid, 'sandbridge'),
    ('fcc2fcea-529b-4e0c-b745-f2505335b487'::uuid, 'little_island')
)
INSERT INTO public.beach_photos (
  beach_id, source, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html, approved, deleted_at
)
SELECT
  assignment.beach_id, 'wikimedia', photo.source_id, photo.image_url,
  photo.thumb_url, photo.title, photo.creator_name, photo.creator_url,
  photo.license_code, photo.license_url, photo.attribution_html, true, NULL::timestamptz
FROM photo_assignments AS assignment
JOIN photo_library AS photo USING (photo_key)
ON CONFLICT (beach_id, source, source_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  thumb_url = EXCLUDED.thumb_url,
  title = EXCLUDED.title,
  creator_name = EXCLUDED.creator_name,
  creator_url = EXCLUDED.creator_url,
  license_code = EXCLUDED.license_code,
  license_url = EXCLUDED.license_url,
  attribution_html = EXCLUDED.attribution_html,
  approved = true,
  deleted_at = NULL,
  fetched_at = now();


INSERT INTO public.beach_sources (beach_id, forecast_source_id)
SELECT id, 'open_meteo'
FROM _virginia_beaches
ON CONFLICT (beach_id) DO UPDATE SET
  forecast_source_id = EXCLUDED.forecast_source_id;

WITH camera_assignments (beach_id, camera_url, thumbnail_url) AS (
  VALUES
    ('9a55000f-b70b-4318-bbe9-1347bd940b7f'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-northendva/playlist.m3u8', 'https://camstills.cdn-surfline.com/us-east-2/ec-northendva/latest_small.jpg'),
    ('67d08afe-542e-4efb-9b78-c51e6ecfbf53'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-15thstpiervb/playlist.m3u8', 'https://camstills.cdn-surfline.com/us-east-2/ec-15thstpiervb/latest_small.jpg'),
    ('5d9d578c-9f27-43eb-948a-ce23fa5e2aba'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-vbfirstfixed/playlist.m3u8', 'https://camstills.cdn-surfline.com/us-east-2/ec-vbfirstfixed/latest_small.jpg'),
    ('f636e4b4-b76f-4305-aa5c-a35e796e14ec'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-croatanjetties/playlist.m3u8', 'https://camstills.cdn-surfline.com/us-east-2/ec-croatanjetties/latest_small.jpg'),
    ('d18eb3aa-6647-4a92-a044-c352ea392d1b'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-croatanpendleton/playlist.m3u8', 'https://camstills.cdn-surfline.com/us-east-2/ec-croatanpendleton/latest_small.jpg'),
    ('6ee5c419-ebaa-416f-8026-85b144767eba'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-croatanpendleton/playlist.m3u8', 'https://camstills.cdn-surfline.com/us-east-2/ec-croatanpendleton/latest_small.jpg')
)
INSERT INTO public.beach_sources (
  beach_id, forecast_source_id, camera_url, thumbnail_url
)
SELECT beach_id, 'open_meteo', camera_url, thumbnail_url
FROM camera_assignments
ON CONFLICT (beach_id) DO UPDATE SET
  forecast_source_id = EXCLUDED.forecast_source_id,
  camera_url = EXCLUDED.camera_url,
  thumbnail_url = EXCLUDED.thumbnail_url;

DO $$
DECLARE
  imported_count integer;
  ready_count integer;
  camera_count integer;
BEGIN
  SELECT count(*) INTO imported_count
  FROM public.beaches
  WHERE id IN (SELECT id FROM _virginia_beaches);

  SELECT count(*) INTO ready_count
  FROM public.beaches AS b
  WHERE b.id IN (SELECT id FROM _virginia_beaches)
    AND b.timezone = 'America/New_York'
    AND b.seo_indexable IS TRUE
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(b.editorial_sources) AS source
      WHERE NULLIF(source->>'url', '') IS NOT NULL
        AND NULLIF(source->>'publisher', '') IS NOT NULL
        AND NULLIF(source->>'retrievedAt', '') IS NOT NULL
    )
    AND b.terrain_enabled IS TRUE
    AND b.terrain_status = 'ok'
    AND array_length(b.swell_access_factors, 1) = 72
    AND array_length(b.wind_exposure_factors, 1) = 72
    AND EXISTS (
      SELECT 1 FROM public.beach_photos AS photo
      WHERE photo.beach_id = b.id
        AND photo.source = 'wikimedia'
        AND photo.approved IS TRUE
        AND photo.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.beach_sources AS source
      WHERE source.beach_id = b.id
        AND source.forecast_source_id = 'open_meteo'
    );

  SELECT count(*) INTO camera_count
  FROM public.beach_sources AS source
  JOIN (
    VALUES
      ('9a55000f-b70b-4318-bbe9-1347bd940b7f'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-northendva/playlist.m3u8'),
      ('67d08afe-542e-4efb-9b78-c51e6ecfbf53'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-15thstpiervb/playlist.m3u8'),
      ('5d9d578c-9f27-43eb-948a-ce23fa5e2aba'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-vbfirstfixed/playlist.m3u8'),
      ('f636e4b4-b76f-4305-aa5c-a35e796e14ec'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-croatanjetties/playlist.m3u8'),
      ('d18eb3aa-6647-4a92-a044-c352ea392d1b'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-croatanpendleton/playlist.m3u8'),
      ('6ee5c419-ebaa-416f-8026-85b144767eba'::uuid, 'https://hls.cdn-surfline.com/ohio/ec-croatanpendleton/playlist.m3u8')
  ) AS expected(beach_id, camera_url)
    ON expected.beach_id = source.beach_id
   AND expected.camera_url = source.camera_url;

  IF imported_count <> 10 OR ready_count <> 10 OR camera_count <> 6 THEN
    RAISE EXCEPTION 'Virginia surf import validation failed: imported %, ready %, cameras %', imported_count, ready_count, camera_count;
  END IF;
END $$;

COMMIT;
