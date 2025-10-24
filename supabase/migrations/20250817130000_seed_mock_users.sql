-- Seed comprehensive mock users for community features
-- Creates diverse user personas with profiles and preferences

BEGIN;

-- Clear existing mock users if any exist (keep real auth users)
-- Remove mock users safely without violating FKs
DELETE FROM public.boards b USING public.profiles p
WHERE b.user_id = p.id AND p.full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley R.',
    'Local Larry', 'Tina C.', 'P. Martinez',
    'Dawn Patrol'
);

DELETE FROM public.beach_review_likes l USING public.beach_reviews r, public.profiles p
WHERE l.review_id = r.id AND r.user_id = p.id AND p.full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley R.',
    'Local Larry', 'Tina C.', 'P. Martinez',
    'Dawn Patrol'
);

DELETE FROM public.beach_reviews r USING public.profiles p
WHERE r.user_id = p.id AND p.full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley R.',
    'Local Larry', 'Tina C.', 'P. Martinez',
    'Dawn Patrol'
);

DELETE FROM public.intel_post_confirmations c USING public.intel_posts ip, public.profiles p
WHERE c.intel_post_id = ip.id AND ip.user_id = p.id AND p.full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley R.',
    'Local Larry', 'Tina C.', 'P. Martinez',
    'Dawn Patrol'
);

DELETE FROM public.intel_posts ip USING public.profiles p
WHERE ip.user_id = p.id AND p.full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley R.',
    'Local Larry', 'Tina C.', 'P. Martinez',
    'Dawn Patrol'
);

DELETE FROM public.profiles
WHERE full_name IN (
    'Liquid Snake', 'Big Boss', 'Solid Snake', 'Riley R.',
    'Local Larry', 'Tina C.', 'P. Martinez',
    'Dawn Patrol'
);

-- Create diverse user personas
INSERT INTO public.profiles (id, full_name, created_at) VALUES
-- Experienced surfers
(gen_random_uuid(), 'Liquid Snake', NOW() - INTERVAL '2 years'),
(gen_random_uuid(), 'Big Boss', NOW() - INTERVAL '3 years'),
(gen_random_uuid(), 'Solid Snake', NOW() - INTERVAL '1 year 6 months'),

-- Intermediate surfers
(gen_random_uuid(), 'Riley R.', NOW() - INTERVAL '6 months'),
(gen_random_uuid(), 'Local Larry', NOW() - INTERVAL '2 years 3 months'),
(gen_random_uuid(), 'Tina C.', NOW() - INTERVAL '1 year 2 months'),

-- Content creators and community builders
(gen_random_uuid(), 'P. Martinez', NOW() - INTERVAL '4 years'),
(gen_random_uuid(), 'Dawn Patrol', NOW() - INTERVAL '1 year 8 months'),

-- Regional surfers from different areas
(gen_random_uuid(), 'NorCal Jake', NOW() - INTERVAL '2 years 6 months'),
(gen_random_uuid(), 'SoCal Sofia', NOW() - INTERVAL '1 year 4 months'),
(gen_random_uuid(), 'M. Johnson', NOW() - INTERVAL '3 years 2 months'),
(gen_random_uuid(), 'Kai N.', NOW() - INTERVAL '5 years'),

-- Specialists and enthusiasts
(gen_random_uuid(), 'Emma F.', NOW() - INTERVAL '1 year 10 months'),
(gen_random_uuid(), 'Ryan K.', NOW() - INTERVAL '1 year 7 months'),
(gen_random_uuid(), 'Mia R.', NOW() - INTERVAL '2 years 9 months');

-- Add user preferences and boards for more realistic profiles
WITH user_data AS (
    SELECT id, full_name FROM public.profiles WHERE full_name LIKE '% %'
)
INSERT INTO public.boards (user_id, name, board_type, dimensions, description, session_count, created_at)
SELECT 
    user_data.id,
    CASE
        WHEN user_data.full_name = 'Riley R.' THEN 'Beginner Longboard'
        WHEN user_data.full_name = 'Local Larry' THEN 'Daily Driver Shortboard'
        WHEN user_data.full_name = 'Tina C.' THEN 'Travel Board'
        WHEN user_data.full_name = 'P. Martinez' THEN 'Performance Thruster'
        WHEN user_data.full_name = 'Dawn Patrol' THEN 'Dawn Session Board'
        WHEN user_data.full_name LIKE '%Snake%' THEN 'High Performance'
        WHEN user_data.full_name LIKE '%Boss%' THEN 'Classic Gun'
        ELSE 'All-Around Board'
    END,
    CASE
        WHEN user_data.full_name = 'Riley R.' THEN 'longboard'
        WHEN user_data.full_name = 'Kai N.' THEN 'gun'
        WHEN user_data.full_name = 'SoCal Sofia' THEN 'longboard'
        ELSE 'shortboard'
    END,
    CASE
        WHEN user_data.full_name = 'Riley R.' THEN '9''2" x 23" x 3.25"'
        WHEN user_data.full_name = 'Kai N.' THEN '7''6" x 19.5" x 2.75"'
        WHEN user_data.full_name = 'SoCal Sofia' THEN '9''6" x 24" x 3.5"'
        ELSE '6''2" x 20.5" x 2.5"'
    END,
    CASE
        WHEN user_data.full_name = 'Riley R.' THEN 'Perfect for learning - stable and forgiving'
        WHEN user_data.full_name = 'Local Larry' THEN 'My go-to board for everyday sessions'
        WHEN user_data.full_name = 'Tina C.' THEN 'Versatile board that handles different conditions'
        ELSE 'Reliable performance in various conditions'
    END,
    FLOOR(RANDOM() * 50 + 10)::INTEGER,
    NOW() - INTERVAL '1 year' * RANDOM()
FROM user_data
LIMIT 10;

COMMIT;