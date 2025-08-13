-- Seed specific intel and review data for Pacific Beach and Ocean Beach
-- Ensures these popular beaches have comprehensive community content

BEGIN;

-- Get the beach IDs for Pacific Beach and Ocean Beach
DO $$
DECLARE
    pacific_beach_id UUID;
    ocean_beach_id UUID;
    user_ids UUID[];
    current_user_id UUID;
    current_date TIMESTAMP := NOW();
BEGIN
    -- Get beach IDs
    SELECT id INTO pacific_beach_id FROM public.beaches WHERE name = 'Pacific Beach';
    SELECT id INTO ocean_beach_id FROM public.beaches WHERE name = 'Ocean Beach';
    
    -- Get array of user IDs
    SELECT ARRAY_AGG(id) INTO user_ids FROM public.profiles WHERE full_name LIKE '% %';
    
    -- Add specific intel posts for Pacific Beach
    INSERT INTO public.intel_posts (
        user_id, beach_id, latitude, longitude, tag, title, description, 
        surf_conditions, confirmations_count, created_at
    ) VALUES
    -- Pacific Beach intel posts
    (user_ids[1], pacific_beach_id, 32.7979, -117.255, 'parking', 'Free Beach Parking After 6PM', 
     'All the metered spots are free after 6pm and on weekends. There''s also a big lot behind the restaurants that''s usually pretty open.', 
     '{"parking_cost": "free_evenings", "availability": "good", "location": "street_and_lot"}'::jsonb, 
     8, current_date - INTERVAL '2 days'),
    
    (user_ids[2], pacific_beach_id, 32.7979, -117.255, 'conditions', 'Perfect Morning Glass-Off', 
     'This morning was absolutely firing! 3-4ft clean waves with offshore winds until about 10am. Water temp is perfect around 70°F right now.', 
     '{"wave_height_ft": "3-4", "wind": "offshore", "water_temp_f": 70, "time": "morning", "quality": "excellent"}'::jsonb, 
     12, current_date - INTERVAL '1 day'),
    
    (user_ids[3], pacific_beach_id, 32.7979, -117.255, 'crowd', 'Busy on Weekends', 
     'Weekends get pretty crowded here, especially the main peak near the pier. If you want less crowds, paddle out north of the pier or hit it early morning.', 
     '{"crowd_size": "high_weekends", "less_crowded_areas": "north_of_pier", "best_time": "early_morning"}'::jsonb, 
     6, current_date - INTERVAL '3 days'),
    
    (user_ids[4], pacific_beach_id, 32.7979, -117.255, 'access', 'Easy Beach Access', 
     'Super easy access right from the boardwalk. No hiking required! Great for families and beginners. Restrooms and showers available.', 
     '{"difficulty": "easy", "facilities": ["restrooms", "showers"], "family_friendly": true}'::jsonb, 
     9, current_date - INTERVAL '1 week'),
    
    (user_ids[5], pacific_beach_id, 32.7979, -117.255, 'other', 'Best at Higher Tides', 
     'This spot really works best on mid to high tide. At low tide it gets pretty shallow and rocky near the pier. Check the tide charts!', 
     '{"optimal_tide": "mid_to_high", "low_tide_warning": "shallow_rocky"}'::jsonb, 
     7, current_date - INTERVAL '5 days'),
    
    -- Ocean Beach intel posts
    (user_ids[6], ocean_beach_id, 32.7493, -117.2511, 'conditions', 'Heavy Local Scene', 
     'OB is a classic but the locals run a tight ship here. Show respect, wait your turn, and you''ll be welcomed. Some of the best waves in SD when it''s working.', 
     '{"local_vibe": "heavy", "respect_required": true, "wave_quality": "excellent", "etiquette": "important"}'::jsonb, 
     15, current_date - INTERVAL '1 day'),
    
    (user_ids[7], ocean_beach_id, 32.7493, -117.2511, 'parking', 'Parking Challenge', 
     'Parking is tough here. The lot fills up fast and street parking is limited. Get here early or be prepared to walk. Some paid lots nearby but they''re pricey.', 
     '{"parking_difficulty": "high", "recommendation": "arrive_early", "paid_options": "expensive"}'::jsonb, 
     11, current_date - INTERVAL '2 days'),
    
    (user_ids[8], ocean_beach_id, 32.7493, -117.2511, 'hazard', 'Strong Currents and Rips', 
     'OB can have some gnarly rips, especially on bigger days. The pier creates some funky currents too. Know your limits and watch for rip channels.', 
     '{"hazard_type": "currents", "severity": "high", "pier_effects": true, "skill_recommendation": "intermediate_plus"}'::jsonb, 
     18, current_date - INTERVAL '4 days'),
    
    (user_ids[9], ocean_beach_id, 32.7493, -117.2511, 'other', 'Classic San Diego Break', 
     'This is quintessential San Diego surfing. When the swell hits just right, OB can produce some world-class waves. The pier section is legendary.', 
     '{"break_type": "classic", "reputation": "legendary", "best_section": "pier"}'::jsonb, 
     13, current_date - INTERVAL '6 days'),
    
    (user_ids[10], ocean_beach_id, 32.7493, -117.2511, 'access', 'Multiple Access Points', 
     'You can access the beach from several points - by the pier, Dog Beach to the north, or the main OB area. Each has different vibes and wave characteristics.', 
     '{"access_points": ["pier", "dog_beach", "main_ob"], "varied_conditions": true}'::jsonb, 
     8, current_date - INTERVAL '1 week');

    -- Add specific beach reviews for Pacific Beach
    INSERT INTO public.beach_reviews (
        beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating, 
        parking_rating, accessibility_rating, title, content, visit_date, helpful_count, created_at
    ) VALUES
    -- Pacific Beach reviews
    (pacific_beach_id, user_ids[1], 4, 4, 2, 3, 5, 'Great Beginner Spot with Good Vibes', 
     'Pacific Beach is perfect for learning to surf. The waves are usually pretty forgiving, and the crowd is generally friendly to beginners. The access is super easy - just walk right onto the beach from the boardwalk. Parking can be tricky on weekends but it''s manageable. The water is clean and there are facilities nearby which is great for families. I''ve been coming here for years and it never gets old.', 
     current_date::date - 5, 14, current_date - INTERVAL '1 week'),
    
    (pacific_beach_id, user_ids[3], 5, 5, 3, 2, 5, 'Morning Sessions Are Magic Here', 
     'If you can get here early morning, Pacific Beach can be absolutely incredible. Glass-off conditions with clean 3-4ft waves are common, especially in summer. The crowd builds up as the day goes on, but dawn patrol sessions are often uncrowded and perfect. The waves break really nicely along the whole stretch of beach. Parking is the only real downside - you either pay for meters or hunt for street spots.', 
     current_date::date - 12, 22, current_date - INTERVAL '2 weeks'),
    
    (pacific_beach_id, user_ids[5], 3, 3, 1, 4, 4, 'Solid Backup Option', 
     'PB is a reliable spot when other places are blown out or too crowded. It''s not the most exciting surf in San Diego, but it''s consistent and accessible. The waves tend to be on the smaller side but they''re clean and fun for longboarding or working on your technique. The whole area has a good vibe with plenty of food and drinks nearby for post-surf hangs.', 
     current_date::date - 20, 9, current_date - INTERVAL '3 weeks'),
    
    -- Ocean Beach reviews  
    (ocean_beach_id, user_ids[6], 5, 5, 4, 1, 3, 'World-Class When It''s On', 
     'Ocean Beach is hands down one of the best waves in San Diego when conditions align. The pier section can produce barrels that rival anywhere in California. However, this place demands respect - the locals have been surfing here for decades and the lineup can be heavy. The waves are powerful and the currents are strong, so it''s definitely not for beginners. Parking is a nightmare and the walk can be long, but when OB is firing, it''s worth every bit of hassle.', 
     current_date::date - 3, 28, current_date - INTERVAL '4 days'),
    
    (ocean_beach_id, user_ids[8], 4, 5, 3, 1, 2, 'Challenging but Rewarding', 
     'OB will test you in every way - from finding parking to navigating the lineup to handling the power of the waves. The surf can be absolutely incredible, but you need to earn your waves here. The local crew is tight-knit and protective of their break, which I actually respect. The access down to the beach isn''t terrible but it''s not the easiest either. If you''re up for the challenge and can handle more advanced conditions, OB will reward you with some of the best surfing of your life.', 
     current_date::date - 8, 19, current_date - INTERVAL '10 days'),
    
    (ocean_beach_id, user_ids[10], 3, 4, 2, 2, 3, 'Classic SD Break with Character', 
     'Ocean Beach has so much character and history. You can feel the decades of surf culture when you paddle out here. The waves can be really good - long, powerful, and well-formed when the swell is right. It''s definitely more challenging than most San Diego spots, both in terms of wave power and lineup dynamics. The whole OB area has a cool, laid-back vibe that''s different from the more touristy beach towns. Worth experiencing if you''re visiting SD, just come with the right attitude.', 
     current_date::date - 15, 12, current_date - INTERVAL '2 weeks');

    -- Add some review likes
    INSERT INTO public.beach_review_likes (review_id, user_id, created_at)
    SELECT br.id, unnest(user_ids[1:5]), current_date - INTERVAL '1 day' * (random() * 7)
    FROM public.beach_reviews br 
    WHERE br.beach_id IN (pacific_beach_id, ocean_beach_id)
      AND br.user_id != ALL(user_ids[1:5])
    LIMIT 20;

    -- Add intel post confirmations  
    INSERT INTO public.intel_post_confirmations (intel_post_id, user_id, created_at)
    SELECT ip.id, unnest(user_ids[1:8]), current_date - INTERVAL '1 hour' * (random() * 48)
    FROM public.intel_posts ip 
    WHERE ip.beach_id IN (pacific_beach_id, ocean_beach_id)
      AND ip.user_id != ALL(user_ids[1:8])
    LIMIT 30;

END $$;

COMMIT;