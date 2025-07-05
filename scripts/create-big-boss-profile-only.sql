-- ================================================
-- Create Big Boss Profile and Data ONLY
-- ================================================
-- SAFER ALTERNATIVE: This script assumes you've already created 
-- the auth user via Supabase Auth Dashboard or API
--
-- Steps:
-- 1. Create user in Supabase Auth Dashboard with email: big.boss@foxhound.mil
-- 2. Get the user ID from the auth dashboard
-- 3. Replace the big_boss_id below with the actual UUID
-- 4. Run this script
-- ================================================

DO $$
DECLARE
    -- REPLACE THIS UUID WITH THE ACTUAL USER ID FROM SUPABASE AUTH DASHBOARD
    big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
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
    
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = big_boss_id) THEN
        RAISE EXCEPTION 'Auth user with ID % does not exist. Please create the user first via Supabase Auth Dashboard.', big_boss_id;
    END IF;
    
    RAISE NOTICE 'Found auth user with ID: %', big_boss_id;

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
        big_boss_id,
        'Big Boss',
        'big.boss@foxhound.mil',
        '+1-555-OUTER-HEAVEN',
        '/placeholder.svg?height=200&width=200',
        'Legendary soldier and founder of FOXHOUND. Seeking perfect waves to match perfect battles. "A soldier''s skills aren''t measured by his politics." The ocean teaches what no battlefield can. 🌊⚡',
        'Outer Heaven → San Diego, CA',
        'expert',
        'Blacks Beach',
        '@big_boss_waves',
        true,
        true,
        89,
        45,
        NOW() - INTERVAL '1 year',
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
                     WHEN 'Blacks Beach' THEN 'Legendary surf break in La Jolla known for powerful waves and clothing-optional northern section. Requires hike down steep cliffs.'
                     WHEN 'Swami''s Beach' THEN 'Sacred surf spot in Encinitas with consistent waves and spiritual energy.'
                     WHEN 'Windansea Beach' THEN 'Iconic La Jolla break with powerful waves and distinctive rock formations.'
                     WHEN 'Ocean Beach' THEN 'Bohemian beach community with powerful, unpredictable waves and strong local surf culture.'
                     WHEN 'Sunset Cliffs' THEN 'Dramatic clifftop surf spot with multiple breaks and stunning sunset views.'
                     ELSE 'Premium San Diego County surf break with excellent wave conditions.'
                 END,
                 NOW(),
                 NOW()
             ) RETURNING id INTO current_beach_id;
            
            RAISE NOTICE 'Created beach: % with ID: %', current_beach_name, current_beach_id;
        END IF;
    END LOOP;

    -- ================================================
    -- Create Custom Surfboards for Big Boss
    -- ================================================
    
    IF NOT EXISTS (SELECT 1 FROM boards WHERE user_id = big_boss_id AND name = 'Outer Heaven (Custom Gun)') THEN
        INSERT INTO boards (
            user_id,
            name,
            board_type,
            dimensions
        ) VALUES (
            big_boss_id,
            'Outer Heaven (Custom Gun)',
            'Gun',
            '7''6" x 22" x 3"'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM boards WHERE user_id = big_boss_id AND name = 'Mother Base (Longboard)') THEN
        INSERT INTO boards (
            user_id,
            name,
            board_type,
            dimensions
        ) VALUES (
            big_boss_id,
            'Mother Base (Longboard)',
            'Longboard',
            '9''2" x 23" x 3 1/4"'
        );
    END IF;

    -- ================================================
    -- Create 5 Strategic Beach Reviews
    -- ================================================
    
    -- 1. Blacks Beach Review (Excellent - Rating 5)
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
        (SELECT id FROM beaches WHERE name = 'Blacks Beach'),
        big_boss_id,
        5,
        5,
        5,
        2,
        2,
        'The ultimate battlefield for elite operatives',
        'This break represents everything I''ve learned about tactical excellence. The power demands absolute precision - one miscalculation and you''re finished. The isolation filters out civilians, leaving only the most dedicated warriors. The cliff descent is nothing compared to rope drops into enemy territory, but it keeps the weak away. Each wave is like facing a new adversary - powerful, unpredictable, demanding your complete tactical awareness. This is where legends prove themselves.',
        CURRENT_DATE - INTERVAL '20 days',
        NOW() - INTERVAL '15 days',
        NOW() - INTERVAL '15 days'
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
        big_boss_id,
        5,
        5,
        4,
        3,
        4,
        'Sacred ground for tactical meditation',
        'The spiritual energy here enhances combat focus like no VR training ever could. Consistent, powerful waves provide perfect conditions for advanced tactical maneuvers. The garden above adds a meditative element - reminds me of the importance of mental discipline in warfare. Local knowledge is essential for optimal positioning. This break teaches patience and precision, qualities every soldier must master.',
        CURRENT_DATE - INTERVAL '35 days'
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
        big_boss_id,
        4,
        5,
        3,
        3,
        3,
        'Iconic battleground with natural fortifications',
        'The rock formations provide natural strategic positions for observing wave patterns and crowd dynamics. Raw power here rivals any military exercise I''ve encountered. Consistent quality makes it reliable for training, though parking requires tactical patience. The shorebreak demands respect - like approaching a heavily fortified position, timing is everything.',
        CURRENT_DATE - INTERVAL '50 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- 4. Tourmaline Surf Park Review (Average - Rating 3)
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
        (SELECT id FROM beaches WHERE name = 'Tourmaline Surf Park'),
        big_boss_id,
        3,
        3,
        2,
        4,
        5,
        'Adequate for tactical longboard training',
        'While these waves lack the intensity I prefer for advanced operations, they serve as excellent training grounds for precision maneuvers and strategic positioning. The mellow conditions allow for practicing complex tactical sequences without the chaos of battle-like conditions. Easy access makes it suitable for equipment testing and reconnaissance missions. Good for soldiers developing foundational skills.',
        CURRENT_DATE - INTERVAL '65 days'
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
        big_boss_id,
        2,
        2,
        3,
        4,
        4,
        'Border territory with limited tactical value',
        'The proximity to international borders creates interesting dynamics, but wave quality is inconsistent for serious tactical training. Water quality concerns remind me of operating in contaminated zones - environmental hazards affect mission effectiveness. Easy parking and access are positive factors, but the inconsistent conditions make it unreliable for advanced operations. Better suited for reconnaissance rather than combat training.',
        CURRENT_DATE - INTERVAL '80 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- ================================================
    -- Create Sessions for All 28 Beaches (Starting Today, Working Backwards)
    -- ================================================
    
    FOR i IN 1..array_length(beach_names, 1) LOOP
        current_beach_name := beach_names[i];
        
        -- Calculate days ago (distribute sessions over ~3 months, with some future plans)
        days_ago := (i - 1) * 3 - 7; -- Start 7 days in future, work backwards
        session_date := CURRENT_DATE + INTERVAL '1 day' * days_ago;
        session_time := session_date + INTERVAL '1 hour' * (5 + FLOOR(RANDOM() * 4)); -- 5-8 AM sessions
        
        -- Get beach ID
        SELECT id INTO current_beach_id FROM beaches WHERE name = current_beach_name;
        
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
            big_boss_id,
            big_boss_id,
            current_beach_id,
            (SELECT id FROM boards WHERE user_id = big_boss_id ORDER BY RANDOM() LIMIT 1),
            current_beach_name,
            CASE 
                WHEN days_ago > 0 THEN 'planned'
                ELSE 'completed'
            END,
            session_time,
            CASE 
                WHEN days_ago > 0 THEN 150 -- Planned sessions
                ELSE 120 + FLOOR(RANDOM() * 90)::INTEGER -- Completed: 120-210 minutes
            END,
            CASE 
                WHEN days_ago > 0 THEN NULL -- Unknown for planned sessions
                ELSE 3 + FLOOR(RANDOM() * 3)::INTEGER -- 3-5 rating for completed
            END,
            CASE
                WHEN days_ago > 0 THEN NULL
                WHEN RANDOM() < 0.3 THEN 64
                WHEN RANDOM() < 0.7 THEN 66
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
                WHEN days_ago > 0 THEN 'PLANNED: Strategic reconnaissance mission at ' || current_beach_name || '. Tactical objective: Assess wave conditions and local territorial dynamics.'
                ELSE 
                    CASE (i % 10)
                        WHEN 1 THEN 'Tactical assessment complete at ' || current_beach_name || '. Wave patterns analyzed, strategic positions identified.'
                        WHEN 2 THEN 'Advanced maneuver training at ' || current_beach_name || '. Each wave like facing a new tactical scenario.'
                        WHEN 3 THEN 'Stealth session at ' || current_beach_name || '. Dawn operations provided optimal conditions with minimal civilian interference.'
                        WHEN 4 THEN 'Combat endurance training at ' || current_beach_name || '. Extended session built stamina for prolonged tactical operations.'
                        WHEN 5 THEN 'Equipment evaluation at ' || current_beach_name || '. Board performance tested under various wave conditions.'
                        WHEN 6 THEN 'Strategic positioning practice at ' || current_beach_name || '. Worked on command presence and wave selection tactics.'
                        WHEN 7 THEN 'Psychological operations training at ' || current_beach_name || '. Studied crowd dynamics while maintaining tactical advantage.'
                        WHEN 8 THEN 'Precision maneuver session at ' || current_beach_name || '. Focused on technical excellence under pressure.'
                        WHEN 9 THEN 'Reconnaissance complete at ' || current_beach_name || '. Intelligence gathered on local conditions and territorial behaviors.'
                        ELSE 'Successful tactical operation at ' || current_beach_name || '. Mission objectives achieved with military precision.'
                    END
            END
        );
    END LOOP;

    -- ================================================
    -- Create some user activities
    -- ================================================
    
    -- Activity for recent session completion
    IF NOT EXISTS (
        SELECT 1 FROM user_activities 
        WHERE user_id = big_boss_id 
        AND activity_type = 'session_completed'
        AND entity_type = 'session'
        AND entity_id = (SELECT id FROM sessions WHERE user_id = big_boss_id AND status = 'completed' ORDER BY created_at DESC LIMIT 1)
    ) THEN
        INSERT INTO user_activities (
            user_id,
            activity_type,
            entity_type,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            big_boss_id,
            'session_completed',
            'session',
            (SELECT id FROM sessions WHERE user_id = big_boss_id AND status = 'completed' ORDER BY created_at DESC LIMIT 1),
            jsonb_build_object(
                'beach_name', 'Blacks Beach',
                'duration_minutes', 180,
                'wave_height', '6-8 ft'
            ),
            NOW() - INTERVAL '1 day'
        );
    END IF;

    -- Activity for beach review
    IF NOT EXISTS (
        SELECT 1 FROM user_activities 
        WHERE user_id = big_boss_id 
        AND activity_type = 'beach_reviewed'
        AND entity_type = 'beach_review'
        AND entity_id = (SELECT id FROM beach_reviews WHERE user_id = big_boss_id ORDER BY created_at DESC LIMIT 1)
    ) THEN
        INSERT INTO user_activities (
            user_id,
            activity_type,
            entity_type,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            big_boss_id,
            'beach_reviewed',
            'beach_review',
            (SELECT id FROM beach_reviews WHERE user_id = big_boss_id ORDER BY created_at DESC LIMIT 1),
            jsonb_build_object(
                'beach_name', 'Blacks Beach',
                'rating', 5,
                'title', 'The ultimate battlefield for elite operatives'
            ),
            NOW() - INTERVAL '15 days'
        );
    END IF;

    RAISE NOTICE 'Successfully created Big Boss profile and comprehensive data:';
    RAISE NOTICE '- User ID: %', big_boss_id;
    RAISE NOTICE '- Profile with legendary soldier bio';
    RAISE NOTICE '- 2 surfboards (Outer Heaven Gun & Mother Base Longboard)';
    RAISE NOTICE '- 5 strategic beach reviews (ratings 2-5)'; 
    RAISE NOTICE '- % surf sessions across all beaches (planned + completed)', array_length(beach_names, 1);
    RAISE NOTICE '- Sessions start from future dates and work backwards';
    RAISE NOTICE '- 2 user activities';
    RAISE NOTICE 'Big Boss is ready for comprehensive tactical surf operations! 🌊⚡';

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
WHERE p.full_name = 'Big Boss';

-- Verify the boards were created  
SELECT 'SURFBOARDS:' as section;
SELECT 
    b.name,
    b.board_type,
    b.dimensions,
    b.created_at
FROM boards b
JOIN profiles p ON b.user_id = p.id
WHERE p.full_name = 'Big Boss';

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
WHERE p.full_name = 'Big Boss'
ORDER BY br.overall_rating DESC;

-- Verify completed surf sessions (past 2 weeks)
SELECT 'COMPLETED SURF SESSIONS (PAST 2 WEEKS):' as section;
SELECT 
    s.arrival_time::date as session_date,
    beaches.name as beach_name,
    s.duration_minutes,
    s.wave_quality,
    LEFT(s.notes, 60) || '...' as notes_preview
FROM sessions s
JOIN profiles p ON s.user_id = p.id
JOIN beaches ON s.beach_id = beaches.id
WHERE p.full_name = 'Big Boss' AND s.status = 'completed'
ORDER BY s.arrival_time DESC;

-- Verify planned sessions (next 4 days)
SELECT 'PLANNED SESSIONS (NEXT 4 DAYS):' as section;
SELECT 
    s.arrival_time::date as session_date,
    s.arrival_time::time as session_time,
    beaches.name as beach_name,
    s.duration_minutes as planned_duration,
    s.notes as plan_notes
FROM sessions s
JOIN profiles p ON s.user_id = p.id
JOIN beaches ON s.beach_id = beaches.id
WHERE p.full_name = 'Big Boss' AND s.status = 'planned'
ORDER BY s.arrival_time ASC;

SELECT 'Script completed successfully! Big Boss is ready for comprehensive tactical surf operations.' as final_status; 