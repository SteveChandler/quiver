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
  -- Persona user IDs
  liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
  big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
  solid_snake_id UUID := '638edbd2-7fd3-49b5-8129-84456764df4c'::UUID;
  rookie_riley_id UUID := '05f3d22c-a282-4252-bb54-64dcb74a83dd'::UUID;
  local_larry_id UUID := '382c284f-e36d-43cd-8e44-0930544db459'::UUID;
  travel_tina_id UUID := '701beae0-96aa-43d4-a29a-4353ead6ea24'::UUID;
  photo_paul_id UUID := '31d78eb7-357e-444e-88cd-d728ebf4f1ae'::UUID;
  dawn_dana_id UUID := '3958e9bb-acf8-45a1-ab20-7953ec1cb0e7'::UUID;

  users UUID[] := ARRAY[
    local_larry_id, dawn_dana_id, rookie_riley_id,
    photo_paul_id, solid_snake_id, liquid_snake_id,
    big_boss_id, travel_tina_id
  ];

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
    SELECT unnest(ARRAY[
      liquid_snake_id, big_boss_id, rookie_riley_id,
      local_larry_id, travel_tina_id, photo_paul_id, dawn_dana_id
    ]) AS uid
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


