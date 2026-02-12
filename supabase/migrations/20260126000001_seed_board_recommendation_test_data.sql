-- SAFE: Seed board recommendation test data for development and testing
-- Creates a test user with boards and sessions to generate confident board recommendations
--
-- This migration:
-- 1. Creates test user "Board Rec Test User"
-- 2. Creates 3 boards: Shortboard, Fish, Longboard
-- 3. Creates 30+ sessions across different conditions with ratings
-- 4. Links sessions to boards with board_snapshot populated
--
-- IMPORTANT: This migration ONLY ADDS new test data - it does NOT delete existing data

BEGIN;

-- ================================================
-- 1. Create test user profile for board recommendations
-- ================================================
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    shortboard_id UUID := gen_random_uuid();
    fish_id UUID := gen_random_uuid();
    longboard_id UUID := gen_random_uuid();
    session_id UUID;
    beach_record RECORD;
    beach_ids UUID[];
    random_beach_id UUID;
    i INTEGER;
BEGIN
    -- Check if test user already exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE full_name = 'Board Rec Test User') THEN
        RAISE NOTICE 'Board Rec Test User already exists, skipping seed data';
        RETURN;
    END IF;

    -- Create test user profile
    INSERT INTO public.profiles (
        id,
        full_name,
        favorite_spot,
        email_session_invites,
        inapp_session_invites,
        digest_session_invites,
        followers_count,
        following_count,
        created_at
    ) VALUES (
        test_user_id,
        'Board Rec Test User',
        'The Pier',
        true,
        true,
        true,
        25,
        15,
        NOW() - INTERVAL '2 years'
    );

    RAISE NOTICE 'Created test user: %', test_user_id;

    -- ================================================
    -- 2. Create boards for test user
    -- ================================================

    -- Shortboard: Good for medium to large waves (3-8ft)
    INSERT INTO public.boards (
        id,
        user_id,
        name,
        board_type,
        dimensions,
        description,
        session_count,
        created_at
    ) VALUES (
        shortboard_id,
        test_user_id,
        'Performance Thruster',
        'shortboard',
        '6''2" x 19" x 2.5"',
        'High-performance shortboard for punchy beach breaks',
        0,
        NOW() - INTERVAL '18 months'
    );

    -- Fish: Good for small to medium waves (1-4ft)
    INSERT INTO public.boards (
        id,
        user_id,
        name,
        board_type,
        dimensions,
        description,
        session_count,
        created_at
    ) VALUES (
        fish_id,
        test_user_id,
        'Retro Fish',
        'fish',
        '5''8" x 21" x 2.75"',
        'Classic twin fin fish for mushy days',
        0,
        NOW() - INTERVAL '12 months'
    );

    -- Longboard: Good for small waves (1-3ft)
    INSERT INTO public.boards (
        id,
        user_id,
        name,
        board_type,
        dimensions,
        description,
        session_count,
        created_at
    ) VALUES (
        longboard_id,
        test_user_id,
        'Classic Noserider',
        'longboard',
        '9''6" x 23" x 3.25"',
        'Single fin log for smooth gliding',
        0,
        NOW() - INTERVAL '24 months'
    );

    RAISE NOTICE 'Created boards - Shortboard: %, Fish: %, Longboard: %', shortboard_id, fish_id, longboard_id;

    -- ================================================
    -- 3. Get beach IDs for sessions
    -- ================================================
    SELECT ARRAY_AGG(id) INTO beach_ids
    FROM (
        SELECT id FROM public.beaches
        WHERE deleted_at IS NULL
        ORDER BY RANDOM()
        LIMIT 10
    ) b;

    -- Fallback if no beaches exist
    IF beach_ids IS NULL OR array_length(beach_ids, 1) IS NULL THEN
        RAISE NOTICE 'No beaches found, skipping session creation';
        RETURN;
    END IF;

    RAISE NOTICE 'Found % beaches for sessions', array_length(beach_ids, 1);

    -- ================================================
    -- 4. Create sessions with board recommendations
    -- ================================================

    -- Temporarily disable the beach affinity trigger to avoid FK issues
    -- (Test user exists in public.profiles but not auth.users, and
    -- user_beach_affinity FK references auth.users)
    ALTER TABLE sessions DISABLE TRIGGER update_beach_affinity_trigger;

    -- Sessions with Shortboard (medium-large waves, 3-6ft)
    -- Should be recommended for waves 3-8ft
    FOR i IN 1..12 LOOP
        random_beach_id := beach_ids[1 + floor(random() * array_length(beach_ids, 1))::int];

        INSERT INTO public.sessions (
            id,
            user_id,
            profile_id,
            beach_id,
            board_id,
            beach_name,
            status,
            arrival_time,
            duration_minutes,
            wave_quality,
            rating,
            description,
            notes,
            board_snapshot,
            created_at
        ) VALUES (
            gen_random_uuid(),
            test_user_id,
            test_user_id,
            random_beach_id,
            shortboard_id,
            (SELECT name FROM public.beaches WHERE id = random_beach_id LIMIT 1),
            'completed',
            NOW() - (INTERVAL '1 day' * (i * 7 + floor(random() * 5)::int)),
            90 + floor(random() * 60)::int,
            -- Wave quality (1-10 scale, shortboard good in 4-7)
            4 + floor(random() * 4)::int,
            -- High rating for appropriate conditions (4-5)
            4 + floor(random() * 2)::int,
            'Great session on the shortboard',
            CASE i % 3
                WHEN 0 THEN 'Punchy peaks, perfect for turns'
                WHEN 1 THEN 'Overhead sets, needed the performance board'
                ELSE 'Fast walls, got some good barrels'
            END,
            jsonb_build_object(
                'name', 'Performance Thruster',
                'board_type', 'shortboard',
                'dimensions', '6''2" x 19" x 2.5"'
            ),
            NOW() - (INTERVAL '1 day' * (i * 7 + floor(random() * 5)::int))
        );
    END LOOP;

    -- Sessions with Fish (small-medium waves, 1-4ft)
    -- Should be recommended for waves 1-4ft
    FOR i IN 1..12 LOOP
        random_beach_id := beach_ids[1 + floor(random() * array_length(beach_ids, 1))::int];

        INSERT INTO public.sessions (
            id,
            user_id,
            profile_id,
            beach_id,
            board_id,
            beach_name,
            status,
            arrival_time,
            duration_minutes,
            wave_quality,
            rating,
            description,
            notes,
            board_snapshot,
            created_at
        ) VALUES (
            gen_random_uuid(),
            test_user_id,
            test_user_id,
            random_beach_id,
            fish_id,
            (SELECT name FROM public.beaches WHERE id = random_beach_id LIMIT 1),
            'completed',
            NOW() - (INTERVAL '1 day' * (i * 6 + floor(random() * 4)::int)),
            60 + floor(random() * 45)::int,
            -- Wave quality (1-10 scale, fish good in 2-4)
            2 + floor(random() * 3)::int,
            -- High rating for small wave performance (4-5)
            4 + floor(random() * 2)::int,
            'Fun mushy wave session on the fish',
            CASE i % 3
                WHEN 0 THEN 'Perfect small wave day, fish was flying'
                WHEN 1 THEN 'Waist high and fun, twin fin magic'
                ELSE 'Mellow morning, great for the fish'
            END,
            jsonb_build_object(
                'name', 'Retro Fish',
                'board_type', 'fish',
                'dimensions', '5''8" x 21" x 2.75"'
            ),
            NOW() - (INTERVAL '1 day' * (i * 6 + floor(random() * 4)::int))
        );
    END LOOP;

    -- Sessions with Longboard (tiny waves, 1-2ft)
    -- Should be recommended for waves 0-2ft
    FOR i IN 1..12 LOOP
        random_beach_id := beach_ids[1 + floor(random() * array_length(beach_ids, 1))::int];

        INSERT INTO public.sessions (
            id,
            user_id,
            profile_id,
            beach_id,
            board_id,
            beach_name,
            status,
            arrival_time,
            duration_minutes,
            wave_quality,
            rating,
            description,
            notes,
            board_snapshot,
            created_at
        ) VALUES (
            gen_random_uuid(),
            test_user_id,
            test_user_id,
            random_beach_id,
            longboard_id,
            (SELECT name FROM public.beaches WHERE id = random_beach_id LIMIT 1),
            'completed',
            NOW() - (INTERVAL '1 day' * (i * 8 + floor(random() * 6)::int)),
            75 + floor(random() * 45)::int,
            -- Wave quality (1-10 scale, longboard good in 1-3)
            1 + floor(random() * 3)::int,
            -- High rating for tiny wave fun (3-5)
            3 + floor(random() * 3)::int,
            'Mellow longboard session',
            CASE i % 3
                WHEN 0 THEN 'Flat day saved by the log'
                WHEN 1 THEN 'Knee high gliders, hung ten a few times'
                ELSE 'Super small but still caught waves on the log'
            END,
            jsonb_build_object(
                'name', 'Classic Noserider',
                'board_type', 'longboard',
                'dimensions', '9''6" x 23" x 3.25"'
            ),
            NOW() - (INTERVAL '1 day' * (i * 8 + floor(random() * 6)::int))
        );
    END LOOP;

    -- Add a few sessions with lower ratings to show the algorithm works
    -- These shouldn't dominate recommendations
    FOR i IN 1..3 LOOP
        random_beach_id := beach_ids[1 + floor(random() * array_length(beach_ids, 1))::int];

        -- Shortboard in small waves = low rating
        INSERT INTO public.sessions (
            id,
            user_id,
            profile_id,
            beach_id,
            board_id,
            beach_name,
            status,
            arrival_time,
            duration_minutes,
            wave_quality,
            rating,
            description,
            notes,
            board_snapshot,
            created_at
        ) VALUES (
            gen_random_uuid(),
            test_user_id,
            test_user_id,
            random_beach_id,
            shortboard_id,
            (SELECT name FROM public.beaches WHERE id = random_beach_id LIMIT 1),
            'completed',
            NOW() - (INTERVAL '1 day' * (i * 15)),
            45,
            2, -- Small waves
            2, -- Low rating - wrong board
            'Struggled with the shortboard in small waves',
            'Should have brought the fish',
            jsonb_build_object(
                'name', 'Performance Thruster',
                'board_type', 'shortboard',
                'dimensions', '6''2" x 19" x 2.5"'
            ),
            NOW() - (INTERVAL '1 day' * (i * 15))
        );
    END LOOP;

    -- Re-enable the beach affinity trigger
    ALTER TABLE sessions ENABLE TRIGGER update_beach_affinity_trigger;

    -- Update board session counts
    UPDATE public.boards SET session_count = (
        SELECT COUNT(*) FROM public.sessions WHERE board_id = boards.id
    ) WHERE user_id = test_user_id;

    RAISE NOTICE 'Created sessions for board recommendation testing';
    RAISE NOTICE 'Test user ID: % (use this to test board recommendations)', test_user_id;
END $$;

COMMIT;

-- ================================================
-- VALIDATION QUERIES
-- ================================================
--
-- Verify test user was created:
-- SELECT id, full_name FROM public.profiles WHERE full_name = 'Board Rec Test User';
--
-- Check boards for test user:
-- SELECT b.id, b.name, b.board_type, b.session_count
-- FROM public.boards b
-- JOIN public.profiles p ON b.user_id = p.id
-- WHERE p.full_name = 'Board Rec Test User';
--
-- Check sessions by board:
-- SELECT
--   b.name as board_name,
--   COUNT(*) as session_count,
--   AVG(s.rating) as avg_rating,
--   AVG(s.wave_quality) as avg_wave_quality
-- FROM public.sessions s
-- JOIN public.boards b ON s.board_id = b.id
-- JOIN public.profiles p ON s.user_id = p.id
-- WHERE p.full_name = 'Board Rec Test User'
-- GROUP BY b.name
-- ORDER BY b.name;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DELETE FROM public.sessions WHERE user_id IN (
--   SELECT id FROM public.profiles WHERE full_name = 'Board Rec Test User'
-- );
-- DELETE FROM public.boards WHERE user_id IN (
--   SELECT id FROM public.profiles WHERE full_name = 'Board Rec Test User'
-- );
-- DELETE FROM public.profiles WHERE full_name = 'Board Rec Test User';
-- COMMIT;
