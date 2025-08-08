-- =============================================================
-- Mock Local Intel (Heavy) for Popular Beaches
-- Purpose: Quickly make the app feel "lively" with recent intel
-- Beaches targeted: Pacific Beach, Ocean Beach, La Jolla Shores,
--                   Mission Beach, Windansea Beach
-- Users: existing persona users used across scripts
--
-- Usage: Run in Supabase SQL editor (or psql) after base data exists.
-- Safe to run multiple times; inserts are time-randomized over last 48h.
-- =============================================================

DO $$
DECLARE
  -- Persona user IDs (must exist in your auth already)
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

  -- Beach ids by name
  pb_id UUID; ob_id UUID; shores_id UUID; mission_id UUID; windansea_id UUID;

  i INT;
  chosen_user UUID;
  chosen_time TIMESTAMPTZ;
  chosen_dir TEXT;
  chosen_tag TEXT;
  chosen_title TEXT;
  chosen_desc TEXT;
  chosen_height NUMERIC;
  chosen_wind NUMERIC;
  chosen_temp INT;
  chosen_crowd INT;
  acc TEXT;

  lat NUMERIC; lng NUMERIC;
BEGIN
  -- Resolve beach ids
  SELECT id INTO pb_id FROM beaches WHERE name = 'Pacific Beach' LIMIT 1;
  SELECT id INTO ob_id FROM beaches WHERE name = 'Ocean Beach' LIMIT 1;
  SELECT id INTO shores_id FROM beaches WHERE name = 'La Jolla Shores' LIMIT 1;
  SELECT id INTO mission_id FROM beaches WHERE name = 'Mission Beach' LIMIT 1;
  SELECT id INTO windansea_id FROM beaches WHERE name = 'Windansea Beach' LIMIT 1;

  -- Bail out if none found
  IF pb_id IS NULL AND ob_id IS NULL AND shores_id IS NULL THEN
    RAISE NOTICE 'No target beaches available; exiting.';
    RETURN;
  END IF;

  -- Helper to pick beach coords
  -- (Approximate locations; close enough for demo)
  -- PB: 32.8030, -117.2405
  -- OB: 32.7507, -117.2540
  -- Shores: 32.8507, -117.2726
  -- Mission: 32.7801, -117.2549
  -- Windansea: 32.8371, -117.2791

  -- Insert 40 intel posts over last 48 hours across the five beaches
  FOR i IN 1..40 LOOP
    chosen_user := users[1 + FLOOR(RANDOM() * array_length(users, 1))];
    chosen_time := NOW() - (FLOOR(RANDOM() * 48) || ' hours')::interval;
    chosen_dir := (ARRAY['N','NE','E','SE','S','SW','W','NW','OFFSHORE','ONSHORE','CROSS'])[1 + FLOOR(RANDOM() * 11)];
    chosen_tag := (CASE WHEN RANDOM() < 0.8 THEN 'conditions' ELSE (CASE WHEN RANDOM() < 0.5 THEN 'parking' ELSE 'hazard' END) END);
    chosen_height := ROUND((2.0 + RANDOM() * 5.0)::numeric, 1);
    chosen_wind := ROUND((3.0 + RANDOM() * 12.0)::numeric, 1);
    chosen_temp := 63 + FLOOR(RANDOM() * 7);
    chosen_crowd := 1 + FLOOR(RANDOM() * 5);
    acc := (CASE WHEN RANDOM() < 0.6 THEN 'accurate' WHEN RANDOM() < 0.85 THEN 'somewhat' ELSE 'inaccurate' END);

    -- Choose beach (PB/OB/Shores more likely)
    CASE
      WHEN RANDOM() < 0.34 AND pb_id IS NOT NULL THEN lat := 32.8030; lng := -117.2405;
      WHEN RANDOM() < 0.68 AND ob_id IS NOT NULL THEN lat := 32.7507; lng := -117.2540;
      WHEN RANDOM() < 0.90 AND shores_id IS NOT NULL THEN lat := 32.8507; lng := -117.2726;
      WHEN RANDOM() < 0.96 AND mission_id IS NOT NULL THEN lat := 32.7801; lng := -117.2549;
      ELSE lat := 32.8371; lng := -117.2791; -- Windansea
    END CASE;

    chosen_title := (ARRAY[
      'Clean lines early', 'Fun peaks by the pier', 'Wind bump but workable',
      'Crowded but worth it', 'Punchy closeouts on low', 'Friendly rollers today'
    ])[1 + FLOOR(RANDOM() * 6)];

    chosen_desc := (ARRAY[
      'Shoulder-high sets with workable shoulders.',
      'Glass-off window was money; bring the fish.',
      'Soft on the inside, punchy outside sets every 8-10.',
      'Lots of learners in the mix; still plenty of waves.',
      'North end a bit cleaner; tide push helped.',
      'Early offshore groomed it nicely before wind switched.'
    ])[1 + FLOOR(RANDOM() * 6)];

    INSERT INTO intel_posts (
      user_id, latitude, longitude, tag, title, description,
      confirmations_count, is_active, expires_at, created_at,
      wave_height, wind_speed, wind_direction, water_temp, crowd_level,
      wave_types, forecast_accuracy
    ) VALUES (
      chosen_user, lat, lng, chosen_tag::intel_post_tag, chosen_title, chosen_desc,
      0, true, chosen_time + INTERVAL '6 hours', chosen_time,
      chosen_height, chosen_wind, chosen_dir, chosen_temp, chosen_crowd,
      ARRAY['peaky','clean'], acc
    );
  END LOOP;

  -- Add confirmations on ~25% of newest 30 posts to make UI lively
  INSERT INTO intel_post_confirmations (intel_post_id, user_id, created_at)
  SELECT ip.id, u.uid, NOW() - INTERVAL '1 hour' * (1 + FLOOR(RANDOM() * 6))
  FROM (
    SELECT id, user_id FROM intel_posts
    WHERE created_at > NOW() - INTERVAL '48 hours'
    ORDER BY created_at DESC
    LIMIT 30
  ) ip
  CROSS JOIN LATERAL (
    SELECT unnest(ARRAY[
      liquid_snake_id, big_boss_id, rookie_riley_id,
      local_larry_id, travel_tina_id, photo_paul_id, dawn_dana_id
    ]) AS uid
  ) u
  WHERE ip.user_id <> u.uid AND RANDOM() < 0.25
  ON CONFLICT (intel_post_id, user_id) DO NOTHING;

  -- Update cached confirmation counts
  UPDATE intel_posts SET confirmations_count = (
    SELECT COUNT(*) FROM intel_post_confirmations c WHERE c.intel_post_id = intel_posts.id
  )
  WHERE created_at > NOW() - INTERVAL '48 hours';

  RAISE NOTICE 'Inserted lively intel for popular beaches.';
END $$;


