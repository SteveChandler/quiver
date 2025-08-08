-- ================================================
-- Last-Week Community Mock Data for Quiver
-- ================================================
-- Purpose: Populate realistic data for the past 7 days to
--          exercise new features:
--          - Community Check-Ins (check_ins)
--          - Intel posts with surf condition fields (intel_posts)
--          - Intel post confirmations and counts
--
-- Usage: Run in Supabase SQL editor after your base data exists
--        (beaches, personas from comprehensive mock data, etc.)
-- ================================================

-- If the intel_posts surf condition migration hasn't been applied yet,
-- add the needed columns so this script can run. Prefer running the
-- official migration at supabase/migrations/20250116000001_add_surf_conditions_to_intel_posts.sql
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
    -- Persona user IDs (replace with your actual UUIDs if different)
    liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
    big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
    solid_snake_id UUID := '638edbd2-7fd3-49b5-8129-84456764df4c'::UUID;
    rookie_riley_id UUID := '05f3d22c-a282-4252-bb54-64dcb74a83dd'::UUID;
    local_larry_id UUID := '382c284f-e36d-43cd-8e44-0930544db459'::UUID;
    travel_tina_id UUID := '701beae0-96aa-43d4-a29a-4353ead6ea24'::UUID;
    photo_paul_id UUID := '31d78eb7-357e-444e-88cd-d728ebf4f1ae'::UUID;
    dawn_dana_id UUID := '3958e9bb-acf8-45a1-ab20-7953ec1cb0e7'::UUID;

    user_ids UUID[] := ARRAY[local_larry_id, dawn_dana_id, rookie_riley_id, photo_paul_id, solid_snake_id, liquid_snake_id];

    -- Beach IDs used frequently in SD
    ob_id UUID;
    pb_id UUID;
    mission_id UUID;
    shores_id UUID;
    windansea_id UUID;
    blacks_id UUID;
    swamis_id UUID;
    cliffs_id UUID;

    day_offset INTEGER;
    picked_user UUID;
    picked_beach UUID;
    ts TIMESTAMP WITH TIME ZONE;
    wd TEXT;
    acc TEXT;
    cr INT;

BEGIN
    RAISE NOTICE 'Creating last-week community mock data...';

    -- Resolve beach IDs by name
    SELECT id INTO ob_id FROM beaches WHERE name = 'Ocean Beach' LIMIT 1;
    SELECT id INTO pb_id FROM beaches WHERE name = 'Pacific Beach' LIMIT 1;
    SELECT id INTO mission_id FROM beaches WHERE name = 'Mission Beach' LIMIT 1;
    SELECT id INTO shores_id FROM beaches WHERE name = 'La Jolla Shores' LIMIT 1;
    SELECT id INTO windansea_id FROM beaches WHERE name = 'Windansea Beach' LIMIT 1;
    SELECT id INTO blacks_id FROM beaches WHERE name = 'Blacks Beach' LIMIT 1;
    SELECT id INTO swamis_id FROM beaches WHERE name = 'Swami''s Beach' LIMIT 1;
    SELECT id INTO cliffs_id FROM beaches WHERE name = 'Sunset Cliffs' LIMIT 1;

    -- ================================================
    -- Check-Ins: 28-35 realistic entries over the last week
    -- ================================================
    FOR day_offset IN 0..6 LOOP
        -- Create 4-6 check-ins per day across various beaches and users
        FOR cr IN 1..(4 + FLOOR(RANDOM() * 3)) LOOP
            -- Random user and beach selection favoring OB, Shores, PB
            picked_user := user_ids[1 + FLOOR(RANDOM() * array_length(user_ids, 1))];
            picked_beach := (ARRAY[ob_id, shores_id, pb_id, mission_id, windansea_id, blacks_id, swamis_id, cliffs_id])[1 + FLOOR(RANDOM() * 8)];

            -- Morning vs afternoon timestamp within each day
            ts := NOW() - (day_offset || ' days')::interval
                  + (CASE WHEN RANDOM() < 0.5 THEN '06:00:00' ELSE '15:00:00' END)::time
                  + (FLOOR(RANDOM() * 120) || ' minutes')::interval;

            -- Allowed wind directions
            wd := (ARRAY['N','NE','E','SE','S','SW','W','NW','OFFSHORE','ONSHORE','CROSS'])[1 + FLOOR(RANDOM() * 12)];

            -- Accuracy distribution: mostly accurate/somewhat
            acc := (CASE 
                WHEN RANDOM() < 0.6 THEN 'accurate'
                WHEN RANDOM() < 0.85 THEN 'somewhat'
                ELSE 'inaccurate'
            END);

            INSERT INTO check_ins (
                user_id, beach_id, checked_in_at,
                wave_height, wind_speed, wind_direction, water_temp,
                crowd_level, vibe, forecast_accuracy_rating
            ) VALUES (
                picked_user,
                picked_beach,
                ts,
                ROUND((2.0 + RANDOM() * 4.0)::numeric, 1),          -- 2.0 - 6.0 ft
                ROUND((3.0 + RANDOM() * 15.0)::numeric, 1),         -- 3 - 18 mph
                wd,
                ROUND((63.0 + RANDOM() * 6.0)::numeric, 1),         -- 63 - 69 F
                1 + FLOOR(RANDOM() * 5),                             -- 1-5
                CASE FLOOR(RANDOM() * 6)
                    WHEN 0 THEN 'Mellow vibes, lots of smiles in the lineup'
                    WHEN 1 THEN 'Punchy peaks with short lulls'
                    WHEN 2 THEN 'Clean faces early, bit of crumble later'
                    WHEN 3 THEN 'Crowded but respectful; sets every 8-10min'
                    WHEN 4 THEN 'Wind picked up, still fun on insiders'
                    ELSE 'Glass-off window was money; super fun'
                END,
                acc
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Inserted last-week check-ins.';

    -- ================================================
    -- Intel Posts: recent condition posts with surf condition fields
    -- ================================================
    -- Ocean Beach, La Jolla Shores, PB, Blacks, Swami's, Sunset Cliffs
    INSERT INTO intel_posts (
        user_id, latitude, longitude, tag, title, description, confirmations_count,
        is_active, expires_at, created_at,
        wave_height, wind_speed, wind_direction, water_temp, crowd_level, wave_types, forecast_accuracy
    ) VALUES
      -- OB
      (local_larry_id, 32.7507, -117.2540, 'conditions', 'OB firing on the tide push',
       '4ft peaky with light offshore; north end a bit cleaner', 0, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '2 days 3 hours',
       4.0, 6.0, 'OFFSHORE', 65, 3, ARRAY['peaky','clean'], 'accurate'),
      (dawn_dana_id, 32.7509, -117.2541, 'conditions', 'Dawn patrol gold at OB',
       'Chest to shoulder with groomed walls; best before 7am', 0, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '5 days 1 hour',
       3.5, 4.5, 'N', 64, 2, ARRAY['clean','powerful'], 'accurate'),

      -- La Jolla Shores
      (photo_paul_id, 32.8507, -117.2726, 'conditions', 'Perfect light at Shores',
       'Great for learners, photogenic lines and clear water', 0, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '1 day 2 hours',
       2.5, 5.0, 'NE', 65, 2, ARRAY['mushy','peaky'], 'somewhat'),
      (rookie_riley_id, 32.8505, -117.2724, 'conditions', 'Super friendly waves today',
       'Lots of beginners; easy takeoffs and long whitewater rides', 0, true, NOW() + INTERVAL '8 hours', NOW() - INTERVAL '3 days 4 hours',
       2.0, 7.5, 'ONSHORE', 66, 4, ARRAY['fat','mushy'], 'somewhat'),

      -- Pacific Beach
      (local_larry_id, 32.8030, -117.2405, 'conditions', 'PB cleaner than expected',
       'Chest high sets with workable shoulders near the pier', 0, true, NOW() + INTERVAL '10 hours', NOW() - INTERVAL '6 days 30 minutes',
       3.0, 8.0, 'NW', 65, 3, ARRAY['clean','peaky'], 'accurate'),

      -- Blacks
      (solid_snake_id, 32.9016, -117.2524, 'conditions', 'Blacks has punch',
       'Powerful drops; advanced only; currents sketchy on the north end', 0, true, NOW() + INTERVAL '5 hours', NOW() - INTERVAL '4 days 2 hours',
       5.0, 9.5, 'CROSS', 64, 3, ARRAY['powerful','barreling'], 'somewhat'),

      -- Swami's
      (dawn_dana_id, 33.0362, -117.3032, 'conditions', 'Swami''s lines this morning',
       'Long walls with minimal wind early; crowd manageable', 0, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '2 days 5 hours',
       3.5, 5.0, 'OFFSHORE', 65, 3, ARRAY['clean','reform'], 'accurate'),

      -- Sunset Cliffs
      (liquid_snake_id, 32.7351, -117.2519, 'conditions', 'Cliffs showing shape',
       'Inside reefs have fun peaks; watch the tide swings', 0, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '1 days 6 hours',
       3.0, 10.0, 'W', 65, 2, ARRAY['peaky','clean'], 'somewhat'),

      -- Variety tags (hazard/parking)
      (travel_tina_id, 33.0362, -117.3032, 'parking', 'Swami''s parking tight',
       'Lot full by 7:10am; best to park uphill and walk', 0, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 days 2 hours',
       NULL, NULL, NULL, NULL, 5, ARRAY['clean'], NULL),
      (local_larry_id, 32.9016, -117.2524, 'hazard', 'Blacks rip on the north end',
       'Heavy north rip; recommend experienced surfers only', 0, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 days 1 hour',
       NULL, 11.0, 'CROSS', 64, 3, ARRAY['powerful'], NULL),
      (photo_paul_id, 32.7507, -117.2540, 'hazard', 'OB shorebreak slam',
       'Low tide shorebreak dumping; beware board-snappers', 0, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '6 days 3 hours',
       4.0, 12.0, 'W', 65, 3, ARRAY['closeouts'], 'inaccurate');

    RAISE NOTICE 'Inserted intel condition/variety posts.';

    -- Confirmations for recent intel posts; then recompute counts
    INSERT INTO intel_post_confirmations (intel_post_id, user_id, created_at)
    SELECT ip.id, conf_user, NOW() - INTERVAL '1 hour' * (1 + FLOOR(RANDOM() * 6))
    FROM (
      SELECT id, user_id FROM intel_posts
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 10
    ) ip
    CROSS JOIN LATERAL (
      SELECT unnest(ARRAY[liquid_snake_id, big_boss_id, rookie_riley_id, local_larry_id, travel_tina_id, photo_paul_id, dawn_dana_id]) AS conf_user
    ) u
    WHERE ip.user_id <> u.conf_user
    AND RANDOM() < 0.20 -- ~20% of cross-joins create confirmations
    ON CONFLICT (intel_post_id, user_id) DO NOTHING;

    UPDATE intel_posts SET confirmations_count = (
      SELECT COUNT(*) FROM intel_post_confirmations c WHERE c.intel_post_id = intel_posts.id
    )
    WHERE created_at > NOW() - INTERVAL '7 days';

    RAISE NOTICE 'Updated intel confirmation counts.';

    -- ================================================
    -- Quick verification
    -- ================================================
    RAISE NOTICE 'Check-in counts last 7 days: %', (SELECT COUNT(*) FROM check_ins WHERE checked_in_at > NOW() - INTERVAL '7 days');
    RAISE NOTICE 'Intel posts last 7 days: %', (SELECT COUNT(*) FROM intel_posts WHERE created_at > NOW() - INTERVAL '7 days');

END $$;

-- Verification Queries (optional to run manually)
-- SELECT beach_id, COUNT(*) FROM check_ins WHERE checked_in_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 2 DESC;
-- SELECT tag, COUNT(*) FROM intel_posts WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1;
-- SELECT * FROM get_forecast_accuracy_stats((SELECT id FROM beaches WHERE name='Ocean Beach'), 7);
-- SELECT * FROM get_forecast_accuracy_stats((SELECT id FROM beaches WHERE name='La Jolla Shores'), 7);

