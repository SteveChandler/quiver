-- ================================================
-- Seed Intel Posts for Popular Beaches Using Existing Users
-- ================================================
-- Creates realistic intel posts from our 8 user personas for popular 
-- San Diego beaches, leveraging each user's unique characteristics
-- ================================================

-- Create intel posts for popular beaches using our seeded users
DO $$
DECLARE 
    -- User IDs (will be resolved dynamically)
    liquid_snake_id UUID;
    big_boss_id UUID; 
    solid_snake_id UUID;
    dana_williams_id UUID;
    paul_martinez_id UUID;
    larry_rodriguez_id UUID;
    tina_nakamura_id UUID;
    riley_chen_id UUID;
    
    -- Popular beach IDs
    pacific_beach_id UUID;
    ocean_beach_id UUID;
    mission_beach_id UUID;
    la_jolla_shores_id UUID;
    windansea_id UUID;
    blacks_beach_id UUID;
    sunset_cliffs_id UUID;
    swamis_id UUID;
    
BEGIN
    -- Resolve user IDs
    SELECT id INTO liquid_snake_id FROM profiles WHERE full_name = 'Liquid Snake' LIMIT 1;
    SELECT id INTO big_boss_id FROM profiles WHERE full_name = 'Big Boss' LIMIT 1;
    SELECT id INTO solid_snake_id FROM profiles WHERE full_name = 'Solid Snake' LIMIT 1;
    SELECT id INTO dana_williams_id FROM profiles WHERE full_name = 'Dana Williams' LIMIT 1;
    SELECT id INTO paul_martinez_id FROM profiles WHERE full_name = 'Paul Martinez' LIMIT 1;
    SELECT id INTO larry_rodriguez_id FROM profiles WHERE full_name = 'Larry Rodriguez' LIMIT 1;
    SELECT id INTO tina_nakamura_id FROM profiles WHERE full_name = 'Tina Nakamura' LIMIT 1;
    SELECT id INTO riley_chen_id FROM profiles WHERE full_name = 'Riley Chen' LIMIT 1;
    
    -- Resolve beach IDs
    SELECT id INTO pacific_beach_id FROM beaches WHERE name = 'Pacific Beach' LIMIT 1;
    SELECT id INTO ocean_beach_id FROM beaches WHERE name = 'Ocean Beach' LIMIT 1;
    SELECT id INTO mission_beach_id FROM beaches WHERE name = 'Mission Beach' LIMIT 1;
    SELECT id INTO la_jolla_shores_id FROM beaches WHERE name = 'La Jolla Shores' LIMIT 1;
    SELECT id INTO windansea_id FROM beaches WHERE name = 'Windansea Beach' LIMIT 1;
    SELECT id INTO blacks_beach_id FROM beaches WHERE name = 'Blacks Beach' LIMIT 1;
    SELECT id INTO sunset_cliffs_id FROM beaches WHERE name = 'Sunset Cliffs' LIMIT 1;
    SELECT id INTO swamis_id FROM beaches WHERE name = 'Swamis Beach' LIMIT 1;
    
    -- Verify we have users and beaches
    IF liquid_snake_id IS NULL THEN
        RAISE NOTICE 'Users not found - skipping intel post creation';
        RETURN;
    END IF;
    
    IF pacific_beach_id IS NULL AND ocean_beach_id IS NULL THEN
        RAISE NOTICE 'Popular beaches not found - skipping intel post creation';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating intel posts for popular beaches...';
    
    -- ================================================
    -- OCEAN BEACH - Larry Rodriguez's Home Turf
    -- ================================================
    
    IF ocean_beach_id IS NOT NULL AND larry_rodriguez_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (larry_rodriguez_id, ocean_beach_id, 32.7507, -117.254, 'conditions', 'OB Firing Right Now!', 
         'Clean 3-4ft sets with light offshore winds. The pier area is working perfectly on this incoming tide. Local crew is out but respectful - perfect session vibes!', 
         '{"wave_height_ft": "3-4", "wind": "light_offshore", "tide": "incoming", "crowd": "local_crew", "vibe": "respectful"}'::jsonb,
         5, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '1 hour'),
         
        (larry_rodriguez_id, ocean_beach_id, 32.7507, -117.254, 'parking', 'OB Parking Update - Newport Ave',
         'Street parking on Newport Ave is actually open today! City finally fixed those confusing "No Parking" signs. Still fills up by 8am on weekends though.',
         '{"location": "newport_ave", "availability": "good", "fills_by": "8am", "weekend_note": "early_arrival_recommended"}'::jsonb,
         8, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
         
        (larry_rodriguez_id, ocean_beach_id, 32.7507, -117.254, 'crowd', 'Classic OB Local Vibe',
         'Dawn patrol was mellow with the usual crew. Everyone knows the lineup etiquette here. Great spot to learn proper surf culture if you''re respectful.',
         '{"crowd_type": "locals", "time": "dawn_patrol", "vibe": "respectful", "etiquette": "important", "beginner_advice": "be_respectful"}'::jsonb,
         6, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '30 minutes');
    END IF;
    
    -- ================================================
    -- PACIFIC BEACH - Popular and Accessible  
    -- ================================================
    
    IF pacific_beach_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (paul_martinez_id, pacific_beach_id, 32.7979, -117.255, 'conditions', 'PB Perfect for Photos Right Now',
         'Amazing lighting conditions with clean 2-3ft waves. Crystal Pier area is working nicely. Perfect for getting action shots and having fun in the water!',
         '{"wave_height_ft": "2-3", "quality": "clean", "lighting": "amazing", "photo_opportunity": "excellent", "pier_area": "working"}'::jsonb,
         4, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '45 minutes'),
         
        (riley_chen_id, pacific_beach_id, 32.7979, -117.255, 'crowd', 'Great Learning Environment Today',
         'Perfect beginner conditions with other learners out. Surf schools are active but plenty of room. Everyone''s been super helpful with tips!',
         '{"beginner_friendly": true, "surf_schools": "active", "crowd": "helpful", "learning_environment": "excellent"}'::jsonb,
         3, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '1 hour'),
         
        (tina_nakamura_id, pacific_beach_id, 32.7979, -117.255, 'parking', 'PB Parking Strategy',
         'Main lots full by 9am but found street parking on Garnet Ave. About 3 block walk but totally manageable with gear. Meters take cards now!',
         '{"main_lots": "full_by_9am", "alternative": "garnet_ave", "walk_distance": "3_blocks", "payment": "cards_accepted"}'::jsonb,
         7, true, NOW() + INTERVAL '8 hours', NOW() - INTERVAL '2 hours');
    END IF;
    
    -- ================================================
    -- MISSION BEACH - Party Wave Central
    -- ================================================
    
    IF mission_beach_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (riley_chen_id, mission_beach_id, 32.7702, -117.2525, 'conditions', 'Perfect Learning Waves!',
         'Small but super clean waves today. Great for practicing fundamentals without intimidation. Lots of other beginners out so don''t feel self-conscious!',
         '{"wave_height_ft": "1-2", "quality": "clean", "beginner_friendly": true, "intimidation_factor": "low"}'::jsonb,
         4, true, NOW() + INTERVAL '5 hours', NOW() - INTERVAL '1.5 hours'),
         
        (paul_martinez_id, mission_beach_id, 32.7702, -117.2525, 'other', 'Weekend Beach Scene',
         'Classic Mission Beach weekend energy! Great people watching and fun waves. Perfect for capturing the California beach lifestyle in photos.',
         '{"vibe": "weekend_energy", "scene": "california_lifestyle", "photo_ops": "excellent", "energy": "high"}'::jsonb,
         5, true, NOW() + INTERVAL '12 hours', NOW() - INTERVAL '3 hours');
    END IF;
    
    -- ================================================
    -- LA JOLLA SHORES - Beginner Paradise
    -- ================================================
    
    IF la_jolla_shores_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (dana_williams_id, la_jolla_shores_id, 32.8507, -117.2726, 'conditions', 'Dawn Patrol Gold at Shores',
         'Glass-off conditions at sunrise with gentle 1-2ft waves. Perfect for dawn patrol yoga surfers. Crystal clear water with rays swimming around!',
         '{"wave_height_ft": "1-2", "wind": "glass_off", "time": "sunrise", "water_clarity": "crystal", "marine_life": "rays"}'::jsonb,
         9, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '4 hours'),
         
        (riley_chen_id, la_jolla_shores_id, 32.8507, -117.2726, 'access', 'Easiest Beach Access Ever',
         'Literally drive right up to the beach! Paved parking and flat sand entry. Perfect for beginners with all the gear. Lifeguards on duty too.',
         '{"access": "drive_up", "parking": "paved", "entry": "flat_sand", "beginner_gear": "easy", "lifeguards": "on_duty"}'::jsonb,
         6, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
         
        (paul_martinez_id, la_jolla_shores_id, 32.8507, -117.2726, 'other', 'Underwater Photography Paradise',
         'Water clarity is incredible today! Perfect for underwater shots with the marine life. Gentle waves make it easy to capture clear underwater footage.',
         '{"water_clarity": "incredible", "marine_life": "abundant", "underwater_photo": "excellent", "wave_conditions": "gentle"}'::jsonb,
         4, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '1 hour');
    END IF;
    
    -- ================================================
    -- WINDANSEA BEACH - Technical Break
    -- ================================================
    
    IF windansea_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (liquid_snake_id, windansea_id, 32.8371, -117.2791, 'conditions', 'Elite Tactical Assessment - Windansea',
         'Perfect tactical conditions achieved. 4-5ft with precise offshore wind patterns. Peak performing at maximum efficiency. Advanced maneuvers possible.',
         '{"wave_height_ft": "4-5", "wind": "offshore", "precision": "maximum", "difficulty": "advanced", "maneuvers": "possible"}'::jsonb,
         3, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '30 minutes'),
         
        (big_boss_id, windansea_id, 32.8371, -117.2791, 'hazard', 'Rock Garden Hazard - Leadership Advisory',
         'Attention all operatives: Rock exposure increased on south side due to sand movement. Maintain tactical awareness. Leaders adapt, followers get injured.',
         '{"hazard_type": "rocks", "location": "south_side", "cause": "sand_movement", "severity": "moderate", "leadership_note": "adapt_or_fail"}'::jsonb,
         7, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
         
        (tina_nakamura_id, windansea_id, 32.8371, -117.2791, 'crowd', 'Local Lineup Dynamics',
         'Fascinating local crew with deep knowledge of this break. Respectful atmosphere but you need to earn your waves. Great learning experience about lineup culture.',
         '{"crowd_type": "locals", "knowledge_level": "deep", "vibe": "respectful", "wave_earning": "required", "cultural_learning": true}'::jsonb,
         5, true, NOW() + INTERVAL '8 hours', NOW() - INTERVAL '1.5 hours');
    END IF;
    
    -- ================================================
    -- BLACKS BEACH - Advanced Only
    -- ================================================
    
    IF blacks_beach_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (big_boss_id, blacks_beach_id, 32.9016, -117.2524, 'conditions', 'Legendary Conditions at Blacks',
         'This is what legends are made of. 5-6ft with powerful, clean faces. Not for soldiers - only for commanders who understand true power and consequence.',
         '{"wave_height_ft": "5-6", "power": "high", "quality": "clean", "difficulty": "expert_only", "consequence": "serious"}'::jsonb,
         12, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '1 hour'),
         
        (solid_snake_id, blacks_beach_id, 32.9016, -117.2524, 'access', 'Stealth Trail Reconnaissance',
         'Trail conditions assessed: steep but manageable with proper technique. New rope at critical section. Recommend dawn infiltration to avoid civilian traffic.',
         '{"trail": "steep", "condition": "manageable", "improvement": "new_rope", "recommendation": "dawn_infiltration"}'::jsonb,
         4, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '3 hours'),
         
        (dana_williams_id, blacks_beach_id, 32.9016, -117.2524, 'hazard', 'Strong Current Advisory - Dawn Patrol',
         'Heads up dawn patrol crew: significant rip current on north end this morning. Know your limits and swim parallel if caught. Safety first always.',
         '{"hazard_type": "rip_current", "location": "north_end", "time": "morning", "safety_advice": "swim_parallel", "target": "dawn_patrol"}'::jsonb,
         8, true, NOW() + INTERVAL '12 hours', NOW() - INTERVAL '4 hours');
    END IF;
    
    -- ================================================
    -- SUNSET CLIFFS - Dramatic Sessions
    -- ================================================
    
    IF sunset_cliffs_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (liquid_snake_id, sunset_cliffs_id, 32.7351, -117.2519, 'conditions', 'Tactical Excellence at Sunset Cliffs',
         'Abs and Luscombs delivering superior performance. 4-5ft with strategic offshore patterns. Perfect execution window available for next 2 hours.',
         '{"breaks": ["abs", "luscombs"], "wave_height_ft": "4-5", "wind": "offshore", "window": "2_hours", "execution": "perfect"}'::jsonb,
         6, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '30 minutes'),
         
        (paul_martinez_id, sunset_cliffs_id, 32.7351, -117.2519, 'other', 'Golden Hour Photography Magic',
         'Sunset session photography is absolutely magical here! The way the light hits the cliffs and waves creates incredible shots. Bring waterproof gear!',
         '{"photography": "magical", "lighting": "golden_hour", "subjects": ["cliffs", "waves"], "gear": "waterproof_required"}'::jsonb,
         7, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '2 hours'),
         
        (tina_nakamura_id, sunset_cliffs_id, 32.7351, -117.2519, 'hazard', 'Cliff Jump Hazard Warning',
         'Saw some tourists attempting dangerous cliff jumps. Stick to the designated surf entry points. This isn''t a tourist attraction - it''s a serious surf break.',
         '{"hazard_type": "cliff_jumping", "perpetrators": "tourists", "safety": "use_designated_entry", "seriousness": "high"}'::jsonb,
         9, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 hours');
    END IF;
    
    -- ================================================
    -- SWAMIS BEACH - Dawn Patrol Mecca
    -- ================================================
    
    IF swamis_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (dana_williams_id, swamis_id, 33.0362, -117.3032, 'conditions', 'Swamis Dawn Patrol Perfection',
         'Had it completely to myself until 6:30am! Clean 3-4ft with textbook offshore grooming. Contest-quality waves for those willing to set the early alarm.',
         '{"wave_height_ft": "3-4", "wind": "offshore", "quality": "contest_level", "crowd": "solo_until_630", "commitment": "early_alarm"}'::jsonb,
         11, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '5 hours'),
         
        (tina_nakamura_id, swamis_id, 33.0362, -117.3032, 'parking', 'Swamis Parking Nightmare',
         'Main lot completely packed by 6:45am! Try the residential streets up the hill but respect the locals - no music, no trash. Beautiful session worth the walk.',
         '{"main_lot": "full_by_645am", "alternative": "residential_hills", "local_respect": "critical", "restrictions": ["no_music", "no_trash"]}'::jsonb,
         6, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 hour');
    END IF;
    
    -- ================================================
    -- MISSION BEACH - Learning Hub
    -- ================================================
    
    IF mission_beach_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (riley_chen_id, mission_beach_id, 32.7702, -117.2525, 'conditions', 'Perfect for New Surfers Today',
         'Small, forgiving waves with sandy bottom. Lots of other learners and helpful instructors around. Feel safe to practice here without worry!',
         '{"wave_height_ft": "1-2", "bottom": "sand", "safety": "high", "instructors": "available", "learner_community": "active"}'::jsonb,
         8, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '1 hour'),
         
        (paul_martinez_id, mission_beach_id, 32.7702, -117.2525, 'crowd', 'Weekend Beach Culture Documentation',
         'Peak weekend beach scene in full effect! Amazing mix of surfers, volleyball players, and beachgoers. Perfect for capturing authentic San Diego beach culture.',
         '{"scene": "weekend_peak", "activities": ["surfing", "volleyball", "beachgoing"], "culture": "authentic_san_diego"}'::jsonb,
         4, true, NOW() + INTERVAL '10 hours', NOW() - INTERVAL '2 hours');
    END IF;
    
    -- ================================================
    -- WINDANSEA - Technical Challenge
    -- ================================================
    
    IF windansea_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (solid_snake_id, windansea_id, 32.8371, -117.2791, 'conditions', 'Stealth Session Reconnaissance Complete',
         'Mission accomplished: Technical break performing at peak efficiency. 3-4ft with precision timing required. Infiltrated lineup successfully.',
         '{"wave_height_ft": "3-4", "difficulty": "technical", "timing": "precision_required", "mission_status": "accomplished"}'::jsonb,
         2, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '2 hours'),
         
        (big_boss_id, windansea_id, 32.8371, -117.2791, 'other', 'Legendary Break Wisdom',
         'This break separates the experienced from the pretenders. Respect the lineup, understand the rhythm, wait for your opportunity. Victory through patience.',
         '{"difficulty": "advanced", "lineup_respect": "critical", "rhythm": "complex", "patience": "required", "philosophy": "victory_through_patience"}'::jsonb,
         15, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '6 hours');
    END IF;
    
    -- ================================================
    -- LA JOLLA SHORES - Multiple Perspectives
    -- ================================================
    
    IF la_jolla_shores_id IS NOT NULL THEN
        INSERT INTO intel_posts (user_id, beach_id, latitude, longitude, tag, title, description, surf_conditions, confirmations_count, is_active, expires_at, created_at) VALUES
        (tina_nakamura_id, la_jolla_shores_id, 32.8507, -117.2726, 'other', 'Travel Review: Perfect Beginner Spot',
         'As someone exploring the California coast, this is hands down the best beginner beach I''ve found. Gentle waves, easy access, beautiful setting.',
         '{"travel_perspective": true, "beginner_rating": "best", "attributes": ["gentle_waves", "easy_access", "beautiful_setting"]}'::jsonb,
         5, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 hours'),
         
        (larry_rodriguez_id, la_jolla_shores_id, 32.8507, -117.2726, 'parking', 'Shores Parking Pro Tips',
         'Main lot fills up fast but there''s overflow parking up Torrey Pines Road. It''s a bit of a hike but way better than circling forever. Meters take cards!',
         '{"main_lot": "fills_fast", "overflow": "torrey_pines_road", "walk": "bit_of_hike", "payment": "cards_accepted"}'::jsonb,
         7, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '1 hour');
    END IF;
    
    -- Create some intel post confirmations for community validation
    INSERT INTO intel_post_confirmations (intel_post_id, user_id, created_at)
    SELECT DISTINCT
        ip.id,
        CASE (RANDOM() * 8)::INTEGER
            WHEN 0 THEN liquid_snake_id
            WHEN 1 THEN big_boss_id
            WHEN 2 THEN solid_snake_id
            WHEN 3 THEN dana_williams_id
            WHEN 4 THEN paul_martinez_id
            WHEN 5 THEN larry_rodriguez_id
            WHEN 6 THEN tina_nakamura_id
            ELSE riley_chen_id
        END,
        ip.created_at + INTERVAL '1 hour' * (1 + RANDOM() * 4) -- Confirmations 1-4 hours after post
    FROM intel_posts ip
    WHERE ip.created_at > NOW() - INTERVAL '1 day' -- Only recent posts
        AND ip.user_id != CASE (RANDOM() * 8)::INTEGER
            WHEN 0 THEN liquid_snake_id
            WHEN 1 THEN big_boss_id
            WHEN 2 THEN solid_snake_id
            WHEN 3 THEN dana_williams_id
            WHEN 4 THEN paul_martinez_id
            WHEN 5 THEN larry_rodriguez_id
            WHEN 6 THEN tina_nakamura_id
            ELSE riley_chen_id
        END -- Don't confirm own posts
        AND RANDOM() < 0.4 -- 40% chance to confirm
    LIMIT 15;
    
    -- Update intel posts confirmations count
    UPDATE intel_posts 
    SET confirmations_count = (
        SELECT COUNT(*) 
        FROM intel_post_confirmations 
        WHERE intel_post_confirmations.intel_post_id = intel_posts.id
    )
    WHERE created_at > NOW() - INTERVAL '1 day';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INTEL POSTS SEEDING COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created persona-based intel posts:';
    RAISE NOTICE '🏠 Larry Rodriguez: Ocean Beach local knowledge (3 posts)';
    RAISE NOTICE '📸 Paul Martinez: Photography insights (4 posts)';
    RAISE NOTICE '🏄‍♀️ Riley Chen: Beginner-friendly observations (3 posts)';
    RAISE NOTICE '🌅 Dana Williams: Dawn patrol conditions (2 posts)';
    RAISE NOTICE '🐍 Liquid Snake: Tactical assessments (2 posts)';
    RAISE NOTICE '🌊 Big Boss: Strategic wisdom (2 posts)';
    RAISE NOTICE '🕵️ Solid Snake: Stealth reconnaissance (1 post)';
    RAISE NOTICE '🚐 Tina Nakamura: Travel perspectives (4 posts)';
    RAISE NOTICE '';
    RAISE NOTICE 'Beaches covered:';
    RAISE NOTICE '• Ocean Beach (local expertise)';
    RAISE NOTICE '• Pacific Beach (photo opportunities)';
    RAISE NOTICE '• Mission Beach (learning environment)';
    RAISE NOTICE '• La Jolla Shores (beginner paradise)';
    RAISE NOTICE '• Windansea Beach (technical challenge)';
    RAISE NOTICE '• Blacks Beach (expert territory)';
    RAISE NOTICE '• Sunset Cliffs (dramatic sessions)';
    RAISE NOTICE '• Swamis Beach (dawn patrol mecca)';
    RAISE NOTICE '';
    RAISE NOTICE 'Community validation: ~15 confirmations added';
    RAISE NOTICE 'Ready for Local Intel feature testing! 🚀';

END $$;
