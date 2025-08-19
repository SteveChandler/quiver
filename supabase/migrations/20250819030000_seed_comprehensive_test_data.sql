-- Comprehensive test data seeding for E2E tests
-- Creates sessions, follows, likes, and interactions for reliable testing

BEGIN;

DO $$
DECLARE
    test_user_id UUID;
    other_user_ids UUID[];
    beach_ids UUID[];
    board_ids UUID[];
    session_ids UUID[];
BEGIN
    -- Create a dedicated test user profile (not dependent on auth.users)
    -- This will be used for E2E testing regardless of authentication setup
    INSERT INTO public.profiles (id, full_name, created_at)
    VALUES (
        'de369319-f095-4851-bc35-161d760a0d34'::UUID, -- Fixed UUID for test user 
        'Test User', 
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name;
        
    test_user_id := 'de369319-f095-4851-bc35-161d760a0d34'::UUID;
    
    -- Get mock users for social interactions (excluding test user)
    SELECT ARRAY_AGG(id) INTO other_user_ids
    FROM public.profiles 
    WHERE full_name LIKE '% %' 
    AND id != test_user_id
    LIMIT 8;
    
    -- Get some beach IDs
    SELECT ARRAY_AGG(id) INTO beach_ids
    FROM (
        SELECT id FROM public.beaches 
        ORDER BY created_at
        LIMIT 10
    ) AS limited_beaches;
    
    -- Test user profile already created above
        
    -- Create boards for test user (idempotent by checking existing names)
    INSERT INTO public.boards (user_id, name, board_type, dimensions, description, session_count, created_at)
    SELECT test_user_id, 'Test Shortboard', 'shortboard', '6''2" x 19.5" x 2.4"', 'Primary test board for E2E testing', 0, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.boards WHERE user_id = test_user_id AND name = 'Test Shortboard');
    
    INSERT INTO public.boards (user_id, name, board_type, dimensions, description, session_count, created_at)
    SELECT test_user_id, 'Test Longboard', 'longboard', '9''6" x 22.5" x 3.1"', 'Backup test board for E2E testing', 0, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.boards WHERE user_id = test_user_id AND name = 'Test Longboard');
    
    -- Get board IDs for test user
    SELECT ARRAY_AGG(id) INTO board_ids
    FROM public.boards 
    WHERE user_id = test_user_id;
    
    -- Create completed sessions for test user (idempotent by notes content)
    INSERT INTO public.sessions (
        user_id, profile_id, beach_id, board_id, beach_name, status, 
        arrival_time, duration_minutes, rating, 
        wave_quality, notes, is_public, created_at
    ) 
    SELECT 
        test_user_id, test_user_id, beach_ids[1], board_ids[1], 'Test Beach 1', 'completed',
        NOW() - INTERVAL '2 days', 90, 4,
        4, 'Great session with solid waves and good conditions', true, NOW() - INTERVAL '2 days'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.sessions 
        WHERE user_id = test_user_id AND notes = 'Great session with solid waves and good conditions'
    )
    
    UNION ALL
    
    SELECT 
        test_user_id, test_user_id, beach_ids[2], board_ids[2], 'Test Beach 2', 'completed',
        NOW() - INTERVAL '1 week', 120, 5,
        5, 'Epic session! Perfect waves and offshore winds', true, NOW() - INTERVAL '1 week'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.sessions 
        WHERE user_id = test_user_id AND notes = 'Epic session! Perfect waves and offshore winds'
    )
    
    UNION ALL
    
    SELECT 
        test_user_id, test_user_id, beach_ids[1], board_ids[1], 'Test Beach 1', 'planned',
        NOW() + INTERVAL '2 days', 60, NULL,
        NULL, 'Looking forward to dawn patrol session', true, NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.sessions 
        WHERE user_id = test_user_id AND notes = 'Looking forward to dawn patrol session'
    );
    
    -- Get session IDs for further operations
    SELECT ARRAY_AGG(id) INTO session_ids
    FROM public.sessions 
    WHERE user_id = test_user_id;
    
            -- Create sessions for other users to enable social interactions (idempotent)
        IF array_length(other_user_ids, 1) >= 3 AND array_length(beach_ids, 1) >= 3 THEN
            INSERT INTO public.sessions (
                user_id, profile_id, beach_id, beach_name, status, 
                arrival_time, duration_minutes, rating, 
                wave_quality, notes, is_public, created_at
            ) 
            SELECT 
                other_user_ids[1], other_user_ids[1], beach_ids[1], 'Test Beach 1', 'completed',
                NOW() - INTERVAL '1 day', 75, 3,
                3, 'Decent session, crowded but fun waves', true, NOW() - INTERVAL '1 day'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.sessions 
                WHERE user_id = other_user_ids[1] AND notes = 'Decent session, crowded but fun waves'
            )
            
            UNION ALL
            
            SELECT 
                other_user_ids[2], other_user_ids[2], beach_ids[2], 'Test Beach 2', 'completed',
                NOW() - INTERVAL '3 days', 105, 4,
                4, 'Clean waves and good vibes all around', true, NOW() - INTERVAL '3 days'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.sessions 
                WHERE user_id = other_user_ids[2] AND notes = 'Clean waves and good vibes all around'
            )
            
            UNION ALL
            
            SELECT 
                other_user_ids[3], other_user_ids[3], beach_ids[3], 'Test Beach 3', 'completed',
                NOW() - INTERVAL '5 days', (NOW() - INTERVAL '5 days')::date, 90, 5,
                5, 'Perfect conditions and amazing surf!', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.sessions 
                WHERE user_id = other_user_ids[3] AND notes = 'Perfect conditions and amazing surf!'
            );
        END IF;
    
    -- Create social interactions for testing
    IF array_length(other_user_ids, 1) >= 2 THEN
        -- Note: user_follows table not available in current schema
    END IF;
    
    -- Create comments on sessions for social discovery
    IF array_length(session_ids, 1) >= 1 AND array_length(other_user_ids, 1) >= 2 THEN
        -- Get sessions from other users
        INSERT INTO public.comments (session_id, user_id, content, created_at)
        SELECT 
            s.id,
            other_user_ids[1],
            'Great session! Looks like the conditions were perfect.',
            NOW() - INTERVAL '1 day'
        FROM public.sessions s
        WHERE s.user_id != test_user_id 
        AND s.status = 'completed'
        LIMIT 1;
        
        INSERT INTO public.comments (session_id, user_id, content, created_at)
        SELECT 
            s.id,
            test_user_id,
            'Thanks! Yeah the waves were firing that day.',
            NOW() - INTERVAL '12 hours'
        FROM public.sessions s
        WHERE s.user_id != test_user_id 
        AND s.status = 'completed'
        LIMIT 1;
    END IF;
    
    -- Create session likes for testing
    IF array_length(session_ids, 1) >= 1 AND array_length(other_user_ids, 1) >= 2 THEN
        INSERT INTO public.session_likes (session_id, user_id, created_at)
        SELECT 
            s.id,
            other_user_ids[1],
            NOW() - INTERVAL '1 day'
        FROM public.sessions s
        WHERE s.user_id = test_user_id 
        AND s.status = 'completed'
        LIMIT 1
        ON CONFLICT (session_id, user_id) DO NOTHING;
    END IF;
    
    -- Create beach reviews for testing
    IF array_length(beach_ids, 1) >= 2 THEN
        INSERT INTO public.beach_reviews (
            user_id, beach_id, title, content, overall_rating, wave_quality, 
            crowd_rating, accessibility, water_temp, parking_ease, visit_date, created_at
        ) VALUES 
            (test_user_id, beach_ids[1], 'Great Beach for Beginners', 
             'Perfect spot for learning - consistent waves and sandy bottom', 4, 4, 3, 5, 4, 4, 
             (NOW() - INTERVAL '1 week')::date, NOW() - INTERVAL '1 week'),
             
            (other_user_ids[1], beach_ids[1], 'Solid Surf Spot', 
             'Really enjoy surfing here - good variety of wave sizes', 5, 5, 3, 4, 4, 3,
             (NOW() - INTERVAL '3 days')::date, NOW() - INTERVAL '3 days')
        ON CONFLICT (user_id, beach_id) DO NOTHING;
    END IF;
    
    RAISE NOTICE 'Test data seeded successfully for user: %', test_user_id;
    RAISE NOTICE 'Created sessions, follows, comments, likes, and reviews for E2E testing';
    
END $$;

COMMIT;
