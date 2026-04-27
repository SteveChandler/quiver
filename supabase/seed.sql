-- =============================================================================
-- Seed data for local development
-- Runs after all migrations during `supabase db reset`
-- All inserts use ON CONFLICT DO NOTHING for idempotency
-- =============================================================================

-- Beach IDs (from 20251205000000_add_socal_beaches.sql)
-- Big Rock:              dbbafa09-3143-4f73-82e8-90a69a4121f5
-- Sunset Cliffs:         b939f928-2653-494a-831d-6394cb548190
-- 54th St Newport:       da8ad733-8e6b-4781-8b3f-0fe4ee492c3f
-- Manhattan Beach Pier:  7a093b7e-2230-4bf1-abeb-9b31faa794d5
-- Topanga:               101bd2f7-e1dc-4940-b4e3-3a820d5940dd

-- =============================================================================
-- 1. MARINE FORECASTS — 48 hours of hourly data for 5 beaches
-- Realistic SoCal winter swell: 1-2m height, 10-14s period, 270-290° direction
-- =============================================================================

INSERT INTO public.marine_forecasts (beach_id, ts, wave_height_m, wave_period_s, wave_direction_deg, wind_speed_ms, wind_direction_deg, source, is_observed)
SELECT
  beach_id,
  ts,
  -- Wave height: base + small variation per beach/hour
  1.2 + 0.6 * sin(extract(epoch FROM ts) / 3600.0 * 0.3 + beach_offset * 1.1),
  -- Wave period: 10-14s
  12.0 + 2.0 * sin(extract(epoch FROM ts) / 3600.0 * 0.15 + beach_offset * 0.7),
  -- Wave direction: 270-290°
  280.0 + 10.0 * sin(extract(epoch FROM ts) / 3600.0 * 0.1 + beach_offset * 0.5),
  -- Wind speed: 1-4 m/s (light)
  2.5 + 1.5 * sin(extract(epoch FROM ts) / 3600.0 * 0.4 + beach_offset * 1.3),
  -- Wind direction: variable offshore ~45-90°
  65.0 + 25.0 * sin(extract(epoch FROM ts) / 3600.0 * 0.2 + beach_offset * 0.9),
  'open-meteo',
  false
FROM (
  SELECT unnest(ARRAY[
    'dbbafa09-3143-4f73-82e8-90a69a4121f5'::uuid,
    'b939f928-2653-494a-831d-6394cb548190'::uuid,
    'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid,
    '7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid,
    '101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid
  ]) AS beach_id,
  unnest(ARRAY[0, 1, 2, 3, 4]) AS beach_offset
) beaches
CROSS JOIN generate_series(
  date_trunc('hour', NOW()),
  date_trunc('hour', NOW()) + INTERVAL '48 hours',
  INTERVAL '1 hour'
) AS ts
ON CONFLICT (beach_id, ts, source) DO NOTHING;


-- =============================================================================
-- 2. TIDE FORECASTS — 48 hours of hourly data
-- Semi-diurnal pattern using sin() over 12.4-hour cycle
-- =============================================================================

INSERT INTO public.tide_forecasts (beach_id, ts, tide_height_m, source)
SELECT
  beach_id,
  ts,
  -- Semi-diurnal tide: ~12.4 hour period, range -0.3m to 1.8m
  0.75 + 1.05 * sin(2 * pi() * extract(epoch FROM ts) / (12.4 * 3600) + beach_offset * 0.4),
  'noaa'
FROM (
  SELECT unnest(ARRAY[
    'dbbafa09-3143-4f73-82e8-90a69a4121f5'::uuid,
    'b939f928-2653-494a-831d-6394cb548190'::uuid,
    'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid,
    '7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid,
    '101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid
  ]) AS beach_id,
  unnest(ARRAY[0, 1, 2, 3, 4]) AS beach_offset
) beaches
CROSS JOIN generate_series(
  date_trunc('hour', NOW()),
  date_trunc('hour', NOW()) + INTERVAL '48 hours',
  INTERVAL '1 hour'
) AS ts
ON CONFLICT (beach_id, ts, source) DO NOTHING;


-- =============================================================================
-- 3. SUN TIMES — 7 days of sunrise/sunset
-- Sunrise ~14:45 UTC (6:45 AM PST), Sunset ~01:15 UTC next day (5:15 PM PST)
-- =============================================================================

INSERT INTO public.sun_times (beach_id, date, sunrise_utc, sunset_utc, source)
SELECT
  beach_id,
  d::date,
  -- Sunrise: ~14:45 UTC (6:45 AM PST) with slight daily shift
  d + INTERVAL '14 hours 45 minutes' + (extract(dow FROM d) * INTERVAL '1 minute'),
  -- Sunset: ~01:15 UTC next day (5:15 PM PST) with slight daily shift
  d + INTERVAL '25 hours 15 minutes' + (extract(dow FROM d) * INTERVAL '1 minute'),
  'open-meteo'
FROM (
  SELECT unnest(ARRAY[
    'dbbafa09-3143-4f73-82e8-90a69a4121f5'::uuid,
    'b939f928-2653-494a-831d-6394cb548190'::uuid,
    'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid,
    '7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid,
    '101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid
  ]) AS beach_id
) beaches
CROSS JOIN generate_series(
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '6 days',
  INTERVAL '1 day'
) AS d
ON CONFLICT (beach_id, date, source) DO NOTHING;


-- =============================================================================
-- 4. SESSIONS — 7 completed sessions for mock users at seeded beaches
-- Uses subqueries to reference mock users by name
-- =============================================================================

INSERT INTO public.sessions (
  user_id, beach_id, arrival_time, duration_minutes,
  status, rating, notes, beach_name, wave_quality, crowd_level, is_public
)
SELECT * FROM (VALUES
  -- Alex "Goofy" Thompson at Big Rock, 2 days ago morning
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Alex%Thompson%' LIMIT 1),
    'dbbafa09-3143-4f73-82e8-90a69a4121f5'::uuid,
    NOW() - INTERVAL '2 days 6 hours',
    75,
    'completed'::text,
    4::smallint,
    'Great morning session! Waves were clean and glassy. Caught a few nice ones on the inside.'::text,
    'Big Rock'::text,
    4::integer,
    2::integer,
    true
  ),
  -- Maria "Barrel" Santos at Sunset Cliffs, 3 days ago
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Maria%Santos%' LIMIT 1),
    'b939f928-2653-494a-831d-6394cb548190'::uuid,
    NOW() - INTERVAL '3 days 7 hours',
    90,
    'completed'::text,
    5::smallint,
    'Epic session at the cliffs. Head high sets rolling through, got a couple barrel sections.'::text,
    'Sunset Cliffs'::text,
    5::integer,
    3::integer,
    true
  ),
  -- Chris "Shortboard" Rodriguez at Manhattan Beach Pier, yesterday
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Chris%Rodriguez%' LIMIT 1),
    '7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid,
    NOW() - INTERVAL '1 day 8 hours',
    60,
    'completed'::text,
    3::smallint,
    'Decent waves but crowded near the pier. Found some open peaks to the south.'::text,
    'Manhattan Beach Pier'::text,
    3::integer,
    4::integer,
    true
  ),
  -- Sarah "Longboard" Mitchell at Topanga, 4 days ago
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Sarah%Mitchell%' LIMIT 1),
    '101bd2f7-e1dc-4940-b4e3-3a820d5940dd'::uuid,
    NOW() - INTERVAL '4 days 7 hours',
    120,
    'completed'::text,
    5::smallint,
    'Perfect longboard day! Mellow waist-high waves, smooth faces for noseriding.'::text,
    'Topanga'::text,
    4::integer,
    2::integer,
    true
  ),
  -- Jessica "Pro" Chen at 54th St Newport, 1 day ago
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Jessica%Chen%' LIMIT 1),
    'da8ad733-8e6b-4781-8b3f-0fe4ee492c3f'::uuid,
    NOW() - INTERVAL '1 day 6 hours',
    90,
    'completed'::text,
    4::smallint,
    'Solid overhead sets on the outside. West swell filling in nicely. Good power.'::text,
    '54th St Newport'::text,
    4::integer,
    3::integer,
    true
  ),
  -- Josh "Early Bird" Kim at Big Rock, 5 days ago dawn patrol
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Josh%Kim%' LIMIT 1),
    'dbbafa09-3143-4f73-82e8-90a69a4121f5'::uuid,
    NOW() - INTERVAL '5 days 9 hours',
    60,
    'completed'::text,
    4::smallint,
    'Dawn patrol paid off — empty lineup, clean waist-high peaks.'::text,
    'Big Rock'::text,
    4::integer,
    1::integer,
    true
  ),
  -- Luna "Sunrise" Martinez at Sunset Cliffs, 6 days ago
  (
    (SELECT id FROM public.profiles WHERE full_name LIKE 'Luna%Martinez%' LIMIT 1),
    'b939f928-2653-494a-831d-6394cb548190'::uuid,
    NOW() - INTERVAL '6 days 7 hours',
    105,
    'completed'::text,
    3::smallint,
    'Solid swell but wind came up by 9am. Got a few good ones early.'::text,
    'Sunset Cliffs'::text,
    3::integer,
    2::integer,
    true
  )
) AS s(user_id, beach_id, arrival_time, duration_minutes, status, rating, notes, beach_name, wave_quality, crowd_level, is_public)
WHERE s.user_id IS NOT NULL;

-- =============================================================================
-- 5. FAVORITES & HOME BEACH for Emma Davis (proximity testing)
-- Simulates a user with favorites both near and far from UTC San Diego (32.87, -117.22)
-- Emma Davis is a 'south-san-diego' rookie who survives NPC cleanup migration
-- =============================================================================

-- Set home beach to Ocean Beach (~8 mi from UTC - may be filtered when GPS active with small radius)
UPDATE public.profiles
SET home_beach_id = (SELECT id FROM public.beaches WHERE name = 'Ocean Beach' LIMIT 1)
WHERE full_name = 'Emma Davis';

-- Add favorites: mix of near-UTC and farther beaches
INSERT INTO public.favorite_beaches (user_id, beach_id, rank)
SELECT
  emma.id,
  beaches.id,
  b.rank_val
FROM (VALUES
  -- Farther from UTC (~8-10 mi)
  ('Ocean Beach', 1),
  ('Sunset Cliffs', 2),
  -- Near UTC (~2-5 mi)
  ('Blacks', 3),
  ('Scripps Pier', 4),
  ('La Jolla Shores', 5),
  ('Tourmaline', 6)
) AS b(beach_name, rank_val)
JOIN public.beaches ON beaches.name = b.beach_name
JOIN (SELECT id FROM public.profiles WHERE full_name = 'Emma Davis' LIMIT 1) emma ON true
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. SUN TIMES for SD beaches (required by discovery orchestrator)
-- =============================================================================
INSERT INTO public.sun_times (beach_id, date, sunrise_utc, sunset_utc, source)
SELECT
  b.id,
  d::date,
  d + INTERVAL '14 hours 45 minutes',
  d + INTERVAL '25 hours 15 minutes',
  'open-meteo'
FROM public.beaches b
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', INTERVAL '1 day') AS d
WHERE b.lat IS NOT NULL AND b.lon IS NOT NULL
  AND b.lat BETWEEN 32.5 AND 33.5
ON CONFLICT (beach_id, date, source) DO NOTHING;
