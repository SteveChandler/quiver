-- ================================================
-- Create Liquid Snake User with Dummy Data
-- ================================================
-- This script creates a complete user profile for "Liquid Snake" with:
-- 1. Auth user and profile
-- 2. Beach reviews for multiple beaches
-- 3. 10 surf sessions at Pacific Beach before today
-- 4. A custom surfboard in their quiver

-- ================================================
-- Step 1: Create Auth User and Profile
-- ================================================

-- Generate a consistent UUID for Liquid Snake
-- In production, you would typically create the auth user through Supabase Auth API
-- This is for testing/demo purposes only

DO $$
DECLARE
    liquid_snake_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
    pacific_beach_id UUID;
    session_ids UUID[] := ARRAY[]::UUID[];
    i INTEGER;
BEGIN
    -- ================================================
    -- Fix the handle_new_user trigger function first
    -- ================================================
    
    -- Check if the handle_new_user function exists and fix it
    DO $fix_trigger$
    BEGIN
        -- Check if the function exists
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
            -- Drop and recreate the function with correct schema
            DROP FUNCTION IF EXISTS handle_new_user();
            
            CREATE OR REPLACE FUNCTION handle_new_user()
            RETURNS TRIGGER AS $$
            BEGIN
                INSERT INTO public.profiles(id, full_name, email)
                VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
                ON CONFLICT (id) DO NOTHING;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
            
            -- Recreate the trigger
            DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
            CREATE TRIGGER on_auth_user_created
                AFTER INSERT ON auth.users
                FOR EACH ROW EXECUTE FUNCTION handle_new_user();
                
            RAISE NOTICE 'Fixed handle_new_user trigger function';
        END IF;
    END $fix_trigger$;

    -- ================================================
    -- Create auth user (normally done via Supabase Auth)
    -- ================================================
    
    -- NOTE: In production, create the user via Supabase Auth dashboard or API
    -- This direct insertion is for testing purposes only
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        liquid_snake_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'liquid.snake@foxhound.mil',
        crypt('MetalGear2024!', gen_salt('bf')), -- Encrypted password
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Liquid Snake", "email": "liquid.snake@foxhound.mil"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (id) DO NOTHING;

    -- ================================================
    -- Create Profile
    -- ================================================
    
    INSERT INTO profiles (
        id,
        full_name,
        email,
        phone_number,
        avatar_url,
        bio,
        location,
        experience_level,
        instagram,
        notification_session_reminders,
        notification_community_replies,
        followers_count,
        following_count,
        created_at,
        updated_at
    ) VALUES (
        liquid_snake_id,
        'Liquid Snake',
        'liquid.snake@foxhound.mil',
        '+1-555-METAL-GEAR',
        '/placeholder.svg?height=200&width=200',
        'Former FOXHOUND operative turned surfer. Seeking the perfect wave and ultimate freedom on the water. Twin to Solid Snake. "I live on through this arm!" 🌊🏄‍♂️',
        'Shadow Moses Island → Pacific Beach, CA',
        'expert',
        '@liquid_wave_snake',
        true,
        true,
        42,
        33,
        NOW() - INTERVAL '6 months',
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        bio = EXCLUDED.bio;

    -- ================================================
    -- Ensure Pacific Beach exists and get its ID
    -- ================================================
    
    SELECT id INTO pacific_beach_id 
    FROM beaches 
    WHERE LOWER(name) LIKE '%pacific beach%' 
    LIMIT 1;
    
    -- If Pacific Beach doesn't exist, create it
    IF pacific_beach_id IS NULL THEN
        INSERT INTO beaches (
            name,
            latitude,
            longitude,
            location_text,
            description,
            wave_quality_rating,
            crowd_density_rating,
            parking_rating,
            accessibility_rating,
            created_at,
            updated_at
        ) VALUES (
            'Pacific Beach',
            32.803,
            -117.2405,
            'Pacific Beach, San Diego, CA',
            'Popular San Diego beach known for consistent surf, vibrant nightlife, and beach volleyball courts. Great for intermediate to advanced surfers.',
            4.2,
            3.8,
            3.5,
            4.0,
            NOW(),
            NOW()
        ) RETURNING id INTO pacific_beach_id;
        
        RAISE NOTICE 'Created Pacific Beach with ID: %', pacific_beach_id;
    ELSE
        RAISE NOTICE 'Found Pacific Beach with ID: %', pacific_beach_id;
    END IF;

    -- ================================================
    -- Create a Custom Surfboard for Liquid Snake
    -- ================================================
    
    INSERT INTO boards (
        user_id,
        name
    ) VALUES (
        liquid_snake_id,
        'Metal Gear REX (Custom Shortboard by Custom Shaper)'
    ) ON CONFLICT DO NOTHING;

    -- ================================================
    -- Create Beach Reviews
    -- ================================================
    
    -- Review for Pacific Beach
    INSERT INTO beach_reviews (
        beach_id,
        user_id,
        overall_rating,
        wave_quality_rating,
        crowd_density_rating,
        parking_rating,
        accessibility_rating,
        title,
        content,
        visit_date,
        created_at,
        updated_at
    ) VALUES (
        pacific_beach_id,
        liquid_snake_id,
        5,
        5,
        3,
        3,
        4,
        'Perfect training ground for tactical water operations',
        'This beach provides excellent conditions for honing aquatic combat skills. The waves offer consistent challenge, though civilian presence can be... distracting. The pier serves as an excellent observation point. Parking situation reminds me of infiltration missions - patience required. Would recommend for any operative seeking to master water-based maneuvers.',
        CURRENT_DATE - INTERVAL '45 days',
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '30 days'
    ) ON CONFLICT (beach_id, user_id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content;

    -- Add reviews for other beaches (create them if they don't exist)
    -- Ocean Beach Review
    INSERT INTO beaches (name, latitude, longitude, location_text, description, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating)
    VALUES ('Ocean Beach', 32.7503, -117.2534, 'Ocean Beach, San Diego, CA', 'Bohemian beach community with powerful waves', 4.1, 4.2, 2.8, 3.7)
    ON CONFLICT (name) DO NOTHING;
    
    INSERT INTO beach_reviews (
        beach_id,
        user_id,
        overall_rating,
        wave_quality_rating,
        crowd_density_rating,
        parking_rating,
        accessibility_rating,
        title,
        content,
        visit_date
    ) VALUES (
        (SELECT id FROM beaches WHERE name = 'Ocean Beach'),
        liquid_snake_id,
        4,
        5,
        4,
        2,
        4,
        'Solid Snake would hate the crowds here',
        'The waves here are as unpredictable as a Metal Gear battle. Powerful and demanding respect. The local population exhibits strong anti-establishment tendencies - I can respect that. Parking is more challenging than escaping from Shadow Moses. Good training for chaos scenarios.',
        CURRENT_DATE - INTERVAL '60 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- Mission Beach Review  
    INSERT INTO beaches (name, latitude, longitude, location_text, description, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating)
    VALUES ('Mission Beach', 32.7738, -117.2528, 'Mission Beach, San Diego, CA', 'Boardwalk beach with amusement rides', 3.6, 4.5, 3.2, 4.3)
    ON CONFLICT (name) DO NOTHING;
    
    INSERT INTO beach_reviews (
        beach_id,
        user_id,
        overall_rating,
        wave_quality_rating,
        crowd_density_rating,
        parking_rating,
        accessibility_rating,
        title,
        content,
        visit_date
    ) VALUES (
        (SELECT id FROM beaches WHERE name = 'Mission Beach'),
        liquid_snake_id,
        3,
        3,
        5,
        3,
        4,
        'Too much like a theme park for my taste',
        'The boardwalk atmosphere feels too much like VR training simulations. Waves are adequate for basic maneuvers but lack the intensity I seek. The rollercoaster noise is distracting during meditation sessions. Better suited for reconnaissance than serious training.',
        CURRENT_DATE - INTERVAL '75 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- La Jolla Shores Review
    INSERT INTO beaches (name, latitude, longitude, location_text, description, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating)
    VALUES ('La Jolla Shores', 32.8507, -117.2726, 'La Jolla, CA', 'Gentle waves perfect for beginners and families', 3.2, 3.8, 4.0, 4.8)
    ON CONFLICT (name) DO NOTHING;
    
    INSERT INTO beach_reviews (
        beach_id,
        user_id,
        overall_rating,
        wave_quality_rating,
        crowd_density_rating,
        parking_rating,
        accessibility_rating,
        title,
        content,
        visit_date
    ) VALUES (
        (SELECT id FROM beaches WHERE name = 'La Jolla Shores'),
        liquid_snake_id,
        2,
        2,
        3,
        4,
        5,
        'Too gentle for advanced tactical training',
        'These waves are softer than Otacons combat skills. Suitable only for basic water entry procedures or recovery sessions. The seals add an interesting dynamic - reminds me of the animal infiltration techniques. Parking is surprisingly manageable. Would only recommend for beginners or rehabilitation.',
        CURRENT_DATE - INTERVAL '90 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- ================================================
    -- Create 10 Surf Sessions at Pacific Beach (before today)
    -- ================================================
    
    -- Get the board ID for Liquid Snake
    FOR i IN 1..10 LOOP
        INSERT INTO sessions (
            user_id,
            beach_id,
            board_id,
            beach_name,
            status,
            arrival_time,
            session_date,
            duration_minutes,
            wave_quality,
            wave_height,
            water_temp,
            crowd_level,
            crowd_rating,
            parking_ease,
            rating,
            goals,
            notes,
            description,
            is_public,
            likes_count,
            comments_count,
            created_at,
            updated_at
        ) VALUES (
            liquid_snake_id,
            pacific_beach_id,
            (SELECT id FROM boards WHERE user_id = liquid_snake_id LIMIT 1),
            'Pacific Beach',
            'completed',
            (CURRENT_DATE - INTERVAL '1 day' * (i * 3 + FLOOR(RANDOM() * 5))) + INTERVAL '1 hour' * (6 + FLOOR(RANDOM() * 4)),
            CURRENT_DATE - INTERVAL '1 day' * (i * 3 + FLOOR(RANDOM() * 5)),
            90 + FLOOR(RANDOM() * 60)::INTEGER, -- 90-150 minutes
            3 + FLOOR(RANDOM() * 3)::INTEGER,  -- 3-5 rating
            CASE 
                WHEN RANDOM() < 0.3 THEN '2-3 ft'
                WHEN RANDOM() < 0.6 THEN '3-4 ft' 
                WHEN RANDOM() < 0.8 THEN '4-5 ft'
                ELSE '5-6 ft'
            END,
            CASE
                WHEN RANDOM() < 0.5 THEN '66°F'
                ELSE '68°F'
            END,
            2 + FLOOR(RANDOM() * 4)::INTEGER,  -- 2-5 crowd level
            2 + FLOOR(RANDOM() * 4)::INTEGER,  -- 2-5 crowd rating
            2 + FLOOR(RANDOM() * 4)::INTEGER,  -- 2-5 parking ease
            3 + FLOOR(RANDOM() * 3)::INTEGER,  -- 3-5 session rating
            ARRAY['improve_technique', 'physical_training', 'mental_focus']::TEXT[],
            CASE i
                WHEN 1 THEN 'First session adapting to civilian surfboard technology. The board responds differently than military watercraft but shows promise for stealth operations.'
                WHEN 2 THEN 'Experimented with advanced maneuvers. The water provides excellent resistance training. Need to work on maintaining balance during combat scenarios.'
                WHEN 3 THEN 'Perfect conditions for psychological operations training. Observed crowd dynamics while maintaining aquatic positioning.'
                WHEN 4 THEN 'Attempted to replicate Metal Gear REX mobility patterns on the wave face. Partially successful.'
                WHEN 5 THEN 'Dawn patrol session. Optimal conditions for avoiding civilian interference. Water temperature acceptable for extended operations.'
                WHEN 6 THEN 'Focused on stealth entries and exits from the lineup. Several surfers seemed unaware of my presence - technique improving.'
                WHEN 7 THEN 'Tested equipment durability under aggressive wave action. Board construction appears adequate for field operations.'
                WHEN 8 THEN 'Practiced tactical communications while in water. Hand signals work well even in challenging conditions.'
                WHEN 9 THEN 'Incorporated meditation techniques learned from Gray Fox. The ocean provides better focus than the VR chambers.'
                ELSE 'Final training session before developing new strategic approaches. Ready to advance to more challenging conditions.'
            END,
            'Another successful aquatic training session at Pacific Beach tactical zone.',
            true,
            FLOOR(RANDOM() * 8)::INTEGER,  -- 0-7 likes
            FLOOR(RANDOM() * 3)::INTEGER,  -- 0-2 comments
            NOW() - INTERVAL '1 day' * (i * 3),
            NOW() - INTERVAL '1 day' * (i * 3)
        );
    END LOOP;

    -- ================================================
    -- Create some user activities
    -- ================================================
    
    -- Activity for session completion
    INSERT INTO user_activities (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        liquid_snake_id,
        'session_completed',
        'session',
        (SELECT id FROM sessions WHERE user_id = liquid_snake_id ORDER BY created_at DESC LIMIT 1),
        jsonb_build_object(
            'beach_name', 'Pacific Beach',
            'duration_minutes', 120,
            'wave_height', '4-5 ft'
        ),
        NOW() - INTERVAL '1 day'
    ) ON CONFLICT DO NOTHING;

    -- Activity for beach review
    INSERT INTO user_activities (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        liquid_snake_id,
        'beach_reviewed',
        'beach_review',
        (SELECT id FROM beach_reviews WHERE user_id = liquid_snake_id ORDER BY created_at DESC LIMIT 1),
        jsonb_build_object(
            'beach_name', 'Pacific Beach',
            'rating', 5,
            'title', 'Perfect training ground for tactical water operations'
        ),
        NOW() - INTERVAL '30 days'
    ) ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Successfully created Liquid Snake user profile with:';
    RAISE NOTICE '- User ID: %', liquid_snake_id;
    RAISE NOTICE '- Profile with bio and contact info';
    RAISE NOTICE '- 1 surfboard (Metal Gear REX - minimal schema)';
    RAISE NOTICE '- 4 beach reviews'; 
    RAISE NOTICE '- 10 surf sessions at Pacific Beach';
    RAISE NOTICE '- 2 user activities';
    RAISE NOTICE 'Ready for tactical surf operations! 🌊🏄‍♂️';

END $$;

-- ================================================
-- Verification Queries
-- ================================================

-- Verify the user was created
SELECT 'USER PROFILE:' as section;
SELECT 
    p.full_name,
    p.email,
    p.location,
    p.experience_level,
    p.bio,
    p.followers_count,
    p.following_count
FROM profiles p 
WHERE p.full_name = 'Liquid Snake';

-- Verify the board was created  
SELECT 'SURFBOARD:' as section;
SELECT 
    b.name,
    b.created_at
FROM boards b
JOIN profiles p ON b.user_id = p.id
WHERE p.full_name = 'Liquid Snake';

-- Verify beach reviews
SELECT 'BEACH REVIEWS:' as section;
SELECT 
    beaches.name as beach_name,
    br.title,
    br.overall_rating,
    br.wave_quality_rating,
    br.visit_date
FROM beach_reviews br
JOIN profiles p ON br.user_id = p.id
JOIN beaches ON br.beach_id = beaches.id
WHERE p.full_name = 'Liquid Snake'
ORDER BY br.created_at DESC;

-- Verify surf sessions
SELECT 'SURF SESSIONS:' as section;
SELECT 
    s.session_date,
    s.wave_height,
    s.duration_minutes,
    s.rating,
    LEFT(s.notes, 50) || '...' as notes_preview
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.full_name = 'Liquid Snake'
ORDER BY s.session_date DESC;

SELECT 'Script completed successfully! Liquid Snake is ready to surf.' as final_status; 