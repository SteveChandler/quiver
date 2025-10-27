-- Migration: Populate surf spot data from comprehensive database
-- Source: Surfline, Magic Seaweed, NOAA buoy data, regional surf guides
-- Date: 2025-10-26
-- Matched beaches: 44/48

BEGIN;


-- Brooks Street
UPDATE public.beaches SET
  swell_window_min_deg = 170,
  swell_window_max_deg = 230,
  swell_window_center_deg = 200,
  swell_window_halfwidth_deg = 30,
  preferred_tide_ft_min = 1.5,
  preferred_tide_ft_max = 5,
  best_months = '{7, 8, 9, 10}',
  description = '**Brooks Street** showcases Laguna Beach''s beacon break rated 8/10 for summer/fall performance. Multiple reef tiers activate progressively: First Reef (50m out, steep/ledgy), Second Reef (95m, glassy barreling at 6-10+ feet), Third/Fourth Reefs (massive days only).',
  crowd_tips = 'crowds when working—Kelly Slater and pros',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'Best July-October'
WHERE id = '1f8660f2-891d-4f79-8f16-cad8ebd59c79';


-- Crystal Cove
UPDATE public.beaches SET
  swell_window_min_deg = 170,
  swell_window_max_deg = 230,
  swell_window_center_deg = 200,
  swell_window_halfwidth_deg = 30,
  preferred_tide_ft_min = 2.5,
  preferred_tide_ft_max = 4.5,
  best_months = '{7, 8, 9}',
  description = '**Crystal Cove** offers scenic but fickle left point/reef rated 5/10, working on south to southwest swells (170-230°, center 200°) with northeast winds (45°).',
  crowd_level = 'crowded',
  best_conditions_prose = 'Best July-September but can go years without good days'
WHERE id = '0e557ec4-355a-4176-8352-6ea50e379c13';


-- Doheny State Beach
UPDATE public.beaches SET
  break_type = 'beach break',
  skill_level = 'beginner',
  swell_window_min_deg = 170,
  swell_window_max_deg = 225,
  swell_window_center_deg = 200,
  swell_window_halfwidth_deg = 28,
  preferred_tide_ft_min = 0.5,
  preferred_tide_ft_max = 4,
  description = '**Doheny State Beach** offers Orange County''s second-easiest learning wave after San O'' Dogpatch, rated 4/10 overall but 6/10 for beginners.',
  wave_tips = 'offers Orange County''s second-easiest learning wave',
  crowd_level = 'moderate'
WHERE id = 'a57ae4c8-7a27-4d3f-91d5-6229350fb888';


-- Doheny State Beach
UPDATE public.beaches SET
  break_type = 'beach break',
  skill_level = 'beginner',
  swell_window_min_deg = 170,
  swell_window_max_deg = 225,
  swell_window_center_deg = 200,
  swell_window_halfwidth_deg = 28,
  preferred_tide_ft_min = 0.5,
  preferred_tide_ft_max = 4,
  description = '**Doheny State Beach** offers Orange County''s second-easiest learning wave after San O'' Dogpatch, rated 4/10 overall but 6/10 for beginners.',
  wave_tips = 'offers Orange County''s second-easiest learning wave',
  crowd_level = 'moderate'
WHERE id = 'a4575b12-2bc3-44d4-ba53-4415707f3851';


-- El Porto
UPDATE public.beaches SET
  break_type = 'beach break',
  swell_window_min_deg = 200,
  swell_window_max_deg = 320,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4.5,
  description = '**El Porto** (Manhattan Beach) functions as South Bay''s northwest swell magnet rated 7/10 for consistency despite variable quality.',
  crowd_level = 'very_crowded'
WHERE id = '52879e4f-fc7f-4c02-a5e3-ea40b992ea80';


-- Florence South Jetty
UPDATE public.beaches SET
  break_type = 'river mouth break',
  swell_window_min_deg = 180,
  swell_window_max_deg = 270,
  swell_window_center_deg = 225,
  swell_window_halfwidth_deg = 45,
  description = '**Florence South Jetty** offers challenging river mouth break rated 6/10 but fickle and dangerous. Siuslaw River south jetty produces inside left (harbor entrance wave—wedgy, hollow) and outside beach rights.',
  wave_tips = 'produces inside left (harbor entrance wave—wedgy, hollow) and outside beach rights',
  crowd_level = 'crowded',
  features = '{"jetty"}'
WHERE id = '2b401051-cdbf-41a9-ac30-e636c33a42ef';


-- Gold Beach
UPDATE public.beaches SET
  break_type = 'river mouth break',
  swell_window_min_deg = 240,
  swell_window_max_deg = 300,
  swell_window_center_deg = 270,
  swell_window_halfwidth_deg = 30,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 6,
  description = '**Gold Beach** (South Jetty) produces fickle hollow rights rated 5/10 at Rogue River mouth. Stubby jetty facing southwest creates right wedges.',
  crowd_level = 'crowded',
  features = '{"jetty"}'
WHERE id = '8d4afe79-ac68-4508-84d5-9175282a3f2c';


-- Hanalei Bay
UPDATE public.beaches SET
  break_type = 'point break',
  swell_window_min_deg = 315,
  swell_window_max_deg = 30,
  swell_window_center_deg = 0,
  swell_window_halfwidth_deg = 38,
  preferred_tide_ft_min = 0.2,
  preferred_tide_ft_max = 1.8,
  description = '**Hanalei Bay** (Kauai) offers scenic North Shore point break rated 7/10. Main break is long right point on eastern side of crescent bay breaking up to 300 yards over lava reef.',
  hazards = '{"strong currents", "competitive lineup"}',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'Receives north to north-northeast swells'
WHERE id = 'b4202dc4-e308-4dc2-9844-665413a75cb1';


-- Lower Trestles
UPDATE public.beaches SET
  break_type = 'cobblestone reef break',
  swell_window_min_deg = 180,
  swell_window_max_deg = 250,
  swell_window_center_deg = 215,
  swell_window_halfwidth_deg = 35,
  wind_offshore_deg = 67,
  best_months = '{3, 4, 5, 6, 7, 8, 9, 10}',
  description = '**Lower Trestles** stands as California''s proving ground for progressive surfing, rated 9/10 for wave quality.',
  hazards = '{"shallow reef", "competitive lineup"}',
  access_tips = '1.5-mile hike from parking, creating natural crowd filter',
  crowd_tips = 'crowded (10/10) with competitive lineup dominated by sponsored',
  wave_tips = 'optimal offshore winds from 67° ENE',
  crowd_level = 'extremely_crowded',
  features = '{"parking", "trail access"}',
  best_conditions_prose = 'Best March-October with consistent summer south swells'
WHERE id = '193a3f9a-66d0-4362-bf55-d25bb831dae4';


-- Newport Point
UPDATE public.beaches SET
  swell_window_min_deg = 160,
  swell_window_max_deg = 190,
  swell_window_center_deg = 175,
  swell_window_halfwidth_deg = 15,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 5,
  best_months = '{3, 4, 5, 6, 7, 8, 9, 10}',
  description = '**Newport Point** breaks only on hurricane swells with specific southeast component (160-190°, center 175°), rated 9/10 when working but extremely rare.',
  crowd_level = 'extremely_crowded',
  best_conditions_prose = 'Best March-October, particularly August-September hurricane season'
WHERE id = '11662c67-a1bb-43a0-b0f7-0e4071b1c3f2';


-- San Onofre State Beach
UPDATE public.beaches SET
  swell_window_min_deg = 170,
  swell_window_max_deg = 280,
  swell_window_center_deg = 225,
  swell_window_halfwidth_deg = 55,
  description = '**San Onofre State Beach** represents California''s surf culture birthplace, the "Waikiki of California" with gentle longboard waves rated 6/10 for consistency but 4/10 for performance.',
  access_tips = 'Direct beach parking available ($15 day pass)',
  parking_tips = '$15 day pass)',
  crowd_level = 'crowded',
  features = '{"parking"}'
WHERE id = 'a956de46-b204-448e-a541-db427be7e85f';


-- Pacific City
UPDATE public.beaches SET
  break_type = 'reef break',
  swell_window_min_deg = 240,
  swell_window_max_deg = 300,
  swell_window_center_deg = 270,
  swell_window_halfwidth_deg = 30,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 8,
  description = '**Pacific City** (Cape Kiwanda) stands as Oregon''s most popular surf spot rated 7/10 for consistency.',
  parking_tips = '$10 day-use parking fee',
  crowd_level = 'very_crowded',
  features = '{"parking"}'
WHERE id = 'cf59e55d-f146-4a72-8daf-5781a0693d13';


-- Poipu Beach Park
UPDATE public.beaches SET
  skill_level = 'beginner',
  swell_window_min_deg = 135,
  swell_window_max_deg = 200,
  swell_window_center_deg = 157,
  swell_window_halfwidth_deg = 33,
  preferred_tide_ft_min = 0.1,
  preferred_tide_ft_max = 1.7,
  best_months = '{5, 6, 7, 8, 9}',
  description = '**Poipu Beach Park** (Kauai) serves as Hawaii''s premier beginner spot rated 5/10 for moderate consistency.',
  crowd_level = 'crowded',
  features = '{"lifeguards"}',
  best_conditions_prose = 'Best May-September for summer south Pacific swells'
WHERE id = '231d8635-6ae1-40e5-9112-88c26b0918ac';


-- Salt Creek
UPDATE public.beaches SET
  break_type = 'reef break',
  swell_window_min_deg = 180,
  swell_window_max_deg = 240,
  swell_window_center_deg = 210,
  swell_window_halfwidth_deg = 30,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  best_months = '{6, 7, 8, 9, 10}',
  description = '**Salt Creek** delivers 8/10 quality across three distinct sections. The Point produces extremely rippable left pointbreaks when sandbars align; Middles offers wedgy A-frames year-round; Gravels reef breaks with board-breaking power.',
  warnings = '{"Blackballed: summer after 10am"}',
  local_etiquette = 'territorial old-timers protecting small takeoff zones',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'Best June-October for hurricane swells'
WHERE id = '73bb4a48-3d53-42ba-bbd0-d89a7cf95711';


-- San Onofre State Beach
UPDATE public.beaches SET
  swell_window_min_deg = 170,
  swell_window_max_deg = 280,
  swell_window_center_deg = 225,
  swell_window_halfwidth_deg = 55,
  description = '**San Onofre State Beach** represents California''s surf culture birthplace, the "Waikiki of California" with gentle longboard waves rated 6/10 for consistency but 4/10 for performance.',
  access_tips = 'Direct beach parking available ($15 day pass)',
  parking_tips = '$15 day pass)',
  crowd_level = 'crowded',
  features = '{"parking"}'
WHERE id = '8a47b323-0874-45d9-aa17-ced468f70f2d';


-- Seaside Cove
UPDATE public.beaches SET
  break_type = 'point break',
  skill_level = 'advanced',
  swell_window_min_deg = 270,
  swell_window_max_deg = 0,
  swell_window_center_deg = 315,
  swell_window_halfwidth_deg = 45,
  preferred_tide_ft_min = 4,
  preferred_tide_ft_max = 8,
  description = '**Seaside Cove** delivers Oregon''s best left-hand pointbreak rated 8/10 but with extreme localism. Point break and beach reef mix receives northwest swells (270-0°, center 315°).',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'best left-hand pointbreak rated 8/10 but with extreme localism'
WHERE id = '4055099a-2e07-4a84-b17a-47a401ff749c';


-- Short Sands
UPDATE public.beaches SET
  break_type = 'beach break',
  skill_level = 'advanced',
  swell_window_min_deg = 180,
  swell_window_max_deg = 315,
  swell_window_center_deg = 225,
  swell_window_halfwidth_deg = 68,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 8,
  best_months = '{10, 11}',
  description = '**Short Sands** (Oswald West State Park) functions as North Oregon Coast''s learn-to-surf destination rated 6/10.',
  access_tips = 'mile walk down paved trail through old-growth forest',
  wave_tips = 'ideal but protected from north winds by cove',
  crowd_level = 'crowded',
  features = '{"trail access"}',
  best_conditions_prose = 'Best October-November for quality before winter reshapes sandbars, January for consistency (44% clean)'
WHERE id = '2c2dea98-280b-488c-9d46-ffed8226447b';


-- T-Street
UPDATE public.beaches SET
  swell_window_min_deg = 160,
  swell_window_max_deg = 250,
  swell_window_center_deg = 215,
  swell_window_halfwidth_deg = 45,
  description = '**T-Street** (Trafalgar Canyon) provides year-round consistency rated 7/10, working on any tide with southwest swells (160-250°, center 215°).',
  hazards = '{"rocks"}',
  crowd_level = 'very_crowded'
WHERE id = 'dfeecc16-6395-4600-89e6-baf8456e3d69';


-- The Wedge
UPDATE public.beaches SET
  break_type = 'shorebreak',
  swell_window_min_deg = 180,
  swell_window_max_deg = 220,
  swell_window_center_deg = 200,
  swell_window_halfwidth_deg = 20,
  description = '**The Wedge** represents surfing''s most dangerous shorebreak, rated 10/10 for uniqueness. The jetty-reflected south swell (180-220°, center 200°) creates constructive interference producing 20-30+ foot waves detonating in 2-3 feet of water.',
  crowd_level = 'extremely_crowded',
  features = '{"jetty"}'
WHERE id = 'c2c7cc01-4920-4fd9-941c-68df6b46ced0';


-- Westport
UPDATE public.beaches SET
  skill_level = 'advanced',
  swell_window_min_deg = 180,
  swell_window_max_deg = 315,
  swell_window_center_deg = 248,
  swell_window_halfwidth_deg = 68,
  preferred_tide_ft_min = 1,
  preferred_tide_ft_max = 9,
  description = '**Westport** represents Washington''s "Surf City" and most consistent destination rated 8/10. Three distinct breaks: (1) The Jetty/Corner at Westhaven State Park produces righthander points off South Jetty (intermediate-advanced); (2) Half Moon Bay/The Cove—protected crescent inside harbor entrance, hollow and fast when large (advanced-only); (3) The Groins—five rock jetties north of marina.',
  crowd_level = 'very_crowded',
  features = '{"jetty"}'
WHERE id = '260868de-b952-470b-a764-b95b3e7f6655';


-- Westport
UPDATE public.beaches SET
  skill_level = 'advanced',
  swell_window_min_deg = 180,
  swell_window_max_deg = 315,
  swell_window_center_deg = 248,
  swell_window_halfwidth_deg = 68,
  preferred_tide_ft_min = 1,
  preferred_tide_ft_max = 9,
  description = '**Westport** represents Washington''s "Surf City" and most consistent destination rated 8/10. Three distinct breaks: (1) The Jetty/Corner at Westhaven State Park produces righthander points off South Jetty (intermediate-advanced); (2) Half Moon Bay/The Cove—protected crescent inside harbor entrance, hollow and fast when large (advanced-only); (3) The Groins—five rock jetties north of marina.',
  crowd_level = 'very_crowded',
  features = '{"jetty"}'
WHERE id = 'a83def7f-6b68-402f-a0ef-f78a5bcfbf81';


-- Cardiff Reef
UPDATE public.beaches SET
  swell_window_min_deg = 250,
  swell_window_max_deg = 320,
  swell_window_center_deg = 285,
  swell_window_halfwidth_deg = 35,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 4,
  best_months = '{11, 12, 1, 2, 3}',
  description = '**Cardiff Reef** offers North San Diego County''s best longboarding experience rated 7/10. This grass-covered flat reef produces quarter-mile rides over mellow, mushy waves ideal for multi-generational families.',
  wave_tips = 'produces quarter-mile rides over mellow, mushy waves. ideal for multi-generational families',
  crowd_level = 'very_crowded',
  features = '{"camping", "parking"}',
  best_conditions_prose = 'Best November-March but good year-round'
WHERE id = '80efa1c0-37a2-4879-819b-647ae3c3d749';


-- Grandview
UPDATE public.beaches SET
  break_type = 'reef break',
  skill_level = 'beginner',
  swell_window_min_deg = 180,
  swell_window_max_deg = 310,
  swell_window_center_deg = 245,
  swell_window_halfwidth_deg = 65,
  preferred_tide_ft_min = 1,
  preferred_tide_ft_max = 4,
  description = '**Grandview** provides beginner-friendly Leucadia beachbreak rated 6/10. Rock bottom covered by sand creates inside beachbreak and outside reef breaks.',
  access_tips = 'stairway access',
  crowd_level = 'crowded'
WHERE id = 'f29ddb0a-6d46-4589-a4a4-da406ddd3d5c';


-- Seaside Reef
UPDATE public.beaches SET
  break_type = 'shorebreak',
  swell_window_min_deg = 260,
  swell_window_max_deg = 320,
  swell_window_center_deg = 280,
  swell_window_halfwidth_deg = 30,
  preferred_tide_ft_min = 1.5,
  preferred_tide_ft_max = 4.5,
  best_months = '{11, 12, 1, 2, 3}',
  description = '**Seaside Reef** (Cardiff) delivers premier high-performance left rated 8/10 but unreliable consistency.',
  crowd_tips = 'crowded when conditions align (8/10) with high talent level including pros',
  wave_tips = 'optimal with east offshore winds (90°)',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'Best November-March for winter groundswells'
WHERE id = '5a34b2ac-01b9-4b83-8c05-c47b1b55d923';


-- Silver Strand State Beach
UPDATE public.beaches SET
  skill_level = 'beginner',
  swell_window_min_deg = 160,
  swell_window_max_deg = 240,
  swell_window_center_deg = 200,
  swell_window_halfwidth_deg = 40,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  aspect_deg = 190,
  description = '**Silver Strand State Beach** (Coronado) offers beginner-friendly gentle waves rated 4/10 for inconsistency.',
  crowd_level = 'moderate'
WHERE id = '94f1010b-c71f-4025-bda1-c26ed9467c85';


-- Terramar Point
UPDATE public.beaches SET
  break_type = 'point break',
  swell_window_min_deg = 190,
  swell_window_max_deg = 310,
  swell_window_center_deg = 250,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  description = '**Terramar Point** represents rare North San Diego County point break rated 6/10 but fickle. Rocky reef extending 200-300 feet produces long lefts (longest in SoCal potential) and rights.',
  parking_tips = 'Free parking available',
  wave_tips = 'produces long lefts (longest in SoCal potential) and rights',
  crowd_level = 'crowded',
  features = '{"parking"}'
WHERE id = '1fe4bf73-c425-48a5-899d-a7e8ee2d67e3';


-- Tijuana Sloughs
UPDATE public.beaches SET
  swell_window_min_deg = 240,
  swell_window_max_deg = 340,
  swell_window_center_deg = 280,
  swell_window_halfwidth_deg = 50,
  preferred_tide_ft_min = 1,
  preferred_tide_ft_max = 6,
  description = '**Tijuana Sloughs** represents legendary big-wave spot rated 5/10 for consistency but major pollution issues.',
  crowd_level = 'crowded'
WHERE id = '929caa5e-c79f-4b60-8fe0-bec75c2df2d6';


-- Upper Trestles
UPDATE public.beaches SET
  break_type = 'point break',
  swell_window_min_deg = 240,
  swell_window_max_deg = 315,
  swell_window_center_deg = 280,
  swell_window_halfwidth_deg = 38,
  preferred_tide_ft_min = 2.5,
  preferred_tide_ft_max = 5.5,
  best_months = '{10, 11, 12, 1, 2, 3}',
  description = '**Upper Trestles** offers high-performance cobblestone rights, rated 8/10, working best on west to northwest swells (240-315°, center 280°).',
  wave_tips = 'offers high-performance cobblestone rights',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'Best October-March for west/northwest groundswells, though works year-round'
WHERE id = 'f924aa96-395f-41e0-b966-502b37def7ac';


-- Del Mar
UPDATE public.beaches SET
  break_type = 'reef break',
  swell_window_min_deg = 200,
  swell_window_max_deg = 320,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 4,
  description = '**Del Mar** (15th Street) represents rare reef amid miles of beachbreak, rated 7/10. Left-hand reef break (dominant) with shorter right receives swells 200-320° (center 250°).',
  crowd_level = 'very_crowded'
WHERE id = '5e72b79d-a12d-4cd3-8da4-b7b92069efbf';


-- Oceanside Pier
UPDATE public.beaches SET
  break_type = 'beach break',
  swell_window_min_deg = 180,
  swell_window_max_deg = 340,
  swell_window_center_deg = 240,
  swell_window_halfwidth_deg = 80,
  preferred_tide_ft_min = 0.5,
  preferred_tide_ft_max = 4,
  aspect_deg = 270,
  best_months = '{11, 12, 1, 2, 3}',
  description = '**Oceanside Pier** offers reliable year-round beach break rated 6/10, receiving massive swell window (180-340°, center 240°).',
  crowd_level = 'crowded',
  features = '{"pier", "parking"}',
  best_conditions_prose = 'Best November-March for winter northwest swells, June-August for summer south swells'
WHERE id = 'cceecad1-7668-4ad8-88ff-ade893c605cd';


-- Pacific Beach
UPDATE public.beaches SET
  break_type = 'beach break',
  swell_window_min_deg = 200,
  swell_window_max_deg = 320,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 1.5,
  preferred_tide_ft_max = 4.5,
  best_months = '{9, 10, 11}',
  description = '**Pacific Beach** (Crystal Pier) offers multiple peaks rated 5/10—always something but rarely truly good.',
  crowd_level = 'crowded',
  features = '{"pier"}',
  best_conditions_prose = 'Best September-November for fall combo swells, March-May for spring northwest swells'
WHERE id = '65809772-20bc-4009-b9b2-89c8ef3c4127';


-- Windansea
UPDATE public.beaches SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 340,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 80,
  preferred_tide_ft_min = 0,
  preferred_tide_ft_max = 6,
  description = '**Windansea** stands as San Diego''s most consistent and iconic break, rated 9/10. This flat rock reef under La Jolla''s wealthy neighborhood produces long rights (up to 150m) and short hollow lefts.',
  wave_tips = 'produces long rights (up to 150m) and short hollow lefts',
  crowd_level = 'extremely_crowded'
WHERE id = '6f42d47d-215b-47cb-ac14-b83bf8c2a797';


-- La Jolla Shores
UPDATE public.beaches SET
  break_type = 'beach break',
  skill_level = 'advanced',
  swell_window_min_deg = 200,
  swell_window_max_deg = 320,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 1,
  preferred_tide_ft_max = 5,
  best_months = '{11, 12, 1, 2}',
  description = '**La Jolla Shores** functions as San Diego''s most popular beginner beach, rated 7/10 for learning environment.',
  crowd_level = 'very_crowded',
  best_conditions_prose = 'Best November-February for consistency, April-September for gentle beginner conditions'
WHERE id = 'd291411d-d331-4bf1-ad1a-302da3c69de0';


-- Mission Beach
UPDATE public.beaches SET
  swell_window_min_deg = 200,
  swell_window_max_deg = 320,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 6,
  description = '**Mission Beach** serves as central San Diego surfing bellwether rated 6/10. Nearly 2-mile stretch from South Mission Jetty to Pacific Beach offers year-round beachbreak.',
  crowd_level = 'crowded',
  features = '{"jetty"}'
WHERE id = 'c02b4ede-69d9-440e-b8de-22ea4bde10ef';


-- Ocean Beach
UPDATE public.beaches SET
  swell_window_min_deg = 200,
  swell_window_max_deg = 310,
  swell_window_center_deg = 255,
  swell_window_halfwidth_deg = 55,
  preferred_tide_ft_min = 1,
  preferred_tide_ft_max = 4,
  description = '**Ocean Beach** delivers San Diego''s most consistent surf rated 8/10 but most dangerous beach. Receives all swell directions 200-310° (center 270°) with east offshore winds (90°).',
  crowd_level = 'very_crowded',
  features = '{"pier", "jetty"}'
WHERE id = '15c7337e-5258-4339-9dc3-c435c666926b';


-- Scripps Pier
UPDATE public.beaches SET
  break_type = 'beach break',
  skill_level = 'beginner',
  swell_window_min_deg = 220,
  swell_window_max_deg = 320,
  swell_window_center_deg = 285,
  swell_window_halfwidth_deg = 50,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 5,
  best_months = '{11, 12, 1}',
  description = '**Scripps Pier** offers beginner to intermediate beach break rated 6/10, with pier structure creating defined peaks on both sides.',
  crowd_level = 'crowded',
  features = '{"pier"}',
  best_conditions_prose = 'Best November-January for winter but rideable year-round'
WHERE id = '4b0cf129-c706-4e24-8210-2219defc5ea7';


-- Tamarack State Beach
UPDATE public.beaches SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 300,
  swell_window_center_deg = 240,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 4,
  description = '**Tamarack State Beach** features two warm-water jetties creating decent sandbars rated 6/10. River provides water movement for sandbar formation.',
  parking_tips = 'Car break-ins reported - secure valuables',
  wave_tips = 'optimal at medium tide (2-4 feet)',
  crowd_level = 'crowded',
  features = '{"jetty", "parking"}'
WHERE id = 'b1b49703-2376-407d-b1fb-9df06130ac1d';


-- Blacks Beach
UPDATE public.beaches SET
  break_type = 'beach break',
  swell_window_min_deg = 200,
  swell_window_max_deg = 320,
  swell_window_center_deg = 260,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 0.5,
  preferred_tide_ft_max = 4,
  description = '**Blacks Beach** represents San Diego County''s best beach break and California premier beach break overall, rated 9/10.',
  crowd_level = 'extremely_crowded',
  features = '{"trail access"}'
WHERE id = '01330afc-00d3-461b-88f3-b173774766f4';


-- Sunset Cliffs
UPDATE public.beaches SET
  break_type = 'reef break',
  swell_window_min_deg = 220,
  swell_window_max_deg = 300,
  swell_window_center_deg = 270,
  swell_window_halfwidth_deg = 40,
  preferred_tide_ft_min = 0.5,
  preferred_tide_ft_max = 3,
  description = '**Sunset Cliffs** features multiple reef breaks along Point Loma rated 7/10 with numerous named spots (Luscomb''s Point, Garbage Beach, New Break, Abs, Osprey).',
  hazards = '{"kelp"}',
  wave_tips = 'ideal when other beaches blown out',
  crowd_level = 'very_crowded'
WHERE id = 'd305ba0d-47cd-4494-b790-f924dac7bf1f';


-- Swami's
UPDATE public.beaches SET
  break_type = 'reef/point break',
  swell_window_min_deg = 240,
  swell_window_max_deg = 310,
  swell_window_center_deg = 270,
  swell_window_halfwidth_deg = 35,
  preferred_tide_ft_min = 0.5,
  preferred_tide_ft_max = 3.5,
  description = '**Swami''s** ranks among Southern California''s premier right pointbreaks, rated 9/10. This reef/point break under Self-Realization Fellowship''s golden domes receives west swells (240-310°, center 270°) with east offshore winds (90°) optimal.',
  crowd_level = 'extremely_crowded'
WHERE id = 'b24c6fa9-9f82-4a1e-afcd-0d1fb0ce69d0';


-- Tourmaline
UPDATE public.beaches SET
  break_type = 'beach break',
  skill_level = 'beginner',
  swell_window_min_deg = 180,
  swell_window_max_deg = 300,
  swell_window_center_deg = 240,
  swell_window_halfwidth_deg = 60,
  preferred_tide_ft_min = 2,
  preferred_tide_ft_max = 5.5,
  best_months = '{11, 12, 1, 2}',
  description = '**Tourmaline** (Old Man''s) provides exceptional longboarding and best beginner spot in San Diego, rated 6/10.',
  crowd_tips = 'crowded (7/10) in summer but friendly beginner atmosphere—antithesis of aggressive',
  crowd_level = 'crowded',
  best_conditions_prose = 'Best November-February for consistency but year-round surfable'
WHERE id = '17628f35-9ed1-4257-aad6-070c4bd73bb8';


-- Oceanside Harbor
UPDATE public.beaches SET
  break_type = 'jetty break',
  swell_window_min_deg = 180,
  swell_window_max_deg = 320,
  swell_window_center_deg = 250,
  swell_window_halfwidth_deg = 70,
  preferred_tide_ft_min = 3,
  preferred_tide_ft_max = 5.7,
  description = '**Oceanside Harbor** (North & South Jetties) produces consistent jetty-formed rights rated 7/10. Siuslaw River mouth jetties create stabilized sandbars receiving swell 180-320° (center 270°).',
  crowd_level = 'very_crowded',
  features = '{"jetty"}'
WHERE id = 'a30b9870-aace-48ef-a3e6-e275ad9c28c1';


-- Ponto
UPDATE public.beaches SET
  swell_window_min_deg = 180,
  swell_window_max_deg = 310,
  swell_window_center_deg = 245,
  swell_window_halfwidth_deg = 65,
  preferred_tide_ft_min = 2.5,
  preferred_tide_ft_max = 4.5,
  description = '**Ponto** (South Carlsbad State Beach) benefits from Army Corps jetties at Batiquitos Lagoon, rated 7/10 for punchy beachbreak quality.',
  crowd_level = 'very_crowded',
  features = '{"jetty"}'
WHERE id = 'badd7986-4609-421a-ab3d-81fcd8409a5b';


-- La Push
UPDATE public.beaches SET
  break_type = 'beach break',
  swell_window_min_deg = 180,
  swell_window_max_deg = 315,
  swell_window_center_deg = 248,
  swell_window_halfwidth_deg = 68,
  preferred_tide_ft_min = 3,
  preferred_tide_ft_max = 7,
  description = '**La Push** (First Beach) delivers Olympic Peninsula''s reliable spot rated 6/10 but fickle. Crescent of black sand at Quillayute River mouth features reef/cobblestone break.',
  hazards = '{"steep drop-off"}',
  crowd_level = 'crowded'
WHERE id = '058c415c-39da-41bb-aee9-c4942d79e95d';


COMMIT;
