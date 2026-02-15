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
        beach_names TEXT[] := ARRAY[
            'Oceanside Pier', 'Oceanside Harbor Beach', 'Carlsbad State Beach', 'Carlsbad Reef', 'Carlsbad Point',
            'Leucadia State Beach', 'Grandview', 'Stone Steps', 'Encinitas', 'Swami''s Beach',
            'Cardiff Reef', 'Moonlight State Beach', 'Solana Beach', 'Del Mar Beach', 'Torrey Pines State Beach',
            'Blacks Beach', 'Windansea Beach', 'La Jolla Shores', 'Tourmaline Surf Park', 'Crystal Pier',
            'Pacific Beach', 'Mission Beach', 'Ocean Beach', 'Sunset Cliffs', 'Coronado Beach',
            'Imperial Beach', 'Silver Strand'
        ];
        beach_coordinates JSONB := '{
            "Oceanside Pier": {"lat": 33.1959, "lng": -117.3795},
            "Oceanside Harbor Beach": {"lat": 33.188, "lng": -117.38},
            "Carlsbad State Beach": {"lat": 33.1581, "lng": -117.3478},
            "Carlsbad Reef": {"lat": 33.1435, "lng": -117.349},
            "Carlsbad Point": {"lat": 33.1628, "lng": -117.344},
            "Leucadia State Beach": {"lat": 33.0423, "lng": -117.2867},
            "Grandview": {"lat": 33.0373, "lng": -117.2891},
            "Stone Steps": {"lat": 33.0374, "lng": -117.2857},
            "Encinitas": {"lat": 33.0369, "lng": -117.292},
            "Swami''s Beach": {"lat": 33.0362, "lng": -117.3032},
            "Cardiff Reef": {"lat": 33.0265, "lng": -117.2822},
            "Moonlight State Beach": {"lat": 33.0673, "lng": -117.2927},
            "Solana Beach": {"lat": 32.993, "lng": -117.271},
            "Del Mar Beach": {"lat": 32.9573, "lng": -117.2653},
            "Torrey Pines State Beach": {"lat": 32.9212, "lng": -117.2628},
            "Blacks Beach": {"lat": 32.9016, "lng": -117.2524},
            "Windansea Beach": {"lat": 32.8217, "lng": -117.2837},
            "La Jolla Shores": {"lat": 32.8507, "lng": -117.2726},
            "Tourmaline Surf Park": {"lat": 32.8563, "lng": -117.256},
            "Crystal Pier": {"lat": 32.811, "lng": -117.2544},
            "Pacific Beach": {"lat": 32.803, "lng": -117.2405},
            "Mission Beach": {"lat": 32.7801, "lng": -117.2549},
            "Ocean Beach": {"lat": 32.7507, "lng": -117.254},
            "Sunset Cliffs": {"lat": 32.7351, "lng": -117.2519},
            "Coronado Beach": {"lat": 32.6859, "lng": -117.1899},
            "Imperial Beach": {"lat": 32.5743, "lng": -117.1131},
            "Silver Strand": {"lat": 32.6895, "lng": -117.1332}
        }'::JSONB;
        current_beach_name TEXT;
        current_beach_id UUID;
        lat_val FLOAT;
        lng_val FLOAT;
        i INTEGER;
        session_date DATE;
        session_time TIMESTAMP;
        days_ago INTEGER;
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
            bio = EXCLUDED.bio,
            location = EXCLUDED.location,
            experience_level = EXCLUDED.experience_level,
            instagram = EXCLUDED.instagram,
            phone_number = EXCLUDED.phone_number,
            avatar_url = EXCLUDED.avatar_url,
            followers_count = EXCLUDED.followers_count,
            following_count = EXCLUDED.following_count;

        -- ================================================
        -- Ensure all beaches exist and create them if needed
        -- ================================================
        
        FOR i IN 1..array_length(beach_names, 1) LOOP
            current_beach_name := beach_names[i];
            lat_val := (beach_coordinates->current_beach_name->>'lat')::FLOAT;
            lng_val := (beach_coordinates->current_beach_name->>'lng')::FLOAT;
            
            SELECT id INTO current_beach_id 
            FROM beaches 
            WHERE LOWER(name) = LOWER(current_beach_name)
            LIMIT 1;
            
            IF current_beach_id IS NULL THEN
                INSERT INTO beaches (
                    name,
                    latitude,
                    longitude,
                    location,
                    description,
                    created_at,
                    updated_at
                ) VALUES (
                    current_beach_name,
                    lat_val,
                    lng_val,
                                         COALESCE(
                         CASE 
                             WHEN current_beach_name ILIKE '%Oceanside%' THEN 'Oceanside, CA'
                             WHEN current_beach_name ILIKE '%Carlsbad%' THEN 'Carlsbad, CA'
                             WHEN current_beach_name ILIKE '%Leucadia%' OR current_beach_name ILIKE '%Encinitas%' OR current_beach_name = 'Grandview' OR current_beach_name = 'Stone Steps' THEN 'Encinitas, CA'
                             WHEN current_beach_name ILIKE '%Swami%' THEN 'Encinitas, CA'
                             WHEN current_beach_name ILIKE '%Cardiff%' OR current_beach_name ILIKE '%Moonlight%' THEN 'Cardiff/Encinitas, CA'
                             WHEN current_beach_name ILIKE '%Solana%' THEN 'Solana Beach, CA'
                             WHEN current_beach_name ILIKE '%Del Mar%' THEN 'Del Mar, CA'
                             WHEN current_beach_name ILIKE '%Torrey Pines%' OR current_beach_name ILIKE '%Blacks%' THEN 'La Jolla, CA'
                             WHEN current_beach_name ILIKE '%Windansea%' OR current_beach_name ILIKE '%La Jolla%' THEN 'La Jolla, CA'
                             WHEN current_beach_name ILIKE '%Tourmaline%' OR current_beach_name ILIKE '%Crystal%' OR current_beach_name ILIKE '%Pacific Beach%' THEN 'Pacific Beach, CA'
                             WHEN current_beach_name ILIKE '%Mission%' THEN 'Mission Beach, CA'
                             WHEN current_beach_name ILIKE '%Ocean Beach%' OR current_beach_name ILIKE '%Sunset Cliffs%' THEN 'Ocean Beach, CA'
                             WHEN current_beach_name ILIKE '%Coronado%' THEN 'Coronado, CA'
                             WHEN current_beach_name ILIKE '%Imperial%' THEN 'Imperial Beach, CA'
                             WHEN current_beach_name ILIKE '%Silver Strand%' THEN 'Coronado, CA'
                             ELSE 'San Diego County, CA'
                         END,
                         'San Diego County, CA'
                     ),
                    CASE current_beach_name
                        WHEN 'Pacific Beach' THEN 'Popular San Diego beach known for consistent surf, vibrant nightlife, and beach volleyball courts. Great for intermediate to advanced surfers.'
                        WHEN 'Ocean Beach' THEN 'Bohemian beach community with powerful waves and strong local surf culture.'
                        WHEN 'Mission Beach' THEN 'Boardwalk beach with amusement park nearby and family-friendly atmosphere.'
                        WHEN 'La Jolla Shores' THEN 'Gentle waves perfect for beginners and families with protected cove setting.'
                        WHEN 'Swami''s Beach' THEN 'Sacred surf spot in Encinitas with consistent waves and spiritual energy.'
                        ELSE 'Premium San Diego County surf break with excellent wave conditions.'
                    END,
                    NOW(),
                    NOW()
                ) RETURNING id INTO current_beach_id;
                
                RAISE NOTICE 'Created beach: % with ID: %', current_beach_name, current_beach_id;
            END IF;
        END LOOP;

        -- ================================================
        -- Create a Custom Surfboard for Liquid Snake
        -- ================================================
        
        IF NOT EXISTS (SELECT 1 FROM boards WHERE user_id = liquid_snake_id AND name = 'Metal Gear REX (Custom Shortboard)') THEN
            INSERT INTO boards (
                user_id,
                name,
                board_type,
                dimensions
            ) VALUES (
                liquid_snake_id,
                'Metal Gear REX (Custom Shortboard)',
                'Shortboard',
                '6''2" x 19 1/4" x 2 3/8"'
            );
        END IF;

        -- ================================================
        -- Create 5 Tactical Beach Reviews
        -- ================================================
        
        -- 1. Pacific Beach Review (Excellent - Rating 5)
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
            (SELECT id FROM beaches WHERE name = 'Pacific Beach'),
            liquid_snake_id,
            5,
            5,
            3,
            3,
            4,
            'Perfect training ground for aquatic infiltration',
            'This operational zone provides optimal conditions for advanced aquatic maneuvers. The wave consistency enables tactical skill development without unpredictable variables. Civilian population density is manageable with proper timing and stealth techniques. The pier structure offers excellent reconnaissance vantage points. Parking requires tactical patience, reminiscent of infiltration missions. This beach teaches the perfect balance of power and precision that any operative must master.',
            CURRENT_DATE - INTERVAL '25 days',
            NOW() - INTERVAL '20 days',
            NOW() - INTERVAL '20 days'
        ) ON CONFLICT (beach_id, user_id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content;

        -- 2. Swami's Beach Review (Excellent - Rating 5)
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
            (SELECT id FROM beaches WHERE name = 'Swami''s Beach'),
            liquid_snake_id,
            5,
            5,
            4,
            3,
            3,
            'Sacred grounds for tactical meditation',
            'The spiritual energy here enhances stealth capabilities beyond any VR training module. Consistent wave patterns provide ideal conditions for practicing advanced infiltration techniques. The garden above creates natural cover for surveillance operations. Local operatives respect this zone - useful intelligence for territorial mapping. The combination of technical challenge and mental focus makes this essential for any elite water-based mission training.',
            CURRENT_DATE - INTERVAL '40 days'
        ) ON CONFLICT (beach_id, user_id) DO NOTHING;

        -- 3. Windansea Beach Review (Good - Rating 4)
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
            (SELECT id FROM beaches WHERE name = 'Windansea Beach'),
            liquid_snake_id,
            4,
            5,
            3,
            2,
            3,
            'Natural fortifications with tactical advantages',
            'The rock formations provide excellent natural camouflage and strategic positioning opportunities. Wave power here rivals the intensity of any combat scenario I''ve faced. The shorebreak demands precision timing - one miscalculation and mission failure. Parking is more challenging than avoiding Metal Gear sensors, but the isolation created by difficult access filters out casual civilians. Perfect for advanced operatives only.',
            CURRENT_DATE - INTERVAL '55 days'
        ) ON CONFLICT (beach_id, user_id) DO NOTHING;

        -- 4. Del Mar Beach Review (Average - Rating 3)
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
            (SELECT id FROM beaches WHERE name = 'Del Mar Beach'),
            liquid_snake_id,
            3,
            3,
            4,
            4,
            4,
            'Acceptable for reconnaissance but lacks intensity',
            'This location serves adequately for basic aquatic reconnaissance and equipment testing. Wave conditions are predictable but lack the challenge required for advanced tactical training. The affluent civilian population provides interesting social dynamics study opportunities. Easy access and parking make it suitable for quick intelligence gathering missions, but serious operatives will find it insufficient for combat preparation.',
            CURRENT_DATE - INTERVAL '70 days'
        ) ON CONFLICT (beach_id, user_id) DO NOTHING;

        -- 5. Imperial Beach Review (Below Average - Rating 2)
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
            (SELECT id FROM beaches WHERE name = 'Imperial Beach'),
            liquid_snake_id,
            2,
            2,
            3,
            4,
            4,
            'Border zone with limited tactical value',
            'Proximity to international borders creates interesting geopolitical dynamics, but water quality issues compromise mission effectiveness. Like operating in a contaminated zone - environmental hazards affect performance and equipment. Wave quality is too inconsistent for reliable tactical training. Better suited for border surveillance operations than serious aquatic combat preparation. The easy access is the only redeeming tactical feature.',
            CURRENT_DATE - INTERVAL '85 days'
        ) ON CONFLICT (beach_id, user_id) DO NOTHING;

        -- ================================================
        -- Create Sessions for All 28 Beaches (Starting Today, Working Backwards)
        -- ================================================
        
        FOR i IN 1..array_length(beach_names, 1) LOOP
            current_beach_name := beach_names[i];
            
            -- Calculate days ago (distribute sessions over ~3 months, with some future plans)
            days_ago := (i - 1) * 3 - 5; -- Start 5 days in future, work backwards
            session_date := CURRENT_DATE + INTERVAL '1 day' * days_ago;
            session_time := session_date + INTERVAL '1 hour' * (5 + FLOOR(RANDOM() * 3)); -- 5-7 AM stealth sessions
            
            -- Get beach ID
            SELECT id INTO current_beach_id FROM beaches WHERE name = current_beach_name;
            
            INSERT INTO sessions (
                user_id,
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
                current_beach_id,
                (SELECT id FROM boards WHERE user_id = liquid_snake_id LIMIT 1),
                current_beach_name,
                CASE 
                    WHEN days_ago > 0 THEN 'planned'
                    ELSE 'completed'
                END,
                session_time,
                CASE 
                    WHEN days_ago > 0 THEN 135 -- Planned stealth sessions
                    ELSE 90 + FLOOR(RANDOM() * 75)::INTEGER -- Completed: 90-165 minutes
                END,
                CASE 
                    WHEN days_ago > 0 THEN NULL -- Unknown for planned sessions
                    ELSE 3 + FLOOR(RANDOM() * 3)::INTEGER -- 3-5 rating for completed
                END,
                CASE
                    WHEN days_ago > 0 THEN NULL
                    WHEN RANDOM() < 0.4 THEN 64
                    WHEN RANDOM() < 0.8 THEN 66
                    ELSE 68
                END,
                CASE 
                    WHEN days_ago > 0 THEN NULL
                    ELSE 1 + FLOOR(RANDOM() * 5)::INTEGER -- 1-5 crowd level
                END,
                CASE 
                    WHEN days_ago > 0 THEN NULL
                    ELSE 1 + FLOOR(RANDOM() * 5)::INTEGER -- 1-5 parking ease
                END,
                CASE 
                    WHEN days_ago > 0 THEN 'PLANNED: Stealth reconnaissance at ' || current_beach_name || '. Tactical objective: Assess aquatic infiltration routes and civilian patterns.'
                    ELSE 
                        CASE (i % 10)
                            WHEN 1 THEN 'Stealth infiltration complete at ' || current_beach_name || '. Aquatic approach vectors analyzed, optimal timing identified.'
                            WHEN 2 THEN 'Advanced maneuver training at ' || current_beach_name || '. Board responds like Metal Gear REX controls - precise and deadly.'
                            WHEN 3 THEN 'Dawn stealth operation at ' || current_beach_name || '. Zero civilian detection achieved, mission parameters exceeded.'
                            WHEN 4 THEN 'Endurance conditioning at ' || current_beach_name || '. Extended aquatic operations build stamina for prolonged missions.'
                            WHEN 5 THEN 'Equipment field testing at ' || current_beach_name || '. Board performance under various wave conditions catalogued.'
                            WHEN 6 THEN 'Tactical positioning practice at ' || current_beach_name || '. Studied optimal wave selection for stealth entries and exits.'
                            WHEN 7 THEN 'Surveillance training at ' || current_beach_name || '. Observed civilian behavioral patterns while maintaining operational cover.'
                            WHEN 8 THEN 'Technical precision session at ' || current_beach_name || '. Focused on elimination of unnecessary movement - pure efficiency.'
                            WHEN 9 THEN 'Intelligence gathering at ' || current_beach_name || '. Local territorial dynamics mapped, strategic advantages identified.'
                            ELSE 'Mission accomplished at ' || current_beach_name || '. All tactical objectives met with signature Liquid Snake precision.'
                        END
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
            AND entity_id = (SELECT id FROM sessions WHERE user_id = liquid_snake_id AND status = 'completed' ORDER BY created_at DESC LIMIT 1)
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
                (SELECT id FROM sessions WHERE user_id = liquid_snake_id AND status = 'completed' ORDER BY created_at DESC LIMIT 1),
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
                    'title', 'Perfect training ground for aquatic infiltration'
                ),
                NOW() - INTERVAL '20 days'
            );
        END IF;

        RAISE NOTICE 'Successfully created Liquid Snake profile and comprehensive tactical data:';
        RAISE NOTICE '- User ID: %', liquid_snake_id;
        RAISE NOTICE '- Profile with stealth operative bio';
        RAISE NOTICE '- 1 surfboard (Metal Gear REX Custom Shortboard)';
        RAISE NOTICE '- 5 tactical beach reviews (ratings 2-5)'; 
        RAISE NOTICE '- % surf sessions across all beaches (planned + completed)', array_length(beach_names, 1);
        RAISE NOTICE '- Sessions start from future dates and work backwards';
        RAISE NOTICE '- 2 user activities';
        RAISE NOTICE 'Liquid Snake is ready for comprehensive aquatic operations! 🌊��‍♂️';

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
        b.board_type,
        b.dimensions,
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
    ORDER BY br.overall_rating DESC;

    -- Verify completed surf sessions (past sessions)
    SELECT 'COMPLETED SURF SESSIONS:' as section;
    SELECT 
        s.arrival_time::date as session_date,
        beaches.name as beach_name,
        s.duration_minutes,
        s.wave_quality,
        LEFT(s.notes, 60) || '...' as notes_preview
    FROM sessions s
    JOIN profiles p ON s.user_id = p.id
    JOIN beaches ON s.beach_id = beaches.id
    WHERE p.full_name = 'Liquid Snake' AND s.status = 'completed'
    ORDER BY s.arrival_time DESC
    LIMIT 10;

    -- Verify planned sessions (future sessions)
    SELECT 'PLANNED SESSIONS:' as section;
    SELECT 
        s.arrival_time::date as session_date,
        s.arrival_time::time as session_time,
        beaches.name as beach_name,
        s.duration_minutes as planned_duration,
        s.notes as plan_notes
    FROM sessions s
    JOIN profiles p ON s.user_id = p.id
    JOIN beaches ON s.beach_id = beaches.id
    WHERE p.full_name = 'Liquid Snake' AND s.status = 'planned'
    ORDER BY s.arrival_time ASC;

    -- Summary statistics
    SELECT 'SESSION SUMMARY:' as section;
    SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned_sessions,
        COUNT(DISTINCT beach_id) as beaches_visited
    FROM sessions s
    JOIN profiles p ON s.user_id = p.id
    WHERE p.full_name = 'Liquid Snake';

    SELECT 'Script completed successfully! Liquid Snake is ready for comprehensive aquatic operations.' as final_status; 