-- Add six researched Humboldt County surf locations with explicit promotion gates.
-- College Cove remains closed; Clam Beach remains unvalidated for surf recommendations.

BEGIN;

ALTER TABLE public.beaches
  ADD COLUMN IF NOT EXISTS recommendation_eligible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.beaches.recommendation_eligible IS
  'Whether the beach may enter positive recommendation candidate pools; map and direct forecast visibility are independent.';

ALTER TABLE public.beach_photos
  DROP CONSTRAINT IF EXISTS beach_photos_source_check;
ALTER TABLE public.beach_photos
  ADD CONSTRAINT beach_photos_source_check
  CHECK (source IN ('openverse', 'flickr', 'unsplash', 'pexels', 'wikimedia', 'user', 'google_places', 'ai_generated'));

CREATE TEMP TABLE _humboldt_beaches (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  city text NOT NULL,
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
  tide_min double precision,
  tide_max double precision,
  tide_stage text NOT NULL,
  tide_station text NOT NULL,
  tide_note text NOT NULL,
  nws_grid text NOT NULL,
  nws_used_lat double precision NOT NULL,
  nws_used_lon double precision NOT NULL,
  persona public.beach_persona NOT NULL,
  recommendation_ready boolean NOT NULL,
  eligibility_reason text NOT NULL,
  seo_indexable boolean NOT NULL,
  best_months integer[] NOT NULL,
  editorial_sources jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO _humboldt_beaches VALUES
  (
    'c0024ced-d774-4e5f-b580-1bc8cb8da136', 'Moonstone Beach / Little River',
    'moonstone-beach-ca', 'Trinidad', 41.0259, -124.1170, 'beach', 'lower-intermediate',
    ARRAY['cold water','rip currents','sneaker waves','shifting sandbars','river mouth currents'],
    ARRAY['Public beach access','Portable restroom','Little River estuary','Beginner-friendly on small days'],
    'Moonstone is a public, west-facing sand beach at the Little River mouth. It is one of Humboldt County''s most established surf beaches, with shifting left and right peaks that range from approachable on small days to powerful in winter swell.',
    'Use the county parking area and obey posted hours. Parking is limited and there is no day-use fee.',
    'Enter from the signed county access. The map pin marks a representative surf zone, not a fixed takeoff or river crossing.',
    'W to NW swell and E to NE wind are the useful starting pattern. Tide reports conflict, so the stored range is deliberately broad and should be treated as a ranking input rather than a cutoff.',
    'Spread out across the available peaks and give lessons and newer surfers room on smaller days.',
    'Broad tide window, E-NE wind, 2-6 ft W-NW swell',
    ARRAY['Cold water requires appropriate thermal protection','Sneaker waves and rips occur year-round','River-mouth bars and currents change after storms'],
    'moderate', 250, 330, 290, 40, 270, 90, NULL, NULL, 'all', '9419059',
    'Published guides disagree on the preferred stage. Keep the qualitative all-stage profile and leave numeric heights unset pending local observations.',
    'EKA/64,118', 41.02588, -124.17660, 'exposed_beach_break', true,
    'Official public access, established surf use, specialist condition guidance, complete forecast inputs, terrain fingerprint, and licensed hero media.',
    true, ARRAY[3,4,5,9,10,11],
    '[{"url":"https://humboldtgov.org/Facilities/Facility/Details/Moonstone-Beach-14","kind":"official_access_and_surf_use"},{"url":"https://www.surfline.com/surf-report/moonstone-beach/640a3faab6d7692d595138e8/spot-guide","kind":"spot_identity_coordinate_and_guide"},{"url":"https://surftrips.co/united-states/california/moonstone-beach","kind":"specialist_conditions_cross_check"},{"url":"https://tidesandcurrents.noaa.gov/datums.html?id=9419059","kind":"official_tide_station"},{"url":"https://api.weather.gov/gridpoints/EKA/64,118","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '23aff192-60ef-4c11-96df-2140e1d59369', 'Houda Point / Camel Rock',
    'houda-point-camel-rock-ca', 'Trinidad', 41.0483, -124.1310, 'reef', 'intermediate',
    ARRAY['cold water','submerged rocks','rip currents','sneaker waves','cliff-backed shoreline'],
    ARRAY['Land-trust access','Maintained bluff trails','Rocky cove','Lower-tide surf opportunity'],
    'Houda Point and Camel Rock form a rocky, partially sheltered surf zone north of Moonstone. The land-trust access page identifies lower-tide swell as the established surf opportunity; the representative pin sits in the nearshore surf zone rather than at the bluff parking area.',
    'Use the Trinidad Coastal Land Trust parking and signed trail system. Do not park on vegetation or block neighboring access.',
    'Use one of the maintained Houda Point trails and inspect the return route before paddling out. Do not treat the map pin as a navigation route down the bluff.',
    'Lower tide exposes more of the working setup. W to NW swell and E to NE wind are a terrain-supported regional starting point, not a local-session calibration.',
    'The usable takeoff area can be compact. Give established surfers space and avoid paddling out beyond your rock-entry experience.',
    'Lower tide, E-NE wind, 2-6 ft W-NW swell',
    ARRAY['Rock entries and submerged hazards require local judgment','Rising water can reduce beach exits','Cold water, sneaker waves, and rips are persistent North Coast hazards'],
    'moderate', 250, 330, 290, 40, 280, 95, NULL, NULL, 'low', '9419059',
    'The land manager explicitly associates surf use with lower tides; numeric heights remain unset pending local observations.',
    'EKA/64,119', 41.04828, -124.19062, 'sheltered_reef', true,
    'Official access and surf-use evidence, coordinate and terrain review, complete forecast inputs, and an explicitly illustrative fallback hero image.',
    true, ARRAY[3,4,5,9,10,11],
    '[{"url":"https://www.trinidadcoastallandtrust.org/houda-point.html","kind":"official_access_ownership_and_low_tide_surf_use"},{"url":"https://www.openstreetmap.org/?mlat=41.0483&mlon=-124.1310#map=16/41.0483/-124.1310","kind":"coordinate_and_landform_cross_check"},{"url":"https://tidesandcurrents.noaa.gov/datums.html?id=9419059","kind":"official_tide_station"},{"url":"https://api.weather.gov/gridpoints/EKA/64,119","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '402ec6ad-4e80-47d2-882f-5053eb9aa433', 'Trinidad State Beach',
    'trinidad-state-beach-ca', 'Trinidad', 41.05816, -124.15049, 'beach', 'intermediate',
    ARRAY['cold water','rip currents','sneaker waves','submerged rocks','shifting sandbars'],
    ARRAY['State park access','Parking','Restrooms','Protected cove setting'],
    'Trinidad State Beach is a public cove and beach/reef surf zone below Trinidad Head. West-southwest through northwest swell can reach the cove, while surrounding headlands create meaningful directional shelter.',
    'Use signed State Parks parking and observe sunrise-to-sunset day-use hours and posted restrictions.',
    'Use open signed trails only. College Cove access is separately closed; do not use the closed trail as an alternate route.',
    'Low tide is the documented starting stage. E wind is cleanest, but rocks, rips, and changing sand make every session conditions-dependent.',
    'The protected setting can concentrate surfers when exposed beaches are blown out. Share the limited peaks and keep clear of swimmers.',
    'Low tide, E wind, 2-6 ft WSW-NW swell',
    ARRAY['Cold water and sneaker waves can be fatal','Rips and submerged rocks are present','College Cove access trail is closed'],
    'moderate', 230, 320, 275, 45, 285, 90, NULL, NULL, 'low', '9419059',
    'Published guidance favors low tide; numeric heights remain unset pending local observations.',
    'EKA/63,120', 41.05814, -124.21012, 'sheltered_reef', true,
    'Current State Parks access and hazard evidence, established surf-guide coverage, complete forecast inputs, terrain fingerprint, and licensed hero media.',
    true, ARRAY[9,10,11,12,1,2,3],
    '[{"url":"https://www.parks.ca.gov/?page_id=418","kind":"official_access_facilities_closure_and_surf_use"},{"url":"https://www.surfline.com/surf-report/trinidad-state-beach/640a3fab606c458564b0a46f","kind":"spot_identity_and_coordinate"},{"url":"https://www.surf-forecast.com/breaks/Trinidad-State-Beach","kind":"specialist_conditions_and_hazards"},{"url":"https://tidesandcurrents.noaa.gov/datums.html?id=9419059","kind":"official_tide_station"},{"url":"https://api.weather.gov/gridpoints/EKA/63,120","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    'cb488223-4397-415c-a4f4-cdf3845dc241', 'Samoa Dunes Surf Area',
    'samoa-dunes-surf-area-ca', 'Samoa', 40.7668424692, -124.23107, 'jetty', 'advanced',
    ARRAY['cold water','powerful surf','rip currents','sneaker waves','jetty rocks','harbor entrance currents'],
    ARRAY['BLM recreation area','Exposed beach break','Jetty-influenced sandbar','Large-swell capability'],
    'The Samoa Dunes surf area is the exposed beach immediately north of Humboldt Bay''s North Jetty. The jetty-influenced sandbar can organize powerful surf, but the active harbor entrance, currents, and large-wave exposure make this an advanced location.',
    'Use legal BLM recreation-area parking and follow posted vehicle and dune rules. Check tide, weather, and marine warnings before leaving the lot.',
    'Access the beach from the recreation area. Stay off the North Jetty: BLM states that it is unsafe for recreation and does not manage the structure.',
    'W to NW swell and SE wind are the established target. A low-to-mid profile is a soft starting range; swell size, period, currents, and the current sandbar control suitability.',
    'The peak can be consequential and localized. Do not crowd the jetty corner or enter without advanced cold-water and current experience.',
    'Low to mid tide, SE wind, 5-12 ft W-NW swell',
    ARRAY['Stay off the North Jetty','Large waves can wash over the beach and rocks','Harbor and rip currents can overwhelm experienced surfers'],
    'moderate', 260, 330, 295, 35, 270, 135, NULL, NULL, 'low_to_mid', '9418767',
    'Specialist guidance favors low to mid tide; numeric heights remain unset pending local observations and never override marine warnings.',
    'EKA/58,107', 40.76683, -124.29044, 'jetty_harbor', true,
    'Official public access and jetty warning, established specialist surf guidance, complete forecast inputs, terrain fingerprint, and licensed hero media.',
    true, ARRAY[9,10,11,12,1,2],
    '[{"url":"https://www.blm.gov/visit/samoa-dunes","kind":"official_access_and_jetty_warning"},{"url":"https://www.surfline.com/surf-report/north-jetty/5842041f4e65fad6a77089bc","kind":"spot_identity_coordinate_and_guide"},{"url":"https://surftrips.co/united-states/california/north-jetty","kind":"specialist_conditions_cross_check"},{"url":"https://tidesandcurrents.noaa.gov/benchmarks/9418767.html","kind":"official_tide_station"},{"url":"https://api.weather.gov/gridpoints/EKA/58,107","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '1182a4ff-0a3c-49f2-9d67-58ba9351b2ac', 'College Cove',
    'college-cove-ca', 'Trinidad', 41.067, -124.1517, 'beach', 'intermediate',
    ARRAY['closed access trail','cold water','rip currents','sneaker waves','submerged rocks'],
    ARRAY['Sheltered cove','State park shoreline','Currently closed access trail'],
    'College Cove is a sheltered cove within Trinidad State Beach, but its access trail is closed because of erosion. The spot is retained for map and closure awareness and must not be recommended or indexed while the closure remains in effect.',
    'Do not park for or attempt access to College Cove while the closure is posted. Use other open public beaches.',
    'The College Cove access trail is closed from the Elkhead Loop intersection; pedestrians are subject to citation. Do not route around barriers or descend the bluff.',
    'No surf window is promoted while access is closed. Directional fields describe the cove geometry only and are not an invitation to enter.',
    'Not applicable while access is closed.',
    'Closed—do not access or promote',
    ARRAY['Access trail closed for erosion','Pedestrians may be cited','Do not bypass barriers or use informal bluff routes'],
    'unknown', 230, 320, 275, 45, 270, 90, NULL, NULL, 'unvalidated', '9419059',
    'Tide suitability is intentionally uncalibrated while access is closed.',
    'EKA/63,120', 41.06698, -124.21134, 'sheltered_reef', false,
    'Promotion disabled because the official access trail is closed for erosion.',
    false, ARRAY[9,10,11,12,1,2,3],
    '[{"url":"https://parks.ca.gov/post/52","kind":"official_access_closure"},{"url":"https://www.parks.ca.gov/?page_id=418","kind":"official_park_status"},{"url":"https://www.surfline.com/surf-report/college-cove/640a3fad99dd448108033544","kind":"spot_identity_and_coordinate"},{"url":"https://tidesandcurrents.noaa.gov/datums.html?id=9419059","kind":"official_tide_station"},{"url":"https://api.weather.gov/gridpoints/EKA/63,120","kind":"official_forecast_grid"}]'::jsonb
  ),
  (
    '2c8a869b-6a53-40db-ba23-a6316d6f4965', 'Clam Beach',
    'clam-beach-ca', 'McKinleyville', 40.9985, -124.1190, 'beach', 'intermediate',
    ARRAY['cold water','rip currents','sneaker waves','shorebreak','shifting sandbars'],
    ARRAY['County beach access','Parking','Restrooms','Open exposed shoreline'],
    'Clam Beach is a broad, exposed public sand beach north of the Little River. County access and facilities are verified, but reliable spot-level surf, tide, and skill guidance is too limited to promote it as a recommendation.',
    'Use the county north or south lots or legal roadside parking. Observe campground and day-use signs.',
    'Use signed public access and protect the dunes. The map pin marks a representative surf zone, not a stable sandbar.',
    'W to NW swell and E to SE wind are a geometry-based starting pattern only. Tide preference and suitability require local validation before recommendation eligibility.',
    'The long beach offers room, but avoid swimmers, anglers, and any active rip channels.',
    'Uncalibrated—inspect conditions locally',
    ARRAY['Surf suitability is not locally validated','Cold water, rips, and sneaker waves occur year-round','Sandbars change after storms'],
    'unknown', 250, 330, 290, 40, 270, 110, NULL, NULL, 'unvalidated', '9419059',
    'No defensible spot-level tide preference was found; leave numeric bounds unset pending local observations.',
    'EKA/64,117', 40.99848, -124.17858, 'exposed_beach_break', false,
    'Promotion disabled pending local validation of skill suitability and tide behavior.',
    false, ARRAY[9,10,11,12,1,2,3],
    '[{"url":"https://www.humboldtgov.org/Facilities/Facility/Details/Clam-Beach-4","kind":"official_public_access_and_facilities"},{"url":"https://www.saltybed.com/spots/qryU/clam-beach/surf-guide","kind":"limited_specialist_directional_guidance"},{"url":"https://tidesandcurrents.noaa.gov/datums.html?id=9419059","kind":"official_tide_station"},{"url":"https://api.weather.gov/gridpoints/EKA/64,117","kind":"official_forecast_grid"}]'::jsonb
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
  seo_indexable, recommendation_eligible, is_private, swell_window_min_deg_v2,
  swell_window_max_deg_v2, swell_window_center_deg_v2,
  swell_window_halfwidth_deg_v2, swell_window_v2_method,
  swell_window_v2_analyzed_at
)
SELECT
  id, name, slug, city, 'CA', 'USA', 'Humboldt County', 'America/Los_Angeles', lat, lon,
  break_type, skill_level, hazards, features, description, parking_tips,
  access_tips, wave_tips, crowd_tips, best_conditions_prose, warnings,
  crowd_level, swell_min, swell_max, swell_center, swell_halfwidth, aspect,
  offshore, 45, 12, 8, tide_min, tide_max, 'either',
  CASE WHEN tide_min IS NULL THEN NULL ELSE 'low' END,
  jsonb_build_object(
    'tide', tide_stage,
    'primary_swell', jsonb_build_object('dir_deg', swell_center, 'period_s', 11),
    'recommendation_ready', recommendation_ready,
    'eligibility_reason', eligibility_reason,
    'tide_calibration', CASE
      WHEN tide_min IS NULL THEN jsonb_build_object(
        'station_id', tide_station, 'datum', 'MLLW', 'status', 'unvalidated',
        'hard_gate', false, 'note', tide_note
      )
      ELSE jsonb_build_object(
        'station_id', tide_station, 'datum', 'MLLW',
        'preferred_range_ft', jsonb_build_array(tide_min, tide_max),
        'hard_gate', false, 'note', tide_note
      )
    END,
    'skill_validation', jsonb_build_object(
      'minimum_skill', skill_level,
      'status', CASE WHEN slug = 'clam-beach-ca' THEN 'pending_local_validation' ELSE 'editorially_validated' END,
      'conditions_dependent', true,
      'hard_safety_gate', slug = 'samoa-dunes-surf-area-ca'
    ),
    'forecast_anchors', jsonb_build_object(
      'marine_provider', 'open_meteo',
      'nws_grid', nws_grid,
      'nws_original_coordinate', jsonb_build_array(lat, lon),
      'nws_used_coordinate', jsonb_build_array(nws_used_lat, nws_used_lon),
      'nws_offshore_shift_km', 5,
      'nws_offshore_bearing_deg', 270
    ),
    'terrain_fingerprint', jsonb_build_object(
      'model', 'custom_spot_terrain_v1',
      'method', 'dem_horizon_v1',
      'dem_coverage_pct', 100,
      'bathymetric_amplification_claim', false,
      'note', 'Directional land exposure is modeled from coordinates; no unvalidated scalar bathymetric gain or loss is applied.'
    )
  ),
  best_months, 'EKA', 'CAZ103', false, persona, 1.0,
  (
    SELECT jsonb_agg(
      source || jsonb_build_object(
        'publisher', CASE
          WHEN source->>'url' LIKE '%humboldtgov.org%' THEN 'Humboldt County'
          WHEN source->>'url' LIKE '%trinidadcoastallandtrust.org%' THEN 'Trinidad Coastal Land Trust'
          WHEN source->>'url' LIKE '%parks.ca.gov%' THEN 'California State Parks'
          WHEN source->>'url' LIKE '%blm.gov%' THEN 'Bureau of Land Management'
          WHEN source->>'url' LIKE '%surfline.com%' THEN 'Surfline'
          WHEN source->>'url' LIKE '%surftrips.co%' THEN 'SurfTrips'
          WHEN source->>'url' LIKE '%surf-forecast.com%' THEN 'Surf-Forecast'
          WHEN source->>'url' LIKE '%saltybed.com%' THEN 'SaltyBed'
          WHEN source->>'url' LIKE '%openstreetmap.org%' THEN 'OpenStreetMap contributors'
          WHEN source->>'url' LIKE '%tidesandcurrents.noaa.gov%' THEN 'NOAA CO-OPS'
          ELSE 'National Weather Service'
        END,
        'retrievedAt', '2026-09-02'
      )
    )
    FROM jsonb_array_elements(
      editorial_sources || jsonb_build_array(jsonb_build_object(
        'url', 'https://www.weather.gov/media/eka/Beach_Safety_Brochure_2022.pdf',
        'kind', 'official_regional_beach_hazards'
      ))
    ) AS source
  ),
  '2026-09-02T00:00:00Z'::timestamptz, seo_indexable, recommendation_ready, false,
  swell_min, swell_max, swell_center, swell_halfwidth,
  'dem_horizon_v1_coordinate_fingerprint', '2026-09-02T00:00:00Z'::timestamptz
FROM _humboldt_beaches
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, slug = EXCLUDED.slug, city = EXCLUDED.city,
  state = EXCLUDED.state, country = EXCLUDED.country, region = EXCLUDED.region,
  timezone = EXCLUDED.timezone, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
  break_type = EXCLUDED.break_type, skill_level = EXCLUDED.skill_level,
  hazards = EXCLUDED.hazards, features = EXCLUDED.features,
  description = EXCLUDED.description, parking_tips = EXCLUDED.parking_tips,
  access_tips = EXCLUDED.access_tips, wave_tips = EXCLUDED.wave_tips,
  crowd_tips = EXCLUDED.crowd_tips,
  best_conditions_prose = EXCLUDED.best_conditions_prose,
  warnings = EXCLUDED.warnings, crowd_level = EXCLUDED.crowd_level,
  swell_window_min_deg = EXCLUDED.swell_window_min_deg,
  swell_window_max_deg = EXCLUDED.swell_window_max_deg,
  swell_window_center_deg = EXCLUDED.swell_window_center_deg,
  swell_window_halfwidth_deg = EXCLUDED.swell_window_halfwidth_deg,
  aspect_deg = EXCLUDED.aspect_deg, wind_offshore_deg = EXCLUDED.wind_offshore_deg,
  wind_offshore_tol_deg = EXCLUDED.wind_offshore_tol_deg,
  wind_cross_shore_ok_kt = EXCLUDED.wind_cross_shore_ok_kt,
  wind_onshore_bad_kt = EXCLUDED.wind_onshore_bad_kt,
  preferred_tide_ft_min = EXCLUDED.preferred_tide_ft_min,
  preferred_tide_ft_max = EXCLUDED.preferred_tide_ft_max,
  preferred_tide_direction = EXCLUDED.preferred_tide_direction,
  tide_direction_sensitivity = EXCLUDED.tide_direction_sensitivity,
  preference_model = EXCLUDED.preference_model, best_months = EXCLUDED.best_months,
  nws_office = EXCLUDED.nws_office, nws_forecast_zone = EXCLUDED.nws_forecast_zone,
  cdip_eligible = EXCLUDED.cdip_eligible, persona = EXCLUDED.persona,
  deepwater_decay_factor = EXCLUDED.deepwater_decay_factor,
  editorial_sources = EXCLUDED.editorial_sources,
  editorial_reviewed_at = EXCLUDED.editorial_reviewed_at,
  seo_indexable = EXCLUDED.seo_indexable, is_private = EXCLUDED.is_private,
  recommendation_eligible = EXCLUDED.recommendation_eligible,
  swell_window_min_deg_v2 = EXCLUDED.swell_window_min_deg_v2,
  swell_window_max_deg_v2 = EXCLUDED.swell_window_max_deg_v2,
  swell_window_center_deg_v2 = EXCLUDED.swell_window_center_deg_v2,
  swell_window_halfwidth_deg_v2 = EXCLUDED.swell_window_halfwidth_deg_v2,
  swell_window_v2_method = EXCLUDED.swell_window_v2_method,
  swell_window_v2_analyzed_at = EXCLUDED.swell_window_v2_analyzed_at,
  deleted_at = NULL;

WITH terrain_factors (beach_id, swell_factors, wind_factors, coordinate_hash) AS (
  VALUES
    ('c0024ced-d774-4e5f-b580-1bc8cb8da136'::uuid, ARRAY[0.2971,0.2432,0.1991,0.163,0.1168,0.0642,0.0391,0.0341,0.0294,0.0271,0.0271,0.0249,0.0226,0.0226,0.0226,0.0226,0.0226,0.0226,0.0226,0.0226,0.0226,0.0249,0.0294,0.0316,0.0316,0.0341,0.0638,0.1235,0.1733,0.2117,0.2586,0.3158,0.3858,0.4712,0.5755,0.7404,0.924,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.9852,0.8839,0.6964,0.5413,0.4432,0.3628]::real[], ARRAY[0.9036,0.8962,0.8897,0.8801,0.8717,0.8703,0.8691,0.8658,0.8611,0.8543,0.8503,0.8509,0.8519,0.8532,0.8549,0.8556,0.8614,0.8725,0.8811,0.8849,0.888,0.8875,0.8813,0.8843,0.896,0.9014,0.9049,0.9127,0.9204,0.923,0.9219,0.9208,0.9211,0.9228,0.925,0.9278,0.9315,0.9342,0.9349,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.9347,0.9318,0.9289,0.9294,0.9289,0.9263,0.9234,0.9199,0.9157,0.9105]::real[], '42559039a4c958dd0aec33083dbd9091983a66c2aff984a63caea09e90a4ebbe'),
    ('23aff192-60ef-4c11-96df-2140e1d59369'::uuid, ARRAY[0.0041,0.0054,0.0034,0.0014,0.0021,0.0028,0.0021,0.0007,0,0.0007,0.0021,0.0028,0.0021,0.0007,0,0,0,0,0,0,0.03,0.0966,0.148,0.1808,0.2208,0.2697,0.3294,0.4023,0.4914,0.6322,0.8255,0.9635,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.924,0.7404,0.5755,0.4712,0.396,0.3363,0.2688,0.2117,0.1733,0.1139,0.0372,0.0041,0.0047,0.0027,0.0021,0.0028]::real[], ARRAY[0.7932,0.7385,0.6773,0.6297,0.6084,0.5969,0.5978,0.5872,0.5584,0.5511,0.5784,0.605,0.5804,0.5527,0.5938,0.6735,0.7356,0.7678,0.7824,0.7923,0.8061,0.8213,0.8375,0.8559,0.8736,0.8863,0.8941,0.9028,0.9141,0.9256,0.932,0.9326,0.9328,0.9341,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.9304,0.9176,0.9081,0.911,0.9208,0.928,0.9268,0.9208,0.9144,0.9063,0.8956,0.8821,0.8677,0.8594,0.8548,0.8357]::real[], 'b3b8902aed41cfc7144ae2456de2f974bc5fd5043dea2f005cc8e8ef10961f6b'),
    ('402ec6ad-4e80-47d2-882f-5053eb9aa433'::uuid, ARRAY[0.1733,0.1292,0.0831,0.0611,0.0526,0.0418,0.0299,0.0209,0.0187,0.0167,0.0147,0.0147,0.013,0.0097,0.008,0.008,0.0067,0.0041,0.0028,0.0028,0.0028,0.0028,0.0028,0.0028,0.0041,0.0067,0.008,0.008,0.008,0.008,0.008,0.0097,0.013,0.0147,0.0147,0.0147,0.0461,0.1168,0.1733,0.2117,0.2586,0.3158,0.3858,0.4712,0.5755,0.7404,0.924,1,1,1,1,1,1,1,0.924,0.7719,0.7719,0.924,1,1,1,1,1,1,0.924,0.7404,0.5755,0.4712,0.3858,0.3158,0.2586,0.2117]::real[], ARRAY[0.9087,0.9023,0.8903,0.8767,0.8548,0.8284,0.8121,0.7671,0.6708,0.5947,0.588,0.6133,0.6278,0.6318,0.6369,0.6499,0.6707,0.6952,0.7282,0.7649,0.7951,0.815,0.8314,0.8502,0.8675,0.8789,0.8857,0.8867,0.8799,0.8589,0.7826,0.645,0.4927,0.3681,0.2918,0.2201,0.1457,0.1355,0.2042,0.2861,0.3453,0.447,0.6232,0.7765,0.853,0.9046,0.9332,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.9346,0.9334,0.9331,0.9343,0.935,0.935,0.935,0.935,0.935,0.935,0.9347,0.9336,0.9295,0.9225,0.9139,0.9076,0.908,0.91]::real[], '5f6a6f1e7b584cf760758154c34d5951f1db570fbe1b86af0e8c513796330a25'),
    ('cb488223-4397-415c-a4f4-cdf3845dc241'::uuid, ARRAY[1,1,1,1,1,0.924,0.7404,0.5755,0.4923,0.4923,0.5755,0.7404,0.924,0.924,0.7404,0.5755,0.4712,0.3858,0.3298,0.3389,0.4037,0.4592,0.5005,0.5488,0.5551,0.4897,0.3837,0.2816,0.2434,0.276,0.388,0.5546,0.6629,0.6479,0.5298,0.4118,0.3371,0.276,0.226,0.1904,0.184,0.2117,0.2586,0.3158,0.3858,0.4712,0.5755,0.7404,0.848,0.7404,0.5755,0.4923,0.4923,0.5755,0.7404,0.848,0.7404,0.6013,0.6013,0.7404,0.924,1,1,1,1,1,1,1,1,1,1,1]::real[], ARRAY[0.935,0.935,0.935,0.935,0.935,0.9349,0.9342,0.9322,0.9264,0.918,0.9141,0.9142,0.9142,0.9141,0.9134,0.912,0.9111,0.9111,0.9111,0.9107,0.9103,0.91,0.9098,0.9097,0.9101,0.9105,0.9103,0.9091,0.9087,0.9088,0.9066,0.9036,0.9048,0.9099,0.9131,0.9142,0.9147,0.9146,0.9144,0.8305,0.7407,0.8183,0.9084,0.9148,0.9147,0.9185,0.9256,0.9306,0.9258,0.9186,0.9251,0.9324,0.93,0.8996,0.8749,0.9055,0.9319,0.9316,0.9334,0.9345,0.9349,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935]::real[], '9fd6c4fbb357efa264244274496164e2c36cd7bf0d99db5666f491218c12f970'),
    ('1182a4ff-0a3c-49f2-9d67-58ba9351b2ac'::uuid, ARRAY[0.3858,0.3158,0.2586,0.2117,0.1733,0.1132,0.0351,0,0,0,0,0,0,0,0.0007,0.0014,0.0007,0,0,0.0351,0.1132,0.1733,0.2117,0.2586,0.3158,0.3858,0.4712,0.5755,0.7404,0.848,0.7404,0.5755,0.4712,0.3858,0.3158,0.2844,0.3158,0.3858,0.4712,0.5755,0.7404,0.924,1,1,0.924,0.7404,0.6328,0.7404,0.924,1,1,0.924,0.7404,0.5755,0.4712,0.3858,0.3158,0.2586,0.2328,0.2586,0.3158,0.3858,0.4712,0.5755,0.7404,0.924,1,1,0.924,0.7404,0.5755,0.4712]::real[], ARRAY[0.3965,0.3388,0.2959,0.2431,0.1787,0.1518,0.144,0.1311,0.1163,0.09,0.0667,0.0688,0.0764,0.088,0.113,0.1155,0.1111,0.1434,0.1727,0.1928,0.2323,0.2861,0.3391,0.3573,0.3477,0.342,0.3603,0.4228,0.5128,0.612,0.7159,0.8006,0.8551,0.877,0.8768,0.8796,0.886,0.8947,0.9071,0.9181,0.9278,0.9337,0.935,0.935,0.9349,0.9345,0.9339,0.9341,0.9348,0.935,0.935,0.934,0.9287,0.9192,0.8975,0.854,0.8062,0.7722,0.7475,0.7205,0.7006,0.6972,0.6841,0.6537,0.6205,0.5905,0.5656,0.524,0.4601,0.4191,0.4158,0.4223]::real[], 'cd622870676f02c0b35583db19ee93dbb13423b0261acb43a190154ec1291f3f'),
    ('2c8a869b-6a53-40db-ba23-a6316d6f4965'::uuid, ARRAY[1,0.924,0.7404,0.5755,0.4712,0.3858,0.3158,0.2586,0.2117,0.1733,0.1188,0.0521,0.0226,0.0249,0.0271,0.0249,0.0206,0.0167,0.0147,0.0147,0.0147,0.0147,0.0167,0.0206,0.0226,0.0226,0.0249,0.0294,0.0588,0.1211,0.1733,0.2117,0.2586,0.3158,0.3858,0.4712,0.5755,0.7404,0.924,0.9778,0.8648,0.7183,0.6892,0.7935,0.9356,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]::real[], ARRAY[0.9297,0.9247,0.9219,0.9198,0.9177,0.9153,0.913,0.9111,0.9083,0.9034,0.8958,0.8894,0.8851,0.8808,0.8767,0.8726,0.8707,0.8721,0.8747,0.8765,0.8747,0.8673,0.8623,0.8668,0.8715,0.8719,0.8782,0.8893,0.8918,0.8878,0.8899,0.8954,0.903,0.9136,0.92,0.9239,0.9287,0.9323,0.9343,0.9349,0.9348,0.9347,0.9347,0.9348,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.935,0.9339]::real[], '063370ec6f23e1aea8686616880f5c1efd022b082cb176c3ba2ed7cfc9bcde64')
)
UPDATE public.beaches AS b
SET
  swell_access_factors = terrain.swell_factors,
  wind_exposure_factors = terrain.wind_factors,
  terrain_method = 'dem_horizon_v1',
  terrain_params = '{"max_radius_m":5000,"blockage_threshold_m":3000,"swell_ray_length_m":3500,"step_m":60,"angle_mid":8,"k":3,"min_exposure":0.15,"wrap_lambda":0.04,"max_wrap_angle":45,"smoothing_kernel":[0.25,0.5,0.25],"dem_source":"copernicus","resolution_m":30,"near_far_split_m":500}'::jsonb,
  terrain_params_hash = 'b00b79ecf6aaa5edce8ee435af2d4a5e1921a81997182f403fda9741963e7f6a',
  terrain_analyzed_at = '2026-09-02T00:00:00Z'::timestamptz,
  wind_analyzed_at = '2026-09-02T00:00:00Z'::timestamptz,
  swell_analyzed_at = '2026-09-02T00:00:00Z'::timestamptz,
  terrain_status = 'ok',
  terrain_enabled = true,
  terrain_analysis_debug = jsonb_build_object(
    'analysis_metadata', jsonb_build_object('dem_coverage_pct', 100),
    'coordinate_hash', terrain.coordinate_hash,
    'model_version', 'custom_spot_terrain_v1'
  )
FROM terrain_factors AS terrain
WHERE b.id = terrain.beach_id;

DELETE FROM public.beach_photos
WHERE (beach_id = '23aff192-60ef-4c11-96df-2140e1d59369'::uuid
    AND source = 'user'
    AND source_id = 'houda-point-camel-rock-v1')
  OR (beach_id = 'cb488223-4397-415c-a4f4-cdf3845dc241'::uuid
    AND source = 'wikimedia'
    AND source_id = 'File:Samoa Dunes Recreation Area (41415402494).jpg');

WITH photo_library (
  beach_id, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html
) AS (
  VALUES
    ('c0024ced-d774-4e5f-b580-1bc8cb8da136'::uuid, 'File:Moonstone Beach.png', 'https://upload.wikimedia.org/wikipedia/commons/5/57/Moonstone_Beach.png', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Moonstone_Beach.png/1280px-Moonstone_Beach.png', 'Moonstone Beach', 'NP2026', 'https://commons.wikimedia.org/wiki/File:Moonstone_Beach.png', 'CC0', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', 'Image by NP2026, dedicated to the public domain under CC0 via Wikimedia Commons.'),
    ('402ec6ad-4e80-47d2-882f-5053eb9aa433'::uuid, 'File:Trinidad-ca-state-beach.jpg', 'https://upload.wikimedia.org/wikipedia/commons/2/25/Trinidad-ca-state-beach.jpg', 'https://upload.wikimedia.org/wikipedia/commons/2/25/Trinidad-ca-state-beach.jpg', 'Trinidad State Beach', 'TrinidadMike', 'https://commons.wikimedia.org/wiki/File:Trinidad-ca-state-beach.jpg', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Trinidad-ca-state-beach.jpg', 'Public-domain image by TrinidadMike via Wikimedia Commons.'),
    ('cb488223-4397-415c-a4f4-cdf3845dc241'::uuid, 'File:Samoa Dunes Recreation Area (40328814310).jpg', 'https://upload.wikimedia.org/wikipedia/commons/3/36/Samoa_Dunes_Recreation_Area_%2840328814310%29.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Samoa_Dunes_Recreation_Area_%2840328814310%29.jpg/1280px-Samoa_Dunes_Recreation_Area_%2840328814310%29.jpg', 'Surfing at Samoa Dunes Recreation Area', 'John Ciccarelli / BLM', 'https://www.flickr.com/people/blmcalifornia/', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Samoa_Dunes_Recreation_Area_(40328814310).jpg', 'Public-domain surf photo by John Ciccarelli, BLM, via Wikimedia Commons.'),
    ('1182a4ff-0a3c-49f2-9d67-58ba9351b2ac'::uuid, 'File:College Cove at Trinidad State Beach, California, US.jpg', 'https://upload.wikimedia.org/wikipedia/commons/3/37/College_Cove_at_Trinidad_State_Beach%2C_California%2C_US.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/College_Cove_at_Trinidad_State_Beach%2C_California%2C_US.jpg/1280px-College_Cove_at_Trinidad_State_Beach%2C_California%2C_US.jpg', 'College Cove at Trinidad State Beach', 'Clyde Charles Brown', 'https://commons.wikimedia.org/wiki/User:Semiautonomous', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Image by Clyde Charles Brown, licensed CC BY-SA 4.0 via Wikimedia Commons.'),
    ('2c8a869b-6a53-40db-ba23-a6316d6f4965'::uuid, 'File:Clambeach.jpg', 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Clambeach.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Clambeach.jpg/1280px-Clambeach.jpg', 'Clam Beach', 'Californiabeaches', 'https://commons.wikimedia.org/wiki/File:Clambeach.jpg', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'Image by Californiabeaches, licensed CC BY-SA 4.0 via Wikimedia Commons.')
)
INSERT INTO public.beach_photos (
  beach_id, source, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html, approved, deleted_at
)
SELECT beach_id, 'wikimedia', source_id, image_url, thumb_url, title,
  creator_name, creator_url, license_code, license_url, attribution_html,
  true, NULL::timestamptz
FROM photo_library
ON CONFLICT (beach_id, source, source_id) DO UPDATE SET
  image_url = EXCLUDED.image_url, thumb_url = EXCLUDED.thumb_url,
  title = EXCLUDED.title, creator_name = EXCLUDED.creator_name,
  creator_url = EXCLUDED.creator_url, license_code = EXCLUDED.license_code,
  license_url = EXCLUDED.license_url, attribution_html = EXCLUDED.attribution_html,
  approved = true, deleted_at = NULL, fetched_at = now();

INSERT INTO public.beach_photos (
  beach_id, source, source_id, image_url, thumb_url, title, creator_name,
  license_code, attribution_html, approved, deleted_at
) VALUES (
  '23aff192-60ef-4c11-96df-2140e1d59369'::uuid,
  'ai_generated', 'houda-point-camel-rock-v1',
  'https://www.quiversurf.app/images/beaches/humboldt/houda-point-camel-rock-v1.webp',
  'https://www.quiversurf.app/images/beaches/humboldt/houda-point-camel-rock-v1.webp',
  'Houda Point / Camel Rock — illustrative coastal setting',
  'OpenAI image generation', 'openai-generated',
  'AI-generated representative Humboldt coast image. Illustrative only; not the exact break or current conditions.',
  true, NULL::timestamptz
)
ON CONFLICT (beach_id, source, source_id) DO UPDATE SET
  image_url = EXCLUDED.image_url, thumb_url = EXCLUDED.thumb_url,
  title = EXCLUDED.title, creator_name = EXCLUDED.creator_name,
  license_code = EXCLUDED.license_code,
  attribution_html = EXCLUDED.attribution_html,
  approved = true, deleted_at = NULL, fetched_at = now();

INSERT INTO public.beach_sources (beach_id, forecast_source_id)
SELECT id, 'open_meteo'
FROM _humboldt_beaches
ON CONFLICT (beach_id) DO UPDATE SET
  forecast_source_id = EXCLUDED.forecast_source_id;

CREATE OR REPLACE FUNCTION public.get_weekend_scout_candidates(
  input_user_id uuid,
  input_lat double precision,
  input_lon double precision,
  max_distance_meters integer,
  limit_count integer DEFAULT 1000
)
RETURNS TABLE(id uuid, distance_meters double precision, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(input_lon, input_lat), 4326)::geography AS geog
    WHERE input_lat BETWEEN -90 AND 90
      AND input_lon BETWEEN -180 AND 180
      AND max_distance_meters > 0
  ),
  eligible AS (
    SELECT b.id, ST_Distance(b.geog, origin.geog) AS distance_meters
    FROM public.beaches b
    CROSS JOIN origin
    WHERE b.geog IS NOT NULL
      AND b.is_private IS NOT TRUE
      AND b.recommendation_eligible
      AND b.deleted_at IS NULL
      AND ST_DWithin(b.geog, origin.geog, max_distance_meters)
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_beach_exclusions ube
        WHERE ube.user_id = input_user_id
          AND ube.beach_id = b.id
      )
  ),
  counted AS (
    SELECT eligible.id, eligible.distance_meters, count(*) OVER () AS total_count
    FROM eligible
  )
  SELECT counted.id, counted.distance_meters, counted.total_count
  FROM counted
  ORDER BY counted.distance_meters ASC, counted.id ASC
  LIMIT LEAST(GREATEST(limit_count, 1), 1000);
$function$;

COMMENT ON FUNCTION public.get_weekend_scout_candidates(
  uuid, double precision, double precision, integer, integer
) IS 'Returns recommendation-eligible, non-hidden beaches in current-location range, plus total count for truncation detection.';

CREATE OR REPLACE FUNCTION public.get_coach_picks(
  _beach_id uuid,
  _radius_km numeric DEFAULT 80
)
RETURNS TABLE (
  pick_rank int,
  beach_id uuid,
  name text,
  distance_km numeric,
  score int
)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $function$
  WITH origin AS (
    SELECT b.lat, b.lon
    FROM public.beaches b
    WHERE b.id = _beach_id
      AND b.deleted_at IS NULL
      AND NOT b.is_private
  ),
  candidate_distances AS (
    SELECT
      b.id,
      b.name,
      (
        6371.0088 * 2 * asin(
          least(
            1.0,
            sqrt(
              power(sin(radians((b.lat - o.lat) / 2.0)), 2) +
              cos(radians(o.lat)) * cos(radians(b.lat)) *
              power(sin(radians((b.lon - o.lon) / 2.0)), 2)
            )
          )
        )
      )::numeric AS distance_km
    FROM public.beaches b
    CROSS JOIN origin o
    WHERE b.id <> _beach_id
      AND b.deleted_at IS NULL
      AND NOT b.is_private
      AND b.recommendation_eligible
  ),
  scored_candidates AS (
    SELECT
      candidate.id,
      candidate.name,
      candidate.distance_km,
      coalesce(latest_intel.conditions_score, 0)::int AS score
    FROM candidate_distances candidate
    LEFT JOIN LATERAL (
      SELECT intel.conditions_score
      FROM public.beach_daily_intel intel
      WHERE intel.beach_id = candidate.id
      ORDER BY intel.forecast_date DESC, intel.generated_at DESC
      LIMIT 1
    ) latest_intel ON true
    WHERE candidate.distance_km <= _radius_km
  )
  SELECT
    row_number() OVER (
      ORDER BY candidate.score DESC, candidate.distance_km ASC, candidate.id
    )::int AS pick_rank,
    candidate.id AS beach_id,
    candidate.name,
    candidate.distance_km,
    candidate.score
  FROM scored_candidates candidate
  ORDER BY pick_rank
  LIMIT 3;
$function$;

COMMENT ON FUNCTION public.get_coach_picks(uuid, numeric) IS
  'Returns the top three recommendation-eligible public beaches within a strict radius, ranked by each beach''s latest daily conditions score.';

CREATE OR REPLACE FUNCTION public.get_user_match_candidates(
  p_user_id uuid,
  p_exclude_beach_id uuid DEFAULT NULL::uuid,
  p_device_lat double precision DEFAULT NULL::double precision,
  p_device_lon double precision DEFAULT NULL::double precision,
  p_radius_km double precision DEFAULT 50,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(beach jsonb, score numeric, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_have_device boolean :=
    p_device_lat IS NOT NULL
    AND p_device_lon IS NOT NULL
    AND p_device_lat BETWEEN -90 AND 90
    AND p_device_lon BETWEEN -180 AND 180;
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
  v_max_drive_minutes integer;
  v_profile_radius_km double precision;
  v_effective_radius_km double precision;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_caller IS NULL OR p_user_id <> v_caller THEN
      RETURN;
    END IF;

    SELECT
      COALESCE(ue.is_pro, false) OR COALESCE(ue.is_trialing, false),
      COALESCE(ue.billing_issue, false),
      ue.expires_at
    INTO v_is_paid, v_billing_issue, v_expires_at
    FROM public.user_entitlements ue
    WHERE ue.user_id = p_user_id
    LIMIT 1;

    IF v_billing_issue OR NOT COALESCE(v_is_paid, false)
      OR (v_expires_at IS NOT NULL AND v_expires_at < now()) THEN
      RETURN;
    END IF;
  END IF;

  SELECT p.max_drive_minutes
  INTO v_max_drive_minutes
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;

  v_profile_radius_km := CASE
    WHEN v_max_drive_minutes IS NULL THEN 100.0
    ELSE LEAST(GREATEST(v_max_drive_minutes, 15), 90) * 0.5 * 1.609344
  END;
  v_effective_radius_km := LEAST(
    v_profile_radius_km,
    GREATEST(COALESCE(p_radius_km, v_profile_radius_km), 0)
  );

  RETURN QUERY
  WITH device_location AS (
    SELECT ST_SetSRID(ST_MakePoint(p_device_lon, p_device_lat), 4326)::geography AS geog
    WHERE v_have_device
  ),
  local_candidate_beaches AS (
    SELECT
      b.id,
      b.name,
      b.lat,
      b.lon,
      ST_Distance(b.geog, device_location.geog) / 1000.0 AS distance_km,
      'device_radius'::text AS candidate_source
    FROM public.beaches b
    CROSS JOIN device_location
    WHERE v_have_device
      AND b.deleted_at IS NULL
      AND b.recommendation_eligible
      AND b.geog IS NOT NULL
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND ST_DWithin(
        b.geog,
        device_location.geog,
        v_effective_radius_km * 1000
      )
  ),
  favorite_candidate_beaches AS (
    SELECT
      b.id,
      b.name,
      b.lat,
      b.lon,
      NULL::double precision AS distance_km,
      'favorite'::text AS candidate_source
    FROM public.beaches b
    WHERE NOT v_have_device
      AND b.deleted_at IS NULL
      AND b.recommendation_eligible
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND EXISTS (
        SELECT 1
        FROM public.favorite_beaches fb
        WHERE fb.user_id = p_user_id
          AND fb.beach_id = b.id
      )
  ),
  combined_candidate_beaches AS (
    SELECT * FROM local_candidate_beaches
    UNION ALL
    SELECT * FROM favorite_candidate_beaches
  ),
  actionable_forecast AS (
    SELECT DISTINCT ON (ef.beach_id)
      ef.beach_id,
      ef.wave_height,
      ef.wave_period,
      ef.wind_speed,
      (ef.wind_direction_deg)::text AS wind_direction,
      ef.tide_height
    FROM public.enhanced_forecasts ef
    WHERE ef.beach_id IN (SELECT id FROM combined_candidate_beaches)
      AND ef.forecast_at IS NOT NULL
      AND ef.forecast_at >= now() - interval '45 minutes'
      AND ef.forecast_at <= now() + interval '72 hours'
    ORDER BY
      ef.beach_id,
      CASE WHEN ef.forecast_at::date = now()::date THEN 0 ELSE 1 END,
      ABS(EXTRACT(EPOCH FROM (ef.forecast_at - now()))),
      ef.forecast_at ASC
  ),
  scored AS (
    SELECT
      cb.id,
      cb.name,
      cb.lat,
      cb.lon,
      cb.distance_km,
      cb.candidate_source,
      public.compute_user_match_score(
        p_user_id,
        cb.id,
        af.wave_height,
        af.wave_period,
        af.wind_speed,
        af.wind_direction,
        af.tide_height
      ) AS result
    FROM combined_candidate_beaches cb
    JOIN actionable_forecast af ON af.beach_id = cb.id
  )
  SELECT
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'lat', s.lat,
      'lon', s.lon,
      'distance_km', s.distance_km,
      'candidate_source', s.candidate_source
    ) AS beach,
    (s.result->>'score')::numeric AS score,
    COALESCE(s.result->>'label', s.result->>'fit_label') AS label
  FROM scored s
  WHERE s.result->>'state' IN ('ready', 'learned')
    AND jsonb_typeof(s.result->'score') = 'number'
  ORDER BY (s.result->>'score')::numeric DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;

NOTIFY pgrst, 'reload schema';

DO $$
DECLARE
  imported_count integer;
  recommendation_ready_count integer;
  seo_count integer;
  photo_count integer;
  forecast_count integer;
  terrain_count integer;
BEGIN
  SELECT count(*) INTO imported_count
  FROM public.beaches
  WHERE id IN (SELECT id FROM _humboldt_beaches);

  SELECT count(*) INTO recommendation_ready_count
  FROM public.beaches
  WHERE id IN (SELECT id FROM _humboldt_beaches)
    AND recommendation_eligible IS TRUE
    AND preference_model->>'recommendation_ready' = 'true';

  SELECT count(*) INTO seo_count
  FROM public.beaches
  WHERE id IN (SELECT id FROM _humboldt_beaches)
    AND seo_indexable IS TRUE;

  SELECT count(DISTINCT beach_id) INTO photo_count
  FROM public.beach_photos
  WHERE beach_id IN (SELECT id FROM _humboldt_beaches)
    AND approved IS TRUE
    AND deleted_at IS NULL;

  SELECT count(*) INTO forecast_count
  FROM public.beach_sources
  WHERE beach_id IN (SELECT id FROM _humboldt_beaches)
    AND forecast_source_id = 'open_meteo';

  SELECT count(*) INTO terrain_count
  FROM public.beaches
  WHERE id IN (SELECT id FROM _humboldt_beaches)
    AND timezone = 'America/Los_Angeles'
    AND terrain_enabled IS TRUE
    AND terrain_status = 'ok'
    AND array_length(swell_access_factors, 1) = 72
    AND array_length(wind_exposure_factors, 1) = 72
    AND editorial_reviewed_at IS NOT NULL;

  IF imported_count <> 6 OR recommendation_ready_count <> 4 OR seo_count <> 4
    OR photo_count <> 6 OR forecast_count <> 6 OR terrain_count <> 6 THEN
    RAISE EXCEPTION 'Humboldt import validation failed: imported %, recommendation %, seo %, photos %, forecast %, terrain %',
      imported_count, recommendation_ready_count, seo_count, photo_count,
      forecast_count, terrain_count;
  END IF;
END $$;

COMMIT;
