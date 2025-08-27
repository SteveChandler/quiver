-- SAFE: Add comprehensive mock user data for development and testing
-- Creates diverse user profiles with realistic data across different surf experience levels
-- and geographic regions to support community features and social interactions
-- 
-- IMPORTANT: This migration ONLY ADDS new mock users - it does NOT delete any existing users

BEGIN;

-- Create comprehensive diverse user personas with realistic profile data
-- Uses only the columns that actually exist in the profiles table
-- SAFE: Only inserts new users, does not delete any existing data
INSERT INTO public.profiles (
    id, 
    full_name, 
    favorite_spot,
    email_session_invites,
    inapp_session_invites,
    digest_session_invites,
    followers_count,
    following_count,
    created_at
) 
SELECT * FROM (VALUES
-- Beginner Surfers (1-2 years experience)
(
    gen_random_uuid(), 
    'Alex "Goofy" Thompson', 
    'The Breakwater',
    true, true, false,
    45, 32,
    NOW() - INTERVAL '8 months'
),
(
    gen_random_uuid(), 
    'Zoe "Beginner" Davis', 
    'Swamis',
    false, true, false,
    28, 19,
    NOW() - INTERVAL '1 year 2 months'
),
(
    gen_random_uuid(), 
    'Tyler "Kook" Anderson', 
    'El Segundo',
    true, true, true,
    67, 43,
    NOW() - INTERVAL '6 months'
),

-- Intermediate Surfers (2-5 years experience)
(
    gen_random_uuid(), 
    'Maria "Barrel" Santos', 
    'The Pier',
    true, true, false,
    156, 89,
    NOW() - INTERVAL '3 years 4 months'
),
(
    gen_random_uuid(), 
    'Chris "Shortboard" Rodriguez', 
    'Trestles',
    false, true, false,
    203, 145,
    NOW() - INTERVAL '4 years 1 month'
),
(
    gen_random_uuid(), 
    'Sarah "Longboard" Mitchell', 
    'Malibu Surfrider',
    true, true, true,
    324, 198,
    NOW() - INTERVAL '5 years 3 months'
),
(
    gen_random_uuid(), 
    'Josh "Early Bird" Kim', 
    'Mondos',
    true, true, true,
    112, 87,
    NOW() - INTERVAL '3 years 2 months'
),

-- Advanced Surfers (5-10 years experience)
(
    gen_random_uuid(), 
    'Jessica "Pro" Chen', 
    'Mavericks',
    false, false, false,
    1247, 234,
    NOW() - INTERVAL '8 years 6 months'
),
(
    gen_random_uuid(), 
    'Luna "Sunrise" Martinez', 
    'Steamer Lane',
    false, true, true,
    423, 189,
    NOW() - INTERVAL '7 years 8 months'
),
(
    gen_random_uuid(), 
    'Phoenix "Competition" Reed', 
    'Seaside Reef',
    false, false, false,
    2134, 456,
    NOW() - INTERVAL '9 years 1 month'
),

-- Expert/Professional (10+ years experience)
(
    gen_random_uuid(), 
    'Mike "Veteran" Johnson', 
    'The Pier',
    false, false, true,
    567, 234,
    NOW() - INTERVAL '15 years 3 months'
),
(
    gen_random_uuid(), 
    'Storm "Big Wave" Cole', 
    'Ocean Beach',
    false, false, false,
    1876, 678,
    NOW() - INTERVAL '12 years 4 months'
),

-- Specialized Roles and Enthusiasts
(
    gen_random_uuid(), 
    'Sam "Instructor" Brown', 
    'Scripps Pier',
    true, true, true,
    892, 345,
    NOW() - INTERVAL '10 years 2 months'
),
(
    gen_random_uuid(), 
    'Maya "Photographer" Patel', 
    'The Hook',
    false, true, true,
    2341, 567,
    NOW() - INTERVAL '6 years 7 months'
),
(
    gen_random_uuid(), 
    'Noah "Forecaster" Garcia', 
    'Manresa State Beach',
    true, false, true,
    734, 234,
    NOW() - INTERVAL '11 years 5 months'
),
(
    gen_random_uuid(), 
    'Emma "SUP" Foster', 
    'Cayucos Pier',
    true, true, false,
    445, 189,
    NOW() - INTERVAL '4 years 8 months'
),
(
    gen_random_uuid(), 
    'Aria "Shaper" Lewis', 
    'Beacons',
    false, false, true,
    1123, 456,
    NOW() - INTERVAL '13 years 2 months'
),
(
    gen_random_uuid(), 
    'River "Free" Walker', 
    'Rincon',
    false, true, false,
    234, 123,
    NOW() - INTERVAL '6 years 1 month'
),
(
    gen_random_uuid(), 
    'Sage "Eco" Green', 
    'The Pier',
    true, true, true,
    1567, 789,
    NOW() - INTERVAL '9 years 6 months'
),
(
    gen_random_uuid(), 
    'Kai "Pipeline" Wilson', 
    'Windansea',
    false, false, false,
    3456, 1234,
    NOW() - INTERVAL '14 years 3 months'
)
) AS new_users(id, full_name, favorite_spot, email_session_invites, inapp_session_invites, digest_session_invites, followers_count, following_count, created_at)
-- SAFE: Only insert if user doesn't already exist
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.full_name = new_users.full_name
);

-- Add realistic boards for the new mock users (only for users that were actually inserted)
WITH user_data AS (
    SELECT 
        id, 
        full_name,
        CASE 
            WHEN full_name LIKE '%Goofy%' OR full_name LIKE '%Beginner%' OR full_name LIKE '%Kook%' THEN 'beginner'
            WHEN full_name LIKE '%Barrel%' OR full_name LIKE '%Shortboard%' OR full_name LIKE '%Longboard%' 
                OR full_name LIKE '%Early Bird%' OR full_name LIKE '%SUP%' OR full_name LIKE '%Photographer%' 
                OR full_name LIKE '%Free%' THEN 'intermediate'
            WHEN full_name LIKE '%Pro%' OR full_name LIKE '%Sunrise%' OR full_name LIKE '%Competition%' 
                OR full_name LIKE '%Forecaster%' OR full_name LIKE '%Eco%' THEN 'advanced'
            WHEN full_name LIKE '%Veteran%' OR full_name LIKE '%Big Wave%' OR full_name LIKE '%Instructor%' 
                OR full_name LIKE '%Shaper%' OR full_name LIKE '%Pipeline%' THEN 'expert'
            ELSE 'intermediate'
        END as experience_level
    FROM public.profiles 
    WHERE full_name IN (
        'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
        'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
        'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
        'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
        'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
        'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
        'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
    )
)
INSERT INTO public.boards (user_id, name, board_type, dimensions, description, session_count, created_at)
SELECT 
    user_data.id,
    CASE 
        -- Beginner boards
        WHEN user_data.full_name LIKE '%Goofy%' THEN 'Foam Longboard'
        WHEN user_data.full_name LIKE '%Beginner%' THEN 'Stable Longboard'
        WHEN user_data.full_name LIKE '%Kook%' THEN 'Learning Board'
        
        -- Intermediate boards
        WHEN user_data.full_name LIKE '%Barrel%' THEN 'Reef Rider'
        WHEN user_data.full_name LIKE '%Shortboard%' THEN 'Performance Thruster'
        WHEN user_data.full_name LIKE '%Longboard%' THEN 'Classic Noserider'
        WHEN user_data.full_name LIKE '%Early Bird%' THEN 'Dawn Patrol Board'
        
        -- Advanced boards
        WHEN user_data.full_name LIKE '%Pro%' THEN 'Competition Board'
        WHEN user_data.full_name LIKE '%Sunrise%' THEN 'Big Wave Gun'
        WHEN user_data.full_name LIKE '%Competition%' THEN 'High Performance'
        
        -- Expert boards
        WHEN user_data.full_name LIKE '%Veteran%' THEN 'Vintage Classic'
        WHEN user_data.full_name LIKE '%Big Wave%' THEN 'Heavy Water Gun'
        
        -- Specialized boards
        WHEN user_data.full_name LIKE '%Instructor%' THEN 'Teaching Board'
        WHEN user_data.full_name LIKE '%Photographer%' THEN 'All-Around Board'
        WHEN user_data.full_name LIKE '%Forecaster%' THEN 'Conditions Tester'
        WHEN user_data.full_name LIKE '%SUP%' THEN 'SUP Surfboard'
        WHEN user_data.full_name LIKE '%Shaper%' THEN 'Custom Creation'
        WHEN user_data.full_name LIKE '%Free%' THEN 'Freedom Rider'
        WHEN user_data.full_name LIKE '%Eco%' THEN 'Sustainable Board'
        WHEN user_data.full_name LIKE '%Pipeline%' THEN 'Aloha Thruster'
        
        ELSE 'All-Around Board'
    END,
    CASE 
        WHEN user_data.experience_level = 'beginner' THEN 'longboard'
        WHEN user_data.experience_level = 'intermediate' AND user_data.full_name LIKE '%Longboard%' THEN 'longboard'
        WHEN user_data.experience_level = 'intermediate' AND user_data.full_name LIKE '%SUP%' THEN 'sup'
        WHEN user_data.experience_level IN ('advanced', 'expert') AND user_data.full_name LIKE '%Big Wave%' THEN 'gun'
        WHEN user_data.experience_level IN ('advanced', 'expert') AND user_data.full_name LIKE '%Sunrise%' THEN 'gun'
        WHEN user_data.experience_level = 'expert' AND user_data.full_name LIKE '%Veteran%' THEN 'longboard'
        ELSE 'shortboard'
    END,
    CASE 
        -- Beginner dimensions (longer, wider, thicker)
        WHEN user_data.experience_level = 'beginner' THEN 
            CASE 
                WHEN user_data.full_name LIKE '%Goofy%' THEN '9''0" x 22.5" x 3.25"'
                WHEN user_data.full_name LIKE '%Beginner%' THEN '9''2" x 23" x 3.5"'
                ELSE '8''6" x 22" x 3.0"'
            END
        
        -- Intermediate dimensions
        WHEN user_data.experience_level = 'intermediate' THEN
            CASE 
                WHEN user_data.full_name LIKE '%Longboard%' THEN '9''6" x 23.5" x 3.25"'
                WHEN user_data.full_name LIKE '%SUP%' THEN '10''0" x 32" x 4.5"'
                ELSE '6''4" x 20" x 2.625"'
            END
            
        -- Advanced dimensions
        WHEN user_data.experience_level = 'advanced' THEN
            CASE 
                WHEN user_data.full_name LIKE '%Sunrise%' THEN '7''2" x 18.5" x 2.375"'
                ELSE '6''2" x 19.5" x 2.5"'
            END
            
        -- Expert dimensions
        WHEN user_data.experience_level = 'expert' THEN
            CASE 
                WHEN user_data.full_name LIKE '%Big Wave%' THEN '8''0" x 19" x 2.75"'
                WHEN user_data.full_name LIKE '%Veteran%' THEN '9''4" x 22.75" x 3.0"'
                WHEN user_data.full_name LIKE '%Pipeline%' THEN '6''0" x 19" x 2.375"'
                ELSE '6''1" x 19.25" x 2.4375"'
            END
            
        ELSE '6''2" x 19.5" x 2.5"'
    END,
    CASE 
        WHEN user_data.full_name LIKE '%Goofy%' THEN 'Soft-top foam board perfect for learning - forgiving and safe'
        WHEN user_data.full_name LIKE '%Beginner%' THEN 'Stable longboard designed for building confidence'
        WHEN user_data.full_name LIKE '%Kook%' THEN 'Learning-focused board that helps with fundamentals'
        WHEN user_data.full_name LIKE '%Barrel%' THEN 'Reef break specialist for getting pitted'
        WHEN user_data.full_name LIKE '%Shortboard%' THEN 'High-performance thruster for technical surfing'
        WHEN user_data.full_name LIKE '%Longboard%' THEN 'Classic noserider for stylish surfing'
        WHEN user_data.full_name LIKE '%Early Bird%' THEN 'Reliable dawn patrol companion'
        WHEN user_data.full_name LIKE '%Pro%' THEN 'Competition-ready high-performance board'
        WHEN user_data.full_name LIKE '%Sunrise%' THEN 'Gun for charging bigger waves'
        WHEN user_data.full_name LIKE '%Competition%' THEN 'Precision board for competitive surfing'
        WHEN user_data.full_name LIKE '%Veteran%' THEN 'Time-tested classic with proven performance'
        WHEN user_data.full_name LIKE '%Big Wave%' THEN 'Heavy water gun for serious conditions'
        WHEN user_data.full_name LIKE '%Instructor%' THEN 'Versatile teaching board for all skill levels'
        WHEN user_data.full_name LIKE '%Photographer%' THEN 'Reliable all-around board for various conditions'
        WHEN user_data.full_name LIKE '%Forecaster%' THEN 'Testing different conditions and forecasts'
        WHEN user_data.full_name LIKE '%SUP%' THEN 'Stand-up paddle surfboard for SUP surfing'
        WHEN user_data.full_name LIKE '%Shaper%' THEN 'Custom-shaped personal creation'
        WHEN user_data.full_name LIKE '%Free%' THEN 'Free-spirited board for any adventure'
        WHEN user_data.full_name LIKE '%Eco%' THEN 'Environmentally conscious sustainable board'
        WHEN user_data.full_name LIKE '%Pipeline%' THEN 'Hawaiian-inspired thruster for tubes'
        ELSE 'Versatile board for various conditions'
    END,
    -- Session count based on experience level and time surfing
    CASE 
        WHEN user_data.experience_level = 'beginner' THEN FLOOR(RANDOM() * 25 + 5)::INTEGER
        WHEN user_data.experience_level = 'intermediate' THEN FLOOR(RANDOM() * 75 + 25)::INTEGER  
        WHEN user_data.experience_level = 'advanced' THEN FLOOR(RANDOM() * 150 + 75)::INTEGER
        WHEN user_data.experience_level = 'expert' THEN FLOOR(RANDOM() * 300 + 150)::INTEGER
        ELSE FLOOR(RANDOM() * 50 + 20)::INTEGER
    END,
    NOW() - INTERVAL '1 year' * RANDOM()
FROM user_data;

COMMIT;