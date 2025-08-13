-- Seed comprehensive mock users for community features
-- Creates diverse user personas with profiles and preferences

BEGIN;

-- Clear existing mock users if any exist (keep real auth users)
DELETE FROM public.profiles 
WHERE full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley "Rookie" Rodriguez', 
    'Larry "Local" Thompson', 'Tina "Travel" Chen', 'Paul "PhotoPro" Martinez', 
    'Dana "Dawn Patrol" Wilson'
);

-- Create diverse user personas  
INSERT INTO public.profiles (id, full_name, created_at) VALUES
-- Experienced surfers
(gen_random_uuid(), 'Liquid Snake', NOW() - INTERVAL '2 years'),
(gen_random_uuid(), 'Big Boss', NOW() - INTERVAL '3 years'),
(gen_random_uuid(), 'Solid Snake', NOW() - INTERVAL '1 year 6 months'),

-- Intermediate surfers
(gen_random_uuid(), 'Riley "Rookie" Rodriguez', NOW() - INTERVAL '6 months'),
(gen_random_uuid(), 'Larry "Local" Thompson', NOW() - INTERVAL '2 years 3 months'),
(gen_random_uuid(), 'Tina "Travel" Chen', NOW() - INTERVAL '1 year 2 months'),

-- Content creators and community builders
(gen_random_uuid(), 'Paul "PhotoPro" Martinez', NOW() - INTERVAL '4 years'),
(gen_random_uuid(), 'Dana "Dawn Patrol" Wilson', NOW() - INTERVAL '1 year 8 months'),

-- Regional surfers from different areas
(gen_random_uuid(), 'Jake "NorCal" Anderson', NOW() - INTERVAL '2 years 6 months'),
(gen_random_uuid(), 'Sofia "SoCal" Ramirez', NOW() - INTERVAL '1 year 4 months'),
(gen_random_uuid(), 'Marcus "East Coast" Johnson', NOW() - INTERVAL '3 years 2 months'),
(gen_random_uuid(), 'Kai "Hawaii" Nakamura', NOW() - INTERVAL '5 years'),

-- Specialists and enthusiasts  
(gen_random_uuid(), 'Emma "Weather" Foster', NOW() - INTERVAL '1 year 10 months'),
(gen_random_uuid(), 'Ryan "Tech" Kumar', NOW() - INTERVAL '1 year 7 months'),
(gen_random_uuid(), 'Mia "Safety" Rodriguez', NOW() - INTERVAL '2 years 9 months');

-- Add user preferences and boards for more realistic profiles
WITH user_data AS (
    SELECT id, full_name FROM public.profiles WHERE full_name LIKE '% %'
)
INSERT INTO public.boards (user_id, name, board_type, dimensions, description, session_count, created_at)
SELECT 
    user_data.id,
    CASE 
        WHEN user_data.full_name LIKE '%Rookie%' THEN 'Beginner Longboard'
        WHEN user_data.full_name LIKE '%Local%' THEN 'Daily Driver Shortboard'
        WHEN user_data.full_name LIKE '%Travel%' THEN 'Travel Board'
        WHEN user_data.full_name LIKE '%PhotoPro%' THEN 'Performance Thruster'
        WHEN user_data.full_name LIKE '%Dawn Patrol%' THEN 'Dawn Session Board'
        WHEN user_data.full_name LIKE '%Snake%' THEN 'High Performance'
        WHEN user_data.full_name LIKE '%Boss%' THEN 'Classic Gun'
        ELSE 'All-Around Board'
    END,
    CASE 
        WHEN user_data.full_name LIKE '%Rookie%' THEN 'longboard'
        WHEN user_data.full_name LIKE '%Hawaii%' THEN 'gun'
        WHEN user_data.full_name LIKE '%SoCal%' THEN 'longboard'
        ELSE 'shortboard'
    END,
    CASE 
        WHEN user_data.full_name LIKE '%Rookie%' THEN '9''2" x 23" x 3.25"'
        WHEN user_data.full_name LIKE '%Hawaii%' THEN '7''6" x 19.5" x 2.75"'
        WHEN user_data.full_name LIKE '%SoCal%' THEN '9''6" x 24" x 3.5"'
        ELSE '6''2" x 20.5" x 2.5"'
    END,
    CASE 
        WHEN user_data.full_name LIKE '%Rookie%' THEN 'Perfect for learning - stable and forgiving'
        WHEN user_data.full_name LIKE '%Local%' THEN 'My go-to board for everyday sessions'
        WHEN user_data.full_name LIKE '%Travel%' THEN 'Versatile board that handles different conditions'
        ELSE 'Reliable performance in various conditions'
    END,
    FLOOR(RANDOM() * 50 + 10)::INTEGER,
    NOW() - INTERVAL '1 year' * RANDOM()
FROM user_data
LIMIT 10;

COMMIT;