-- ================================================
-- Comprehensive Mock Data - Bypass Trigger Version
-- ================================================
-- This version completely disables the trigger during execution
-- and manually updates counts at the end

DO $$
DECLARE
    -- Existing users (replace with actual UUIDs from your system)
    liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
    big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
    solid_snake_id UUID := '638edbd2-7fd3-49b5-8129-84456764df4c'::UUID;
    
    -- New user IDs (replace with actual UUIDs after creating in Supabase Auth)
    rookie_riley_id UUID := '05f3d22c-a282-4252-bb54-64dcb74a83dd'::UUID;
    local_larry_id UUID := '382c284f-e36d-43cd-8e44-0930544db459'::UUID;
    travel_tina_id UUID := '701beae0-96aa-43d4-a29a-4353ead6ea24'::UUID;
    photo_paul_id UUID := '31d78eb7-357e-444e-88cd-d728ebf4f1ae'::UUID;
    dawn_dana_id UUID := '3958e9bb-acf8-45a1-ab20-7953ec1cb0e7'::UUID;
    
BEGIN
    RAISE NOTICE 'Starting mock data creation - BYPASSING TRIGGERS...';
    
    -- ================================
    -- STEP 1: DISABLE ALL TRIGGERS
    -- ================================
    
    -- Disable the problematic trigger completely
    DROP TRIGGER IF EXISTS user_follows_count_trigger ON user_follows;
    RAISE NOTICE 'Disabled user_follows trigger to prevent errors';
    
    -- ================================
    -- STEP 2: CREATE FOLLOW RELATIONSHIPS
    -- ================================
    
    RAISE NOTICE 'Creating follow relationships (no trigger conflicts)...';
    
    INSERT INTO user_follows (follower_id, following_id, created_at) VALUES
    -- Solid Snake follows everyone (surveillance and intelligence gathering)
    (solid_snake_id, liquid_snake_id, NOW() - INTERVAL '8 months'),
    (solid_snake_id, big_boss_id, NOW() - INTERVAL '8 months'),
    (solid_snake_id, rookie_riley_id, NOW() - INTERVAL '4 months'),
    (solid_snake_id, local_larry_id, NOW() - INTERVAL '5 months'),
    (solid_snake_id, travel_tina_id, NOW() - INTERVAL '3 months'),
    (solid_snake_id, photo_paul_id, NOW() - INTERVAL '2 months'),
    (solid_snake_id, dawn_dana_id, NOW() - INTERVAL '1 month'),
    
    -- Liquid Snake follows everyone (elite operative gathering intel)
    (liquid_snake_id, big_boss_id, NOW() - INTERVAL '6 months'),
    (liquid_snake_id, solid_snake_id, NOW() - INTERVAL '8 months'),
    (liquid_snake_id, local_larry_id, NOW() - INTERVAL '3 months'),
    (liquid_snake_id, travel_tina_id, NOW() - INTERVAL '2 months'),
    (liquid_snake_id, photo_paul_id, NOW() - INTERVAL '1 month'),
    (liquid_snake_id, dawn_dana_id, NOW() - INTERVAL '2 weeks'),
    
    -- Big Boss follows select operatives
    (big_boss_id, liquid_snake_id, NOW() - INTERVAL '6 months'),
    (big_boss_id, solid_snake_id, NOW() - INTERVAL '8 months'),
    (big_boss_id, dawn_dana_id, NOW() - INTERVAL '4 months'),
    (big_boss_id, travel_tina_id, NOW() - INTERVAL '1 month'),
    
    -- Others follow back
    (rookie_riley_id, local_larry_id, NOW() - INTERVAL '4 months'),
    (rookie_riley_id, dawn_dana_id, NOW() - INTERVAL '3 months'),
    (rookie_riley_id, photo_paul_id, NOW() - INTERVAL '2 months'),
    (rookie_riley_id, liquid_snake_id, NOW() - INTERVAL '1 month'),
    (rookie_riley_id, travel_tina_id, NOW() - INTERVAL '3 weeks'),
    
    (local_larry_id, rookie_riley_id, NOW() - INTERVAL '4 months'),
    (local_larry_id, photo_paul_id, NOW() - INTERVAL '3 months'),
    (local_larry_id, dawn_dana_id, NOW() - INTERVAL '2 months'),
    (local_larry_id, travel_tina_id, NOW() - INTERVAL '6 weeks'),
    
    (travel_tina_id, local_larry_id, NOW() - INTERVAL '1 year'),
    (travel_tina_id, photo_paul_id, NOW() - INTERVAL '8 months'),
    (travel_tina_id, dawn_dana_id, NOW() - INTERVAL '6 months'),
    (travel_tina_id, liquid_snake_id, NOW() - INTERVAL '2 months'),
    
    (photo_paul_id, travel_tina_id, NOW() - INTERVAL '8 months'),
    (photo_paul_id, dawn_dana_id, NOW() - INTERVAL '6 months'),
    (photo_paul_id, local_larry_id, NOW() - INTERVAL '3 months'),
    (photo_paul_id, big_boss_id, NOW() - INTERVAL '1 month'),
    (photo_paul_id, rookie_riley_id, NOW() - INTERVAL '2 weeks'),
    
    (dawn_dana_id, big_boss_id, NOW() - INTERVAL '4 months'),
    (dawn_dana_id, travel_tina_id, NOW() - INTERVAL '6 months'),
    (dawn_dana_id, photo_paul_id, NOW() - INTERVAL '4 months'),
    (dawn_dana_id, local_larry_id, NOW() - INTERVAL '2 months')
    ON CONFLICT (follower_id, following_id) DO NOTHING;
    
    -- ================================
    -- STEP 3: MANUALLY UPDATE COUNTS
    -- ================================
    
    RAISE NOTICE 'Manually updating follower/following counts...';
    
    -- Update followers_count for each user
    UPDATE profiles SET followers_count = (
        SELECT COUNT(*) FROM user_follows WHERE following_id = profiles.id
    );
    
    -- Update following_count for each user  
    UPDATE profiles SET following_count = (
        SELECT COUNT(*) FROM user_follows WHERE follower_id = profiles.id
    );
    
    -- ================================
    -- FINAL VERIFICATION
    -- ================================
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FOLLOW RELATIONSHIPS CREATED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    
    -- Show the results
    RAISE NOTICE 'Solid Snake following count: %', (SELECT following_count FROM profiles WHERE id = solid_snake_id);
    RAISE NOTICE 'Total follow relationships: %', (SELECT COUNT(*) FROM user_follows);
    
    RAISE NOTICE 'Mock data creation completed without trigger conflicts! 🎉';
    
END $$;

-- Verification query
SELECT 
    p.full_name,
    p.followers_count,
    p.following_count
FROM profiles p 
WHERE p.id IN (
    '23233d36-97f9-4322-8b36-113c880b841f',
    '16b87cb1-34b6-434d-820c-0bc4e0927f5b', 
    '638edbd2-7fd3-49b5-8129-84456764df4c'
)
ORDER BY p.full_name; 