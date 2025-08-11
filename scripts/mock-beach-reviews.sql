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
  -- Persona user IDs (ensure these exist in auth.users and profiles)
  liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
  big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
  solid_snake_id UUID := '638edbd2-7fd3-49b5-8129-84456764df4c'::UUID;
  rookie_riley_id UUID := '05f3d22c-a282-4252-bb54-64dcb74a83dd'::UUID;
  local_larry_id UUID := '382c284f-e36d-43cd-8e44-0930544db459'::UUID;
  travel_tina_id UUID := '701beae0-96aa-43d4-a29a-4353ead6ea24'::UUID;
  photo_paul_id UUID := '31d78eb7-357e-444e-88cd-d728ebf4f1ae'::UUID;
  dawn_dana_id UUID := '3958e9bb-acf8-45a1-ab20-7953ec1cb0e7'::UUID;

  users UUID[] := ARRAY[
    liquid_snake_id, big_boss_id, solid_snake_id,
    rookie_riley_id, local_larry_id, travel_tina_id,
    photo_paul_id, dawn_dana_id
  ];

  b RECORD;
  u UUID;
  created_at_ts TIMESTAMPTZ;
  visit_dt DATE;
  base_title TEXT;
  base_content TEXT;
  ov INT; wq INT; cd INT; pr INT; ac INT;
BEGIN
  RAISE NOTICE 'Seeding beach reviews...';

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


