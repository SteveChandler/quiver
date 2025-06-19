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
    blacks_beach_id UUID;
    tourmaline_id UUID;
    ocean_beach_id UUID;
    i INTEGER;
    session_date DATE;
    session_time TIMESTAMP;
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
    -- Ensure beaches exist and get their IDs
    -- ================================================
    
    -- Blacks Beach
    SELECT id INTO blacks_beach_id 
    FROM beaches 
    WHERE LOWER(name) LIKE '%blacks%beach%' 
    LIMIT 1;
    
    IF blacks_beach_id IS NULL THEN
        INSERT INTO beaches (
            name,
            description,
            created_at,
            updated_at
        ) VALUES (
            'Blacks Beach',
            'Legendary surf break in La Jolla known for powerful waves and clothing-optional northern section. Requires hike down steep cliffs.',
            NOW(),
            NOW()
        ) RETURNING id INTO blacks_beach_id;
        
        RAISE NOTICE 'Created Blacks Beach with ID: %', blacks_beach_id;
    ELSE
        RAISE NOTICE 'Found Blacks Beach with ID: %', blacks_beach_id;
    END IF;

    -- Tourmaline Surfing Park
    SELECT id INTO tourmaline_id 
    FROM beaches 
    WHERE LOWER(name) LIKE '%tourmaline%' 
    LIMIT 1;
    
    IF tourmaline_id IS NULL THEN
        INSERT INTO beaches (
            name,
            description,
            created_at,
            updated_at
        ) VALUES (
            'Tourmaline Surfing Park',
            'Pacific Beach surfing spot known for mellow, long rides perfect for longboarding and beginners.',
            NOW(),
            NOW()
        ) RETURNING id INTO tourmaline_id;
        
        RAISE NOTICE 'Created Tourmaline with ID: %', tourmaline_id;
    ELSE
        RAISE NOTICE 'Found Tourmaline with ID: %', tourmaline_id;
    END IF;

    -- Ocean Beach
    SELECT id INTO ocean_beach_id 
    FROM beaches 
    WHERE LOWER(name) LIKE '%ocean%beach%' 
    LIMIT 1;
    
    IF ocean_beach_id IS NULL THEN
        INSERT INTO beaches (
            name,
            description,
            created_at,
            updated_at
        ) VALUES (
            'Ocean Beach',
            'Bohemian beach community with powerful, unpredictable waves and strong local surf culture.',
            NOW(),
            NOW()
        ) RETURNING id INTO ocean_beach_id;
        
        RAISE NOTICE 'Created Ocean Beach with ID: %', ocean_beach_id;
    ELSE
        RAISE NOTICE 'Found Ocean Beach with ID: %', ocean_beach_id;
    END IF;

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
    -- Create Beach Reviews (Great to Bad)
    -- ================================================
    
    -- Blacks Beach Review (Great - Rating 5)
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
        blacks_beach_id,
        big_boss_id,
        5,
        5,
        5,
        2,
        2,
        'The battlefield I''ve been searching for',
        'This break reminds me of the best military operations - demanding, unforgiving, but incredibly rewarding for those who prove themselves worthy. The power of these waves matches the intensity of any conflict I''ve faced. The isolation suits a soldier''s mindset. The hike down is nothing compared to jungle infiltration. This is where legends are made.',
        CURRENT_DATE - INTERVAL '20 days',
        NOW() - INTERVAL '15 days',
        NOW() - INTERVAL '15 days'
    ) ON CONFLICT (beach_id, user_id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content;

    -- Tourmaline Review (Good - Rating 3)
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
        tourmaline_id,
        big_boss_id,
        3,
        3,
        2,
        4,
        5,
        'Good for tactical longboard training',
        'While these waves lack the intensity I prefer, they serve as excellent training grounds for precision and style. The mellower conditions allow for practicing advanced maneuvers without the chaos of battle-like conditions. Suitable for reconnaissance and equipment testing. The easy access makes it ideal for quick strategic sessions.',
        CURRENT_DATE - INTERVAL '35 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- Ocean Beach Review (Bad - Rating 2)
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
        ocean_beach_id,
        big_boss_id,
        2,
        3,
        1,
        1,
        3,
        'Too chaotic, lacks strategic value',
        'This break is like fighting a war on too many fronts. The waves show promise but the localism and aggressive crowd dynamics create unnecessary complications. Parking is a greater challenge than any stealth mission. The unpredictable nature works against tactical planning. Better suited for soldiers who thrive on chaos rather than calculated precision.',
        CURRENT_DATE - INTERVAL '50 days'
    ) ON CONFLICT (beach_id, user_id) DO NOTHING;

    -- ================================================
    -- Create Session Logs for Past 2 Weeks (14 sessions)
    -- ================================================
    
    FOR i IN 1..14 LOOP
        -- Vary the beaches for different sessions
        session_date := CURRENT_DATE - INTERVAL '1 day' * i;
        session_time := session_date + INTERVAL '1 hour' * (5 + FLOOR(RANDOM() * 6)); -- 5-10 AM sessions
        
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
            CASE 
                WHEN i % 3 = 1 THEN blacks_beach_id
                WHEN i % 3 = 2 THEN tourmaline_id
                ELSE ocean_beach_id
            END,
            (SELECT id FROM boards WHERE user_id = big_boss_id ORDER BY RANDOM() LIMIT 1),
            CASE 
                WHEN i % 3 = 1 THEN 'Blacks Beach'
                WHEN i % 3 = 2 THEN 'Tourmaline Surfing Park'
                ELSE 'Ocean Beach'
            END,
            'completed',
            session_time,
            120 + FLOOR(RANDOM() * 90)::INTEGER, -- 120-210 minutes
            3 + FLOOR(RANDOM() * 3)::INTEGER,  -- 3-5 rating
            CASE
                WHEN RANDOM() < 0.3 THEN 64
                WHEN RANDOM() < 0.7 THEN 66
                ELSE 68
            END,
            1 + FLOOR(RANDOM() * 5)::INTEGER,  -- 1-5 crowd level
            1 + FLOOR(RANDOM() * 5)::INTEGER,  -- 1-5 parking ease
            CASE i
                WHEN 1 THEN 'Dawn patrol at the legendary break. Conditions were perfect for advanced tactical maneuvers. No civilians in sight.'
                WHEN 2 THEN 'Longboard session focusing on strategic positioning and wave selection. The mellow conditions allowed for tactical analysis.'
                WHEN 3 THEN 'Challenging session dealing with aggressive locals. Maintained composure despite territorial conflicts.'
                WHEN 4 THEN 'Solo mission in powerful conditions. Each wave was like facing a new enemy - required full tactical awareness.'
                WHEN 5 THEN 'Training session on precision and flow. The longer rides allowed for complete tactical sequences.'
                WHEN 6 THEN 'Crowded conditions forced adaptation of stealth surfing techniques. Successfully avoided most conflicts.'
                WHEN 7 THEN 'Perfect morning session. Conditions reminded me of the best military operations - precise, powerful, demanding excellence.'
                WHEN 8 THEN 'Equipment testing session. New board performed admirably under combat-like wave conditions.'
                WHEN 9 THEN 'Focused on endurance training. Long session building stamina for extended tactical operations.'
                WHEN 10 THEN 'Early morning reconnaissance. Studied wave patterns and local territorial behaviors.'
                WHEN 11 THEN 'High-intensity session in challenging conditions. Proved that experience conquers all obstacles.'
                WHEN 12 THEN 'Tactical longboarding session. Worked on command presence and strategic wave positioning.'
                WHEN 13 THEN 'Difficult session dealing with overcrowding and territorial disputes. Managed to maintain tactical advantage.'
                ELSE 'Final reconnaissance before developing new strategic approaches. Intelligence gathered on all three operational zones.'
            END
        );
    END LOOP;

    -- ================================================
    -- Create Session Plans for Next 4 Days
    -- ================================================
    
    FOR i IN 1..4 LOOP
        session_date := CURRENT_DATE + INTERVAL '1 day' * i;
        session_time := session_date + INTERVAL '1 hour' * (6 + FLOOR(RANDOM() * 3)); -- 6-8 AM sessions
        
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
            CASE 
                WHEN i = 1 THEN blacks_beach_id
                WHEN i = 2 THEN tourmaline_id
                WHEN i = 3 THEN ocean_beach_id
                ELSE blacks_beach_id  -- Return to favorite for day 4
            END,
            (SELECT id FROM boards WHERE user_id = big_boss_id AND name LIKE '%Gun%' LIMIT 1),
            CASE 
                WHEN i = 1 THEN 'Blacks Beach'
                WHEN i = 2 THEN 'Tourmaline Surfing Park'
                WHEN i = 3 THEN 'Ocean Beach'
                ELSE 'Blacks Beach'
            END,
            'planned',
            session_time,
            150, -- Planned 2.5 hour sessions
            NULL, -- Unknown until session happens
            NULL,
            NULL,
            NULL,
            CASE i
                WHEN 1 THEN 'PLANNED: Dawn assault on the legendary break. Tactical objective: Master the overhead conditions forecasted.'
                WHEN 2 THEN 'PLANNED: Strategic longboard training mission. Focus on precision and tactical wave selection.'
                WHEN 3 THEN 'PLANNED: Infiltration mission into hostile territory. Objective: Navigate crowd dynamics while maintaining surf performance.'
                ELSE 'PLANNED: Final tactical assessment at primary operational zone. Consolidate all intelligence gathered this week.'
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
                'title', 'The battlefield I''ve been searching for'
            ),
            NOW() - INTERVAL '15 days'
        );
    END IF;

    RAISE NOTICE 'Successfully created Big Boss profile and data:';
    RAISE NOTICE '- User ID: %', big_boss_id;
    RAISE NOTICE '- Profile with legendary soldier bio';
    RAISE NOTICE '- 2 surfboards (Outer Heaven Gun & Mother Base Longboard)';
    RAISE NOTICE '- 3 beach reviews (Great to Bad ratings)'; 
    RAISE NOTICE '- 14 surf sessions from past 2 weeks';
    RAISE NOTICE '- 4 planned sessions for next 4 days';
    RAISE NOTICE '- 2 user activities';
    RAISE NOTICE 'Big Boss is ready for tactical surf operations! 🌊⚡';

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

SELECT 'Script completed successfully! Big Boss is ready for tactical surf operations.' as final_status; 