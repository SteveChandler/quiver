-- =============================================================================
-- Seed Demo Data for Ad Video
-- Run: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < scripts/seed-demo-ad.sql
-- Or paste into Supabase Studio SQL Editor at http://127.0.0.1:54323
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. GET TEST USER ID AND SET UP FAVORITES + HOME BEACH
-- =============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_blacks_id uuid;
  v_windansea_id uuid;
  v_scripps_id uuid;
  v_ocean_beach_id uuid;
  v_sunset_cliffs_id uuid;
BEGIN
  -- Get the test user
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = 'stcha0004@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Test user stcha0004@gmail.com not found. Run setup-local-e2e-user.sql first or sign in.';
  END IF;

  RAISE NOTICE 'Found test user: %', v_user_id;

  -- Get beach IDs
  SELECT id INTO v_blacks_id FROM public.beaches WHERE name = 'Blacks' LIMIT 1;
  SELECT id INTO v_windansea_id FROM public.beaches WHERE name = 'Windansea' LIMIT 1;
  SELECT id INTO v_scripps_id FROM public.beaches WHERE name ILIKE '%Scripps%' LIMIT 1;
  SELECT id INTO v_ocean_beach_id FROM public.beaches WHERE name = 'Ocean Beach' LIMIT 1;
  SELECT id INTO v_sunset_cliffs_id FROM public.beaches WHERE name ILIKE 'Sunset Cliffs%' LIMIT 1;

  RAISE NOTICE 'Blacks: %, Windansea: %, Scripps: %, Ocean Beach: %, Sunset Cliffs: %',
    v_blacks_id, v_windansea_id, v_scripps_id, v_ocean_beach_id, v_sunset_cliffs_id;

  -- Set home beach to Blacks
  UPDATE public.profiles
  SET home_beach_id = v_blacks_id
  WHERE id = v_user_id;

  RAISE NOTICE 'Set home beach to Blacks';

  -- Add favorites for test user
  DELETE FROM public.favorite_beaches WHERE user_id = v_user_id;

  INSERT INTO public.favorite_beaches (user_id, beach_id, rank)
  VALUES
    (v_user_id, v_blacks_id, 1),
    (v_user_id, v_windansea_id, 2),
    (v_user_id, v_scripps_id, 3),
    (v_user_id, v_ocean_beach_id, 4),
    (v_user_id, v_sunset_cliffs_id, 5)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Added 5 favorite beaches';
END $$;

-- =============================================================================
-- 2. SEED ENHANCED FORECASTS - "FIRING" CONDITIONS
-- =============================================================================

-- Clear old forecasts for these beaches
DELETE FROM public.enhanced_forecasts
WHERE beach_id IN (
  SELECT id FROM public.beaches
  WHERE name IN ('Blacks', 'Windansea', 'Ocean Beach')
     OR name ILIKE '%Scripps%'
     OR name ILIKE 'Sunset Cliffs%'
)
AND forecast_date BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 2;

-- Insert firing forecasts using explicit beach lookup
INSERT INTO public.enhanced_forecasts (
  beach_id, forecast_date, forecast_time,
  wave_height, wave_period, wave_direction,
  swell_1_height, swell_1_period, swell_1_direction,
  wind_speed, wind_direction, weather_condition,
  tide_status, tide_height, water_temp, air_temperature,
  confidence_score, data_source
)
SELECT
  beach.id,
  d::date,
  t::time,
  cond.wave_height,
  cond.wave_period,
  '280°',
  cond.swell_height,
  cond.swell_period,
  '275°',
  cond.wind_speed,
  '45°',
  'Sunny',
  CASE
    WHEN EXTRACT(hour FROM t) < 10 THEN 'Rising'
    WHEN EXTRACT(hour FROM t) < 14 THEN 'High'
    ELSE 'Falling'
  END,
  CASE
    WHEN EXTRACT(hour FROM t) < 10 THEN '3.2 ft'
    WHEN EXTRACT(hour FROM t) < 14 THEN '4.8 ft'
    ELSE '3.5 ft'
  END,
  '62°F',
  '68°F',
  cond.confidence,
  'CDIP'
FROM (
  VALUES
    ('Blacks',           '5-7 ft',  '15s', '6 ft',   '15s', '3 mph',  95),
    ('Windansea',        '4-5 ft',  '13s', '4.5 ft', '13s', '4 mph',  90),
    ('Scripps',          '3-4 ft',  '12s', '3.5 ft', '12s', '5 mph',  85),
    ('Ocean Beach',      '4-6 ft',  '14s', '5 ft',   '14s', '4 mph',  88),
    ('Sunset Cliffs',    '5-6 ft',  '14s', '5.5 ft', '14s', '3 mph',  92)
) AS cond(beach_name, wave_height, wave_period, swell_height, swell_period, wind_speed, confidence)
JOIN public.beaches beach ON (
  beach.name = cond.beach_name
  OR (cond.beach_name = 'Scripps' AND beach.name ILIKE '%Scripps%')
  OR (cond.beach_name = 'Sunset Cliffs' AND beach.name ILIKE 'Sunset Cliffs%')
)
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 1, INTERVAL '1 day') AS d
CROSS JOIN (
  SELECT '06:00:00'::time AS t UNION ALL
  SELECT '09:00:00'::time UNION ALL
  SELECT '12:00:00'::time UNION ALL
  SELECT '15:00:00'::time UNION ALL
  SELECT '18:00:00'::time
) AS times
ON CONFLICT (beach_id, forecast_date, forecast_time) DO UPDATE SET
  wave_height = EXCLUDED.wave_height,
  wave_period = EXCLUDED.wave_period,
  wave_direction = EXCLUDED.wave_direction,
  swell_1_height = EXCLUDED.swell_1_height,
  swell_1_period = EXCLUDED.swell_1_period,
  swell_1_direction = EXCLUDED.swell_1_direction,
  wind_speed = EXCLUDED.wind_speed,
  wind_direction = EXCLUDED.wind_direction,
  tide_status = EXCLUDED.tide_status,
  tide_height = EXCLUDED.tide_height,
  confidence_score = EXCLUDED.confidence_score,
  updated_at = NOW();

-- =============================================================================
-- 3. FIX MISSING BEACH COORDINATES (from original seed data)
-- =============================================================================
UPDATE public.beaches SET lat = 32.867, lon = -117.2573 WHERE name ILIKE '%Scripps%' AND lat IS NULL;
UPDATE public.beaches SET lat = 32.8299, lon = -117.2823 WHERE name = 'Windansea' AND lat IS NULL;
UPDATE public.beaches SET lat = 32.7493, lon = -117.2511 WHERE name = 'Ocean Beach' AND lat IS NULL;

-- =============================================================================
-- 4. SEED INTEL POSTS FOR COAST PULSE
-- =============================================================================
DO $$
DECLARE
  v_poster_id uuid;
  v_blacks_id uuid;
  v_blacks_lat numeric;
  v_blacks_lon numeric;
  v_windansea_id uuid;
  v_windansea_lat numeric;
  v_windansea_lon numeric;
  v_sunset_cliffs_id uuid;
  v_sunset_cliffs_lat numeric;
  v_sunset_cliffs_lon numeric;
BEGIN
  -- Use a mock user if available, otherwise test user
  SELECT id INTO v_poster_id
  FROM public.profiles
  WHERE full_name LIKE 'Alex%' OR full_name LIKE 'Maria%'
  LIMIT 1;

  IF v_poster_id IS NULL THEN
    SELECT id INTO v_poster_id FROM public.profiles WHERE email = 'stcha0004@gmail.com' LIMIT 1;
  END IF;

  -- Get beach info including coordinates
  SELECT id, lat, lon INTO v_blacks_id, v_blacks_lat, v_blacks_lon
  FROM public.beaches WHERE name = 'Blacks' LIMIT 1;

  SELECT id, lat, lon INTO v_windansea_id, v_windansea_lat, v_windansea_lon
  FROM public.beaches WHERE name = 'Windansea' LIMIT 1;

  SELECT id, lat, lon INTO v_sunset_cliffs_id, v_sunset_cliffs_lat, v_sunset_cliffs_lon
  FROM public.beaches WHERE name ILIKE 'Sunset Cliffs%' LIMIT 1;

  -- Delete recent intel for these beaches
  DELETE FROM public.intel_posts
  WHERE beach_id IN (v_blacks_id, v_windansea_id, v_sunset_cliffs_id)
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Insert fresh intel posts with correct schema
  INSERT INTO public.intel_posts (
    user_id, beach_id, latitude, longitude, tag, title, description, emoji_rating, created_at
  )
  VALUES
    (v_poster_id, v_blacks_id, v_blacks_lat, v_blacks_lon, 'conditions',
     'Blacks FIRING!',
     'Head high+ sets rolling through, offshore winds holding. Got some of the best barrels of the winter.',
     'fire', NOW() - INTERVAL '2 hours'),
    (v_poster_id, v_windansea_id, v_windansea_lat, v_windansea_lon, 'conditions',
     'Glassy at Windansea',
     'Solid 4-5ft faces, light crowd. Perfect morning session!',
     'shaka', NOW() - INTERVAL '4 hours'),
    (v_poster_id, v_sunset_cliffs_id, v_sunset_cliffs_lat, v_sunset_cliffs_lon, 'conditions',
     'Sunset Cliffs going off!',
     'Some barrel sections on the bigger sets. Worth the paddle out.',
     'fire', NOW() - INTERVAL '6 hours');

  RAISE NOTICE 'Added 3 intel posts for Coast Pulse';
END $$;

-- =============================================================================
-- 5. SEED BEACH REVIEWS
-- =============================================================================
DO $$
DECLARE
  v_reviewer_id uuid;
  v_blacks_id uuid;
  v_windansea_id uuid;
  v_sunset_cliffs_id uuid;
BEGIN
  -- Get a reviewer (mock user or test user)
  SELECT id INTO v_reviewer_id
  FROM public.profiles
  WHERE full_name LIKE 'Maria%' OR full_name LIKE 'Chris%'
  LIMIT 1;

  IF v_reviewer_id IS NULL THEN
    SELECT id INTO v_reviewer_id FROM public.profiles WHERE email = 'stcha0004@gmail.com' LIMIT 1;
  END IF;

  SELECT id INTO v_blacks_id FROM public.beaches WHERE name = 'Blacks' LIMIT 1;
  SELECT id INTO v_windansea_id FROM public.beaches WHERE name = 'Windansea' LIMIT 1;
  SELECT id INTO v_sunset_cliffs_id FROM public.beaches WHERE name ILIKE 'Sunset Cliffs%' LIMIT 1;

  -- Delete existing reviews from this user for these beaches
  DELETE FROM public.beach_reviews
  WHERE user_id = v_reviewer_id
    AND beach_id IN (v_blacks_id, v_windansea_id, v_sunset_cliffs_id);

  -- Insert reviews with correct schema
  INSERT INTO public.beach_reviews (
    user_id, beach_id, overall_rating, wave_quality_rating, crowd_density_rating,
    parking_rating, accessibility_rating, title, content, visit_date, created_at
  )
  VALUES
    (v_reviewer_id, v_blacks_id, 5, 5, 3, 2, 2,
     'World-class beach break',
     'When it''s on, there''s nothing better in San Diego. The canyon focuses the swell and creates powerful, hollow waves. Dawn patrol is essential to beat the crowd. The hike down is worth it!',
     CURRENT_DATE - 5, NOW() - INTERVAL '5 days'),
    (v_reviewer_id, v_windansea_id, 5, 5, 4, 3, 4,
     'Iconic La Jolla reef break',
     'Consistent waves with that famous shack as a backdrop. Best at mid-tide with a west swell. Can get crowded but the vibe is usually good. Classic spot.',
     CURRENT_DATE - 10, NOW() - INTERVAL '10 days'),
    (v_reviewer_id, v_sunset_cliffs_id, 4, 4, 3, 3, 3,
     'Raw and powerful reef breaks',
     'Stunning sunset views and multiple peaks along the cliffs. Parking can be tricky but the waves make up for it. Respect the locals and you''ll have a great time.',
     CURRENT_DATE - 15, NOW() - INTERVAL '15 days');

  RAISE NOTICE 'Added beach reviews';
END $$;

-- =============================================================================
-- 6. SEED SESSIONS FOR TEST USER (Creates affinity data)
-- =============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_blacks_id uuid;
  v_windansea_id uuid;
  v_ocean_beach_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE email = 'stcha0004@gmail.com' LIMIT 1;
  SELECT id INTO v_blacks_id FROM public.beaches WHERE name = 'Blacks' LIMIT 1;
  SELECT id INTO v_windansea_id FROM public.beaches WHERE name = 'Windansea' LIMIT 1;
  SELECT id INTO v_ocean_beach_id FROM public.beaches WHERE name = 'Ocean Beach' LIMIT 1;

  -- Delete recent test sessions
  DELETE FROM public.sessions
  WHERE user_id = v_user_id
    AND created_at > NOW() - INTERVAL '30 days';

  -- Insert completed sessions
  INSERT INTO public.sessions (
    profile_id, user_id, beach_id, beach_name, arrival_time, duration_minutes,
    status, rating, notes, wave_quality, crowd_level, is_public
  )
  VALUES
    (v_user_id, v_user_id, v_blacks_id, 'Blacks',
     NOW() - INTERVAL '3 days 7 hours', 90, 'completed', 5,
     'Epic dawn patrol! Overhead sets, offshore all morning. Caught some of the best waves of the year.',
     5, 2, true),
    (v_user_id, v_user_id, v_windansea_id, 'Windansea',
     NOW() - INTERVAL '5 days 8 hours', 75, 'completed', 4,
     'Fun session at the reef. 4ft faces, glassy conditions. Good crowd vibe.',
     4, 3, true),
    (v_user_id, v_user_id, v_ocean_beach_id, 'Ocean Beach',
     NOW() - INTERVAL '7 days 6 hours', 60, 'completed', 4,
     'Solid afternoon session at OB. Punchy peaks near the pier. Water was chilly but worth it.',
     4, 3, true);

  RAISE NOTICE 'Added 3 sessions for test user';
END $$;

-- =============================================================================
-- 7. ENSURE SUN TIMES EXIST (Required for discovery)
-- =============================================================================
INSERT INTO public.sun_times (beach_id, date, sunrise_utc, sunset_utc, source)
SELECT
  b.id,
  d::date,
  d + INTERVAL '14 hours 45 minutes',
  d + INTERVAL '25 hours 15 minutes',
  'computed'
FROM public.beaches b
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 3, INTERVAL '1 day') AS d
WHERE b.name IN ('Blacks', 'Windansea', 'Ocean Beach')
   OR b.name ILIKE '%Scripps%'
   OR b.name ILIKE 'Sunset Cliffs%'
ON CONFLICT (beach_id, date, source) DO NOTHING;

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT '=== TEST USER ===' AS section;
SELECT id, email, full_name, home_beach_id
FROM public.profiles
WHERE email = 'stcha0004@gmail.com';

SELECT '=== FAVORITES ===' AS section;
SELECT fb.rank, b.name
FROM public.favorite_beaches fb
JOIN public.beaches b ON fb.beach_id = b.id
JOIN public.profiles p ON fb.user_id = p.id
WHERE p.email = 'stcha0004@gmail.com'
ORDER BY fb.rank;

SELECT '=== FORECASTS (Today 9AM) ===' AS section;
SELECT b.name, ef.wave_height, ef.wind_speed, ef.confidence_score
FROM public.enhanced_forecasts ef
JOIN public.beaches b ON ef.beach_id = b.id
WHERE ef.forecast_date = CURRENT_DATE
  AND ef.forecast_time = '09:00:00'
ORDER BY ef.confidence_score DESC;

SELECT '=== INTEL POSTS (Last 24h) ===' AS section;
SELECT b.name, ip.emoji_rating, ip.title, ip.created_at
FROM public.intel_posts ip
JOIN public.beaches b ON ip.beach_id = b.id
WHERE ip.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ip.created_at DESC;

SELECT '=== USER SESSIONS ===' AS section;
SELECT s.beach_name, s.rating, s.arrival_time::date as session_date
FROM public.sessions s
JOIN public.profiles p ON s.user_id = p.id
WHERE p.email = 'stcha0004@gmail.com'
ORDER BY s.arrival_time DESC;

SELECT '=== DEMO SEED COMPLETE ===' AS result;
