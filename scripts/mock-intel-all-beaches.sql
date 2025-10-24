-- =============================================================
-- Mock Intel for Many Beaches with User Profiles
-- Purpose: Seed intel posts across a wide set of beaches so the
--          intel UI shows rich, recent content with user avatars.
-- Usage: Run in Supabase SQL editor (or psql) AFTER persona
--        profiles exist and beaches are loaded. Safe to re-run.
-- =============================================================

-- Ensure surf condition columns exist (safe no-ops if present)
ALTER TABLE intel_posts
  ADD COLUMN IF NOT EXISTS wave_height DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wind_speed DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wind_direction TEXT,
  ADD COLUMN IF NOT EXISTS water_temp INTEGER,
  ADD COLUMN IF NOT EXISTS crowd_level INTEGER,
  ADD COLUMN IF NOT EXISTS wave_types TEXT[],
  ADD COLUMN IF NOT EXISTS forecast_accuracy TEXT;

DO $$
DECLARE
  -- Dynamically resolve persona user IDs from profiles
  liquid_snake_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Liquid Snake' LIMIT 1);
  big_boss_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Big Boss' LIMIT 1);
  solid_snake_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Solid Snake' LIMIT 1);
  riley_r_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Riley R.' LIMIT 1);
  local_larry_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Local Larry' LIMIT 1);
  tina_c_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Tina C.' LIMIT 1);
  p_martinez_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'P. Martinez' LIMIT 1);
  dawn_patrol_id UUID := (SELECT id FROM public.profiles WHERE full_name = 'Dawn Patrol' LIMIT 1);

  -- Optional: include local test user if present in auth.users
  salid_email TEXT := 'salidfingers@duck.com';
  salid_id UUID := (SELECT id FROM auth.users WHERE email = salid_email LIMIT 1);

  users UUID[] := ARRAY[]::UUID[];

  b RECORD;
  i INT;
  u UUID;
  created_ts TIMESTAMPTZ;
  tag TEXT;
  height NUMERIC;
  wind NUMERIC;
  wdir TEXT;
  wtemp INT;
  crowd INT;
  acc TEXT;
  title TEXT;
  descr TEXT;
BEGIN
  RAISE NOTICE 'Seeding intel posts across many beaches...';

  -- Build users array from available persona IDs
  IF liquid_snake_id IS NOT NULL THEN users := users || ARRAY[liquid_snake_id]; END IF;
  IF big_boss_id IS NOT NULL THEN users := users || ARRAY[big_boss_id]; END IF;
  IF solid_snake_id IS NOT NULL THEN users := users || ARRAY[solid_snake_id]; END IF;
  IF rookie_riley_id IS NOT NULL THEN users := users || ARRAY[rookie_riley_id]; END IF;
  IF local_larry_id IS NOT NULL THEN users := users || ARRAY[local_larry_id]; END IF;
  IF travel_tina_id IS NOT NULL THEN users := users || ARRAY[travel_tina_id]; END IF;
  IF photo_paul_id IS NOT NULL THEN users := users || ARRAY[photo_paul_id]; END IF;
  IF dawn_dana_id IS NOT NULL THEN users := users || ARRAY[dawn_dana_id]; END IF;

  -- Append test user if available
  IF salid_id IS NOT NULL THEN
    users := users || ARRAY[salid_id];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intel_posts') THEN
    RAISE EXCEPTION 'intel_posts table not found. Run migrations first.';
  END IF;

  -- Loop all beaches that have valid coordinates
  FOR b IN SELECT id, name, latitude, longitude FROM beaches WHERE latitude IS NOT NULL AND longitude IS NOT NULL LOOP
    -- Insert several posts per beach time-distributed over 7 days
    FOR i IN 1..6 LOOP
      u := users[1 + FLOOR(RANDOM() * array_length(users, 1))];
      created_ts := NOW() - (FLOOR(RANDOM() * 7) || ' days')::interval - (FLOOR(RANDOM() * 12) || ' hours')::interval;
      tag := (CASE WHEN RANDOM() < 0.65 THEN 'conditions' ELSE (CASE WHEN RANDOM() < 0.5 THEN 'parking' ELSE (CASE WHEN RANDOM() < 0.5 THEN 'hazard' ELSE 'crowd' END) END) END);
      height := ROUND((2.0 + RANDOM() * 4.0)::numeric, 1);
      wind := ROUND((3.0 + RANDOM() * 14.0)::numeric, 1);
      wdir := (ARRAY['N','NE','E','SE','S','SW','W','NW','OFFSHORE','ONSHORE','CROSS'])[1 + FLOOR(RANDOM() * 11)];
      wtemp := 63 + FLOOR(RANDOM() * 7);
      crowd := 1 + FLOOR(RANDOM() * 5);
      acc := (CASE WHEN RANDOM() < 0.6 THEN 'accurate' WHEN RANDOM() < 0.85 THEN 'somewhat' ELSE 'inaccurate' END);

      title := (ARRAY[
        'Clean lines at ' || b.name,
        b.name || ' showing shape',
        'Fun peaks near the main takeoff',
        'Glass early, wind later',
        'Crowd mellow this window'
      ])[1 + FLOOR(RANDOM() * 5)];

      descr := (ARRAY[
        'Shoulder-high with workable shoulders; tide push helped.',
        'Lots of learners; still plenty of corners for shortboards.',
        'Inside soft but outside sets pack punch; watch the rips.',
        'North end a bit cleaner; bring the fish for maximum fun.',
        'Super photogenic this morning; clear water and crisp light.'
      ])[1 + FLOOR(RANDOM() * 5)];

      -- Avoid excessive duplicates when re-running: only insert if a similar recent post doesn't exist
      INSERT INTO intel_posts (
        user_id, latitude, longitude, tag, title, description,
        confirmations_count, is_active, expires_at, created_at,
        wave_height, wind_speed, wind_direction, water_temp, crowd_level, wave_types, forecast_accuracy
      ) VALUES (
        u, b.latitude, b.longitude, tag::intel_post_tag, title, descr,
        0, true, created_ts + INTERVAL '12 hours', created_ts,
        height, wind, wdir, wtemp, crowd, ARRAY['peaky','clean'], acc
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Add confirmations on a subset of recent posts to make UI lively
  INSERT INTO intel_post_confirmations (intel_post_id, user_id, created_at)
  SELECT ip.id, u.uid, NOW() - INTERVAL '1 hour' * (1 + FLOOR(RANDOM() * 6))
  FROM (
    SELECT id, user_id FROM intel_posts
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 60
  ) ip
  CROSS JOIN LATERAL (
    SELECT unnest(users) AS uid
  ) u
  WHERE ip.user_id <> u.uid AND RANDOM() < 0.20
  ON CONFLICT (intel_post_id, user_id) DO NOTHING;

  -- Recompute confirmations_count for recent rows
  UPDATE intel_posts SET confirmations_count = (
    SELECT COUNT(*) FROM intel_post_confirmations c WHERE c.intel_post_id = intel_posts.id
  )
  WHERE created_at > NOW() - INTERVAL '7 days';

  RAISE NOTICE 'Intel seeding across many beaches complete.';
END $$;

-- =========================
-- Quick verification queries
-- =========================
-- SELECT COUNT(*) FROM intel_posts WHERE created_at > NOW() - INTERVAL '7 days';
-- SELECT tag, COUNT(*) FROM intel_posts WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1;
-- SELECT confirmations_count FROM intel_posts ORDER BY created_at DESC LIMIT 5;


