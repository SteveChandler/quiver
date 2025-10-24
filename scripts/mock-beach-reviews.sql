-- =============================================================
-- Mock Beach Reviews with User Profiles
-- Purpose: Seed realistic reviews across popular beaches so UI
--          shows names/avatars/ratings immediately.
-- Usage: Run in Supabase SQL editor (or psql) AFTER persona
--        profiles exist and `beaches` table is populated.
--        Safe to run multiple times; uses uniqueness guards.
-- =============================================================

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

  -- Optional: include local test user if present
  salid_email TEXT := 'salidfingers@duck.com';
  salid_id UUID := (SELECT id FROM auth.users WHERE email = salid_email LIMIT 1);

  users UUID[] := ARRAY[]::UUID[];

  b RECORD;
  u UUID;
  created_at_ts TIMESTAMPTZ;
  visit_dt DATE;
  base_title TEXT;
  base_content TEXT;
  ov INT; wq INT; cd INT; pr INT; ac INT;
BEGIN
  RAISE NOTICE 'Seeding beach reviews...';

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

  -- Ensure base tables present
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beach_reviews') THEN
    RAISE EXCEPTION 'beach_reviews table not found. Run migrations first.';
  END IF;

  -- Loop all beaches present in the database
  FOR b IN SELECT id, name FROM beaches LOOP
    -- One review per user per beach (unique index on (beach_id, user_id))
    FOREACH u IN ARRAY users LOOP
      -- Skip if already reviewed
      IF EXISTS (
        SELECT 1 FROM beach_reviews WHERE beach_id = b.id AND user_id = u
      ) THEN
        CONTINUE;
      END IF;

      -- Randomize ratings 3-5 overall with variance per user
      ov := 3 + FLOOR(RANDOM() * 3)::INT; -- 3..5
      wq := GREATEST(1, LEAST(5, ov + (FLOOR(RANDOM() * 3)::INT - 1)));
      cd := GREATEST(1, LEAST(5, 3 + FLOOR(RANDOM() * 3)::INT));
      pr := GREATEST(1, LEAST(5, 3 + FLOOR(RANDOM() * 3)::INT));
      ac := GREATEST(1, LEAST(5, 3 + FLOOR(RANDOM() * 3)::INT));

      -- Title/content templates
      base_title := (ARRAY[
        'Solid session at ' || b.name,
        'Fun waves, good vibes',
        'Crowd manageable, worth it',
        'Clean early, wind later',
        'Peaks near the main peak'
      ])[1 + FLOOR(RANDOM() * 5)];

      base_content := (ARRAY[
        'Caught a handful of fun ones. Conditions lined up nicely around the tide push.',
        'Lots of energy in the water. Friendly lineup. Easy parking if you arrive before 8.',
        'Bit of wind bump but sets were consistent. Watch the crowd near the pier.',
        'Clean faces early, then wind picked up. Still plenty of corners to work with.',
        'Peaky setup with shoulder-high sets. Great vibe and mellow inside for learners.'
      ])[1 + FLOOR(RANDOM() * 5)];

      -- Timestamps
      created_at_ts := NOW() - (FLOOR(RANDOM() * 30) || ' days')::interval;
      visit_dt := (created_at_ts - (1 + FLOOR(RANDOM() * 7)) * INTERVAL '1 day')::date;

      INSERT INTO beach_reviews (
        beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating,
        parking_rating, accessibility_rating, title, content, visit_date, created_at, updated_at
      ) VALUES (
        b.id, u, ov, wq, cd, pr, ac, base_title, base_content, visit_dt, created_at_ts, created_at_ts
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Beach reviews seeding complete.';
END $$;

-- =========================
-- Quick verification queries
-- =========================
-- SELECT b.name, COUNT(*) FROM beach_reviews br JOIN beaches b ON b.id = br.beach_id GROUP BY 1 ORDER BY 2 DESC;
-- SELECT * FROM beach_reviews ORDER BY created_at DESC LIMIT 10;


