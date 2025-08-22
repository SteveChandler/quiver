-- ================================================
-- Seed Social Data for Existing Users in Production
-- ================================================
-- This migration adds boards, sessions, and social relationships
-- for the existing 8 user profiles in production
-- ================================================

-- Create boards for existing users
INSERT INTO public.boards (user_id, name, board_type, dimensions, description, session_count, created_at)
SELECT 
    p.id,
    CASE 
        WHEN p.full_name = 'Liquid Snake' THEN 'Metal Gear REX Tactical'
        WHEN p.full_name = 'Big Boss' THEN 'The Patriot'
        WHEN p.full_name = 'Solid Snake' THEN 'Codec Stealth Board'
        WHEN p.full_name = 'Dana Williams' THEN 'Dawn Warrior'
        WHEN p.full_name = 'Tina Nakamura' THEN 'Road Trip Board'
        WHEN p.full_name = 'Paul Martinez' THEN 'Shutter Speed'
        WHEN p.full_name = 'Larry Rodriguez' THEN 'OB Daily Driver'
        WHEN p.full_name = 'Riley Chen' THEN 'Learning Curve'
        ELSE 'Daily Driver'
    END,
    CASE 
        WHEN p.full_name IN ('Liquid Snake', 'Big Boss', 'Solid Snake', 'Dana Williams') THEN 'shortboard'
        WHEN p.full_name IN ('Tina Nakamura', 'Paul Martinez') THEN 'fish'
        WHEN p.full_name = 'Larry Rodriguez' THEN 'funboard'
        ELSE 'longboard'
    END,
    CASE 
        WHEN p.full_name IN ('Liquid Snake', 'Big Boss', 'Solid Snake', 'Dana Williams') THEN '6''2" x 18.5" x 2.25"'
        WHEN p.full_name IN ('Tina Nakamura', 'Paul Martinez') THEN '6''0" x 19" x 2.38"'
        WHEN p.full_name = 'Larry Rodriguez' THEN '7''0" x 21.5" x 2.75"'
        ELSE '9''0" x 23" x 3.25"'
    END,
    CASE 
        WHEN p.full_name IN ('Liquid Snake', 'Big Boss', 'Solid Snake', 'Dana Williams') THEN 'High-performance board for critical conditions and advanced maneuvers'
        WHEN p.full_name IN ('Tina Nakamura', 'Paul Martinez') THEN 'Versatile performance board that handles diverse conditions'
        WHEN p.full_name = 'Larry Rodriguez' THEN 'Reliable board that grows with your skills while remaining fun'
        ELSE 'Perfect learning board - stable, forgiving, and confidence-inspiring'
    END,
    FLOOR(RANDOM() * 30 + 10)::INTEGER,
    NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 200)
FROM public.profiles p
WHERE p.full_name IN ('Solid Snake', 'Liquid Snake', 'Big Boss', 'Riley Chen', 'Larry Rodriguez', 'Tina Nakamura', 'Paul Martinez', 'Dana Williams')
ON CONFLICT DO NOTHING;

-- Create follow relationships for existing users
WITH target_users AS (
    SELECT id, full_name FROM public.profiles 
    WHERE full_name IN ('Solid Snake', 'Liquid Snake', 'Big Boss', 'Riley Chen', 'Larry Rodriguez', 'Tina Nakamura', 'Paul Martinez', 'Dana Williams')
)
INSERT INTO public.user_follows (follower_id, following_id, created_at)
SELECT DISTINCT
    follower.id,
    following.id,
    NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 90)
FROM target_users follower
CROSS JOIN target_users following
WHERE follower.id != following.id
    AND (
        -- Beginners follow experienced surfers
        (follower.full_name = 'Riley Chen' AND following.full_name IN ('Liquid Snake', 'Big Boss', 'Dana Williams') AND RANDOM() < 0.9)
        OR
        -- Paul follows everyone for content
        (follower.full_name = 'Paul Martinez' AND RANDOM() < 0.8)
        OR
        -- Tina follows locals for spot intel
        (follower.full_name = 'Tina Nakamura' AND following.full_name = 'Larry Rodriguez')
        OR
        -- Snake operatives follow each other  
        (follower.full_name LIKE '%Snake%' AND following.full_name LIKE '%Snake%' AND RANDOM() < 0.8)
        OR
        -- Big Boss follows his operatives
        (follower.full_name = 'Big Boss' AND following.full_name LIKE '%Snake%')
        OR
        -- Everyone has some chance to follow others
        (RANDOM() < 0.3)
    )
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Create user sessions for existing users
DO $$
DECLARE 
    user_record RECORD;
    beach_id UUID;
    board_id UUID;
    session_count INTEGER;
    i INTEGER;
BEGIN
    -- Create sessions for each existing user
    FOR user_record IN 
        SELECT id, full_name FROM public.profiles 
        WHERE full_name IN ('Solid Snake', 'Liquid Snake', 'Big Boss', 'Riley Chen', 'Larry Rodriguez', 'Tina Nakamura', 'Paul Martinez', 'Dana Williams')
    LOOP
        -- Determine session count based on persona
        session_count := CASE 
            WHEN user_record.full_name IN ('Liquid Snake', 'Big Boss', 'Solid Snake', 'Dana Williams') THEN 12 + FLOOR(RANDOM() * 8)::INTEGER -- 12-20 (experts)
            WHEN user_record.full_name IN ('Tina Nakamura', 'Paul Martinez') THEN 8 + FLOOR(RANDOM() * 6)::INTEGER -- 8-14 (advanced)
            WHEN user_record.full_name = 'Larry Rodriguez' THEN 6 + FLOOR(RANDOM() * 6)::INTEGER -- 6-12 (intermediate)
            ELSE 3 + FLOOR(RANDOM() * 4)::INTEGER -- 3-7 (beginners)
        END;
        
        -- Get a board for this user
        SELECT id INTO board_id FROM public.boards WHERE user_id = user_record.id ORDER BY RANDOM() LIMIT 1;
        
        -- Create sessions
        FOR i IN 1..session_count LOOP
            -- Get a random beach
            SELECT id INTO beach_id FROM public.beaches ORDER BY RANDOM() LIMIT 1;
            
            INSERT INTO public.sessions (
                user_id, profile_id, beach_id, board_id, beach_name, status,
                arrival_time, duration_minutes, wave_quality, water_temp, crowd_level, parking_ease,
                rating, description, notes, created_at
            ) VALUES (
                user_record.id, user_record.id, beach_id, board_id,
                (SELECT name FROM public.beaches WHERE id = beach_id LIMIT 1),
                CASE WHEN RANDOM() < 0.8 THEN 'completed' ELSE 'planned' END,
                
                -- Arrival time based on persona
                CASE 
                    WHEN user_record.full_name = 'Dana Williams' THEN
                        (CURRENT_DATE - INTERVAL '1 day' * FLOOR(RANDOM() * 60)) + INTERVAL '1 hour' * (4 + RANDOM()) -- 4-5 AM
                    WHEN user_record.full_name = 'Riley Chen' THEN
                        (CURRENT_DATE - INTERVAL '1 day' * FLOOR(RANDOM() * 30)) + INTERVAL '1 hour' * (9 + RANDOM() * 4) -- 9 AM - 1 PM
                    ELSE
                        (CURRENT_DATE - INTERVAL '1 day' * FLOOR(RANDOM() * 60)) + INTERVAL '1 hour' * (6 + RANDOM() * 6) -- 6 AM - 12 PM
                END,
                
                -- Duration based on persona
                CASE 
                    WHEN user_record.full_name IN ('Liquid Snake', 'Big Boss', 'Solid Snake', 'Dana Williams') THEN 90 + FLOOR(RANDOM() * 60)::INTEGER -- 1.5-2.5 hours
                    WHEN user_record.full_name IN ('Tina Nakamura', 'Paul Martinez') THEN 75 + FLOOR(RANDOM() * 45)::INTEGER -- 1.25-2 hours
                    WHEN user_record.full_name = 'Larry Rodriguez' THEN 60 + FLOOR(RANDOM() * 45)::INTEGER -- 1-1.75 hours  
                    ELSE 45 + FLOOR(RANDOM() * 30)::INTEGER -- 45-75 minutes for beginners
                END,
                
                2 + FLOOR(RANDOM() * 4)::INTEGER, -- Wave quality 2-5
                CASE WHEN RANDOM() < 0.3 THEN 64 WHEN RANDOM() < 0.7 THEN 66 ELSE 68 END, -- Water temp
                1 + FLOOR(RANDOM() * 5)::INTEGER, -- Crowd level
                2 + FLOOR(RANDOM() * 4)::INTEGER, -- Parking ease
                3 + FLOOR(RANDOM() * 3)::INTEGER, -- Overall rating 3-5
                
                -- Description based on persona
                CASE 
                    WHEN user_record.full_name = 'Liquid Snake' THEN
                        'Elite tactical execution. Perfect wave selection through superior analysis and technique mastery.'
                    WHEN user_record.full_name = 'Big Boss' THEN
                        'Legendary session demonstrating decades of battlefield-tested wave strategy and leadership.'
                    WHEN user_record.full_name = 'Solid Snake' THEN
                        'Stealth infiltration successful. In and out with maximum wave count before crowds noticed.'
                    WHEN user_record.full_name = 'Dana Williams' THEN
                        'Perfect dawn patrol session. The ocean speaks differently at sunrise - pure magic.'
                    WHEN user_record.full_name = 'Paul Martinez' THEN
                        'Epic session between photo shoots. Great waves and captured incredible action shots!'
                    WHEN user_record.full_name = 'Larry Rodriguez' THEN
                        'Solid session at my home break. 15+ years of local knowledge paying off again.'
                    WHEN user_record.full_name = 'Tina Nakamura' THEN
                        'Amazing discovery during coast exploration. This spot delivers exactly what I hoped for!'
                    WHEN user_record.full_name = 'Riley Chen' THEN
                        'Learning session with great progress. Caught ' || (2 + i % 4) || ' waves today! Getting more confident.'
                    ELSE
                        'Amazing session with perfect conditions and great community vibes in the water.'
                END,
                
                'Comprehensive session notes with detailed conditions, crowd observations, and technique insights for the surf community.',
                NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 60) -- created in last 2 months
            );
        END LOOP;
        
        RAISE NOTICE 'Created % sessions for %', session_count, user_record.full_name;
    END LOOP;
END $$;

-- Update social counts
UPDATE public.profiles
SET followers_count = (
    SELECT COUNT(*) FROM public.user_follows WHERE user_follows.following_id = profiles.id
),
following_count = (
    SELECT COUNT(*) FROM public.user_follows WHERE user_follows.follower_id = profiles.id
)
WHERE full_name IN ('Solid Snake', 'Liquid Snake', 'Big Boss', 'Riley Chen', 'Larry Rodriguez', 'Tina Nakamura', 'Paul Martinez', 'Dana Williams');

SELECT 'Comprehensive seeding completed for existing users! 🚀' as result;
