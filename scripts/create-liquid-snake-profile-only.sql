    -- ================================================
    -- Create Liquid Snake Profile and Data ONLY
    -- ================================================
    -- SAFER ALTERNATIVE: This script assumes you've already created 
    -- the auth user via Supabase Auth Dashboard or API
    --
    -- Steps:
    -- 1. Create user in Supabase Auth Dashboard with email: liquid.snake@foxhound.mil
    -- 2. Get the user ID from the auth dashboard
    -- 3. Replace the liquid_snake_id below with the actual UUID
    -- 4. Run this script
    -- ================================================

    DO $$
    DECLARE
        -- REPLACE THIS UUID WITH THE ACTUAL USER ID FROM SUPABASE AUTH DASHBOARD
        liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
        pacific_beach_id UUID;
        i INTEGER;
    BEGIN
        -- ================================================
        -- Verify the auth user exists
        -- ================================================
        
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = liquid_snake_id) THEN
            RAISE EXCEPTION 'Auth user with ID % does not exist. Please create the user first via Supabase Auth Dashboard.', liquid_snake_id;
        END IF;
        
        RAISE NOTICE 'Found auth user with ID: %', liquid_snake_id;

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
            favorite_spot,
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
            'Pacific Beach',
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
            bio = EXCLUDED.bio,
            location = EXCLUDED.location,
            experience_level = EXCLUDED.experience_level,
            favorite_spot = EXCLUDED.favorite_spot,
            instagram = EXCLUDED.instagram,
            phone_number = EXCLUDED.phone_number,
            avatar_url = EXCLUDED.avatar_url,
            followers_count = EXCLUDED.followers_count,
            following_count = EXCLUDED.following_count;

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
                description,
                created_at,
                updated_at
            ) VALUES (
                'Pacific Beach',
                'Popular San Diego beach known for consistent surf, vibrant nightlife, and beach volleyball courts. Great for intermediate to advanced surfers.',
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
        
        IF NOT EXISTS (SELECT 1 FROM boards WHERE user_id = liquid_snake_id AND name = 'Metal Gear REX (Custom Shortboard by Custom Shaper)') THEN
            INSERT INTO boards (
                user_id,
                name,
                board_type,
                dimensions
            ) VALUES (
                liquid_snake_id,
                'Metal Gear REX (Custom Shortboard by Custom Shaper)',
                'Shortboard',
                '6''2" x 19 1/4" x 2 3/8"'
            );
        END IF;

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
        IF NOT EXISTS (SELECT 1 FROM beaches WHERE name = 'Ocean Beach') THEN
            INSERT INTO beaches (name, description)
            VALUES ('Ocean Beach', 'Bohemian beach community with powerful waves');
        END IF;
        
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
        IF NOT EXISTS (SELECT 1 FROM beaches WHERE name = 'Mission Beach') THEN
            INSERT INTO beaches (name, description)
            VALUES ('Mission Beach', 'Boardwalk beach with amusement rides');
        END IF;
        
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
        IF NOT EXISTS (SELECT 1 FROM beaches WHERE name = 'La Jolla Shores') THEN
            INSERT INTO beaches (name, description)
            VALUES ('La Jolla Shores', 'Gentle waves perfect for beginners and families');
        END IF;
        
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
        
        FOR i IN 1..10 LOOP
            INSERT INTO sessions (
                user_id,
                profile_id,
                beach_id,
                board_id,
                beach_name,
                status,
                arrival_time,
                duration_minutes,
                wave_quality,
                water_temp,
                crowd_level,
                parking_ease,
                notes
            ) VALUES (
                liquid_snake_id,
                liquid_snake_id,
                pacific_beach_id,
                (SELECT id FROM boards WHERE user_id = liquid_snake_id LIMIT 1),
                'Pacific Beach',
                'completed',
                (CURRENT_DATE - INTERVAL '1 day' * (i * 3 + FLOOR(RANDOM() * 5))) + INTERVAL '1 hour' * (6 + FLOOR(RANDOM() * 4)),
                90 + FLOOR(RANDOM() * 60)::INTEGER, -- 90-150 minutes
                3 + FLOOR(RANDOM() * 3)::INTEGER,  -- 3-5 rating
                CASE
                    WHEN RANDOM() < 0.5 THEN 66
                    ELSE 68
                END,
                2 + FLOOR(RANDOM() * 4)::INTEGER,  -- 2-5 crowd level
                2 + FLOOR(RANDOM() * 4)::INTEGER,  -- 2-5 parking ease
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
                END
            );
        END LOOP;

        -- ================================================
        -- Create some user activities
        -- ================================================
        
        -- Activity for session completion
        IF NOT EXISTS (
            SELECT 1 FROM user_activities 
            WHERE user_id = liquid_snake_id 
            AND activity_type = 'session_completed'
            AND entity_type = 'session'
            AND entity_id = (SELECT id FROM sessions WHERE user_id = liquid_snake_id ORDER BY created_at DESC LIMIT 1)
        ) THEN
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
            );
        END IF;

        -- Activity for beach review
        IF NOT EXISTS (
            SELECT 1 FROM user_activities 
            WHERE user_id = liquid_snake_id 
            AND activity_type = 'beach_reviewed'
            AND entity_type = 'beach_review'
            AND entity_id = (SELECT id FROM beach_reviews WHERE user_id = liquid_snake_id ORDER BY created_at DESC LIMIT 1)
        ) THEN
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
            );
        END IF;

        RAISE NOTICE 'Successfully created Liquid Snake profile and data:';
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
        s.arrival_time,
        s.duration_minutes,
        s.wave_quality,
        LEFT(s.notes, 50) || '...' as notes_preview
    FROM sessions s
    JOIN profiles p ON s.user_id = p.id
    WHERE p.full_name = 'Liquid Snake'
    ORDER BY s.arrival_time DESC;

    SELECT 'Script completed successfully! Liquid Snake is ready to surf.' as final_status; 