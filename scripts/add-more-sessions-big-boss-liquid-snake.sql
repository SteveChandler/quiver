-- ================================================
-- Add More Sessions for Big Boss and Liquid Snake
-- ================================================
-- This script adds additional sessions for existing users:
-- - 5 planned sessions in 3 days (both users)
-- - 8 completed sessions in the last few days (both users)
-- - Focuses on 5 selected premium beaches
-- ================================================

DO $$
DECLARE
    -- User IDs (replace with actual UUIDs from your database)
    big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
    liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
    
    -- Selected 5 premium beaches for additional sessions
    selected_beaches TEXT[] := ARRAY[
        'Blacks Beach',      -- Big Boss favorite
        'Pacific Beach',     -- Liquid Snake favorite  
        'Swami''s Beach',    -- Both love this spot
        'Windansea Beach',   -- Classic La Jolla break
        'Sunset Cliffs'      -- Dramatic sunset sessions
    ];
    
    current_beach_name TEXT;
    current_beach_id UUID;
    current_user_id UUID;
    user_name TEXT;
    session_date DATE;
    session_time TIMESTAMP;
    i INTEGER;
    j INTEGER;
    days_offset INTEGER;
    board_id UUID;
    
BEGIN
    -- ================================================
    -- Verify both users exist
    -- ================================================
    
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = big_boss_id) THEN
        RAISE EXCEPTION 'Big Boss profile with ID % does not exist. Please create the profile first.', big_boss_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = liquid_snake_id) THEN
        RAISE EXCEPTION 'Liquid Snake profile with ID % does not exist. Please create the profile first.', liquid_snake_id;
    END IF;
    
    RAISE NOTICE 'Found both user profiles. Adding additional sessions...';

    -- ================================================
    -- Add 5 Planned Sessions (3 days in the future) for both users
    -- ================================================
    
    FOR i IN 1..2 LOOP -- Loop for both users
        current_user_id := CASE WHEN i = 1 THEN big_boss_id ELSE liquid_snake_id END;
        user_name := CASE WHEN i = 1 THEN 'Big Boss' ELSE 'Liquid Snake' END;
        
        -- Get a random board for this user
        SELECT id INTO board_id FROM boards WHERE user_id = current_user_id ORDER BY RANDOM() LIMIT 1;
        
        FOR j IN 1..5 LOOP -- 5 planned sessions per user
            current_beach_name := selected_beaches[((j-1) % 5) + 1]; -- Cycle through the 5 beaches
            
            -- Get beach ID
            SELECT id INTO current_beach_id FROM beaches WHERE name = current_beach_name;
            
                         -- Sessions planned for 3 days from now, spread throughout the day
             session_date := CURRENT_DATE + INTERVAL '3 days';
             session_time := session_date + INTERVAL '1 hour' * (5 + (j * 2)); -- 5AM, 7AM, 9AM, 11AM, 1PM
             
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
                 current_user_id,
                 current_user_id,
                current_beach_id,
                board_id,
                current_beach_name,
                'planned',
                session_time,
                CASE 
                    WHEN user_name = 'Big Boss' THEN 150 + (j * 10) -- 150-190 minutes
                    ELSE 120 + (j * 15) -- 120-180 minutes
                END,
                NULL, -- Unknown for planned sessions
                NULL, -- Unknown for planned sessions
                NULL, -- Unknown for planned sessions
                NULL, -- Unknown for planned sessions
                CASE 
                    WHEN user_name = 'Big Boss' THEN 
                        CASE j
                            WHEN 1 THEN 'PLANNED: Strategic dawn assault on ' || current_beach_name || '. Tactical objective: Establish dominance through superior positioning and wave selection.'
                            WHEN 2 THEN 'PLANNED: Mid-morning reconnaissance at ' || current_beach_name || '. Mission: Assess changing tide conditions and civilian movement patterns.'
                            WHEN 3 THEN 'PLANNED: Advanced tactical maneuvers at ' || current_beach_name || '. Focus: Precision strikes and sustained combat endurance.'
                            WHEN 4 THEN 'PLANNED: Midday power session at ' || current_beach_name || '. Objective: Test equipment limits under peak conditions.'
                            WHEN 5 THEN 'PLANNED: Afternoon strategic withdrawal at ' || current_beach_name || '. Final assessment of daily tactical gains.'
                        END
                    ELSE -- Liquid Snake
                        CASE j
                            WHEN 1 THEN 'PLANNED: Stealth infiltration at ' || current_beach_name || '. Primary objective: Perfect timing analysis for optimal wave engagement.'
                            WHEN 2 THEN 'PLANNED: Advanced reconnaissance at ' || current_beach_name || '. Mission parameters: Crowd pattern analysis and territorial mapping.'
                            WHEN 3 THEN 'PLANNED: Tactical precision training at ' || current_beach_name || '. Focus: Elimination of wasted movement through perfect technique.'
                            WHEN 4 THEN 'PLANNED: Equipment stress testing at ' || current_beach_name || '. Objective: Push board performance to operational limits.'
                            WHEN 5 THEN 'PLANNED: Final stealth assessment at ' || current_beach_name || '. Complete tactical evaluation before next operational phase.'
                        END
                END
            );
        END LOOP;
        
        RAISE NOTICE 'Added 5 planned sessions for %', user_name;
    END LOOP;

    -- ================================================
    -- Add 8 Completed Sessions (last few days) for both users
    -- ================================================
    
    FOR i IN 1..2 LOOP -- Loop for both users
        current_user_id := CASE WHEN i = 1 THEN big_boss_id ELSE liquid_snake_id END;
        user_name := CASE WHEN i = 1 THEN 'Big Boss' ELSE 'Liquid Snake' END;
        
        -- Get a random board for this user
        SELECT id INTO board_id FROM boards WHERE user_id = current_user_id ORDER BY RANDOM() LIMIT 1;
        
        FOR j IN 1..8 LOOP -- 8 completed sessions per user
            current_beach_name := selected_beaches[((j-1) % 5) + 1]; -- Cycle through the 5 beaches
            
            -- Get beach ID
            SELECT id INTO current_beach_id FROM beaches WHERE name = current_beach_name;
            
            -- Sessions in the last 5 days, distributed
            days_offset := -(((j-1) % 5) + 1); -- -1, -2, -3, -4, -5 days
            session_date := CURRENT_DATE + INTERVAL '1 day' * days_offset;
            session_time := session_date + INTERVAL '1 hour' * (5 + FLOOR(RANDOM() * 4)); -- 5-8 AM
            
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
                 current_user_id,
                 current_user_id,
                 current_beach_id,
                 board_id,
                 current_beach_name,
                 'completed',
                session_time,
                CASE 
                    WHEN user_name = 'Big Boss' THEN 120 + FLOOR(RANDOM() * 90)::INTEGER -- 120-210 minutes
                    ELSE 90 + FLOOR(RANDOM() * 75)::INTEGER -- 90-165 minutes
                END,
                3 + FLOOR(RANDOM() * 3)::INTEGER, -- 3-5 wave quality rating
                CASE
                    WHEN RANDOM() < 0.3 THEN 64
                    WHEN RANDOM() < 0.7 THEN 66
                    ELSE 68
                END, -- Water temperature
                1 + FLOOR(RANDOM() * 5)::INTEGER, -- 1-5 crowd level
                1 + FLOOR(RANDOM() * 5)::INTEGER, -- 1-5 parking ease
                CASE 
                    WHEN user_name = 'Big Boss' THEN 
                        CASE (j % 8)
                            WHEN 1 THEN 'Tactical excellence achieved at ' || current_beach_name || '. Perfect wave selection and combat positioning demonstrated superior battlefield awareness.'
                            WHEN 2 THEN 'Strategic dominance at ' || current_beach_name || '. Every wave conquered with military precision. The ocean knows who commands here.'
                            WHEN 3 THEN 'Legendary session at ' || current_beach_name || '. Established absolute territorial control through superior tactics and unwavering determination.'
                            WHEN 4 THEN 'Combat training complete at ' || current_beach_name || '. Extended engagement built both physical and mental fortitude for future operations.'
                            WHEN 5 THEN 'Flawless execution at ' || current_beach_name || '. Each maneuver calculated, each wave conquered. This is what separates legends from soldiers.'
                            WHEN 6 THEN 'Operational success at ' || current_beach_name || '. Dawn assault achieved all tactical objectives with zero compromises.'
                            WHEN 7 THEN 'Elite performance at ' || current_beach_name || '. Demonstrated why experience and tactical knowledge triumph over raw power.'
                            WHEN 0 THEN 'Mission accomplished at ' || current_beach_name || '. The ocean tested my resolve and found it unbreakable. Victory through superior strategy.'
                        END
                    ELSE -- Liquid Snake
                        CASE (j % 8)
                            WHEN 1 THEN 'Stealth operation successful at ' || current_beach_name || '. Perfect infiltration timing achieved maximum wave engagement with zero detection.'
                            WHEN 2 THEN 'Advanced reconnaissance at ' || current_beach_name || '. Every wave analyzed, every movement calculated. Precision over power.'
                            WHEN 3 THEN 'Tactical superiority at ' || current_beach_name || '. Board responds like my Metal Gear REX - absolute control through perfect technique.'
                            WHEN 4 THEN 'Flawless execution at ' || current_beach_name || '. Each session refines the perfect balance of stealth and power that defines my style.'
                            WHEN 5 THEN 'Operational excellence at ' || current_beach_name || '. Dawn patrol achieved all objectives. The ocean is just another battlefield to master.'
                            WHEN 6 THEN 'Strategic dominance at ' || current_beach_name || '. Every wave conquered through superior positioning and timing. This is true power.'
                            WHEN 7 THEN 'Perfect session at ' || current_beach_name || '. Like my arm, each movement flows with deadly precision. The ocean knows its master.'
                            WHEN 0 THEN 'Mission success at ' || current_beach_name || '. Another tactical victory. The perfect combination of stealth and overwhelming force.'
                        END
                END
            );
        END LOOP;
        
        RAISE NOTICE 'Added 8 completed sessions for %', user_name;
    END LOOP;

    -- ================================================
    -- Add User Activities for Recent Sessions
    -- ================================================
    
    -- Big Boss recent session activity
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
        (SELECT id FROM sessions WHERE user_id = big_boss_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1),
        jsonb_build_object(
            'beach_name', (SELECT beach_name FROM sessions WHERE user_id = big_boss_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1),
            'duration_minutes', (SELECT duration_minutes FROM sessions WHERE user_id = big_boss_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1),
            'wave_quality', (SELECT wave_quality FROM sessions WHERE user_id = big_boss_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1)
        ),
        NOW() - INTERVAL '4 hours'
    );

    -- Liquid Snake recent session activity
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
        (SELECT id FROM sessions WHERE user_id = liquid_snake_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1),
        jsonb_build_object(
            'beach_name', (SELECT beach_name FROM sessions WHERE user_id = liquid_snake_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1),
            'duration_minutes', (SELECT duration_minutes FROM sessions WHERE user_id = liquid_snake_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1),
            'wave_quality', (SELECT wave_quality FROM sessions WHERE user_id = liquid_snake_id AND status = 'completed' ORDER BY arrival_time DESC LIMIT 1)
        ),
        NOW() - INTERVAL '6 hours'
    );

    RAISE NOTICE 'Successfully added additional sessions for both operatives:';
    RAISE NOTICE '- Big Boss: 5 planned sessions + 8 completed sessions';
    RAISE NOTICE '- Liquid Snake: 5 planned sessions + 8 completed sessions';
    RAISE NOTICE '- Total additional sessions: 26 sessions';
    RAISE NOTICE '- Beaches utilized: %, %, %, %, %', selected_beaches[1], selected_beaches[2], selected_beaches[3], selected_beaches[4], selected_beaches[5];
    RAISE NOTICE '- Planned sessions scheduled for: %', (CURRENT_DATE + INTERVAL '3 days')::TEXT;
    RAISE NOTICE '- Completed sessions from last 5 days';
    RAISE NOTICE '- 2 new user activities added';
    RAISE NOTICE 'Both operatives are now fully equipped for comprehensive tactical surf operations! 🌊⚡🏄‍♂️';

END $$;

-- ================================================
-- Verification Queries
-- ================================================

-- Verify planned sessions (next 3 days)
SELECT 'PLANNED SESSIONS (NEXT 3 DAYS):' as section;
SELECT 
    p.full_name,
    s.arrival_time::date as session_date,
    s.arrival_time::time as session_time,
    s.beach_name,
    s.duration_minutes as planned_duration,
    LEFT(s.notes, 80) || '...' as plan_notes
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.full_name IN ('Big Boss', 'Liquid Snake') 
    AND s.status = 'planned'
    AND s.arrival_time > NOW()
ORDER BY s.arrival_time ASC;

-- Verify completed sessions (last 5 days)
SELECT 'COMPLETED SESSIONS (LAST 5 DAYS):' as section;
SELECT 
    p.full_name,
    s.arrival_time::date as session_date,
    s.beach_name,
    s.duration_minutes,
    s.wave_quality,
    LEFT(s.notes, 80) || '...' as notes_preview
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.full_name IN ('Big Boss', 'Liquid Snake') 
    AND s.status = 'completed'
    AND s.arrival_time >= (CURRENT_DATE - INTERVAL '5 days')
ORDER BY s.arrival_time DESC;

-- Session count summary
SELECT 'SESSION COUNT SUMMARY:' as section;
SELECT 
    p.full_name,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN s.status = 'planned' THEN 1 END) as planned_sessions,
    COUNT(CASE WHEN s.arrival_time >= (CURRENT_DATE - INTERVAL '5 days') AND s.status = 'completed' THEN 1 END) as recent_completed,
    COUNT(CASE WHEN s.arrival_time > NOW() AND s.status = 'planned' THEN 1 END) as upcoming_planned
FROM sessions s
JOIN profiles p ON s.user_id = p.id
WHERE p.full_name IN ('Big Boss', 'Liquid Snake')
GROUP BY p.full_name
ORDER BY p.full_name;

SELECT 'Additional sessions successfully added! Both operatives ready for action! ��⚡' as final_status; 