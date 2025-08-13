-- Seed comprehensive intel posts for all beaches
-- Creates realistic community-generated local knowledge

BEGIN;

-- Create intel posts for beaches using realistic scenarios
WITH beach_users AS (
    SELECT 
        b.id as beach_id,
        b.name as beach_name,
        b.latitude,
        b.longitude,
        ARRAY_AGG(p.id) as user_ids,
        ARRAY_AGG(p.full_name) as user_names
    FROM public.beaches b
    CROSS JOIN public.profiles p 
    WHERE p.full_name LIKE '% %' -- Only mock users
    GROUP BY b.id, b.name, b.latitude, b.longitude
)
INSERT INTO public.intel_posts (
    user_id, beach_id, latitude, longitude, tag, title, description, 
    surf_conditions, confirmations_count, created_at
)
SELECT 
    (bu.user_ids)[FLOOR(RANDOM() * array_length(bu.user_ids, 1)) + 1] as user_id,
    bu.beach_id,
    bu.latitude,
    bu.longitude,
    tag_data.tag::intel_post_tag,
    tag_data.title,
    tag_data.description,
    tag_data.surf_conditions,
    FLOOR(RANDOM() * 15 + 1)::INTEGER, -- 1-15 confirmations
    NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 30) -- Last 30 days
FROM beach_users bu
CROSS JOIN (
    VALUES 
    -- Parking information
    ('parking', 'Free Street Parking Available', 'Found plenty of free parking on the side streets. No meter required before 8am on weekends.', '{"parking_difficulty": "easy", "cost": "free", "availability": "high"}'::jsonb),
    ('parking', 'Paid Lot - $15/day', 'Main parking lot charges $15 for all day. Gets full by 10am on good surf days.', '{"parking_difficulty": "moderate", "cost": "paid", "availability": "limited"}'::jsonb),
    ('parking', 'Early Bird Gets the Spot', 'If you arrive before sunrise, plenty of spots. After 8am, forget about it on weekends.', '{"parking_difficulty": "moderate", "cost": "free", "availability": "time_dependent"}'::jsonb),
    
    -- Access conditions  
    ('access', 'Easy Beach Access', 'Paved path from parking to beach. Suitable for all equipment. No stairs.', '{"difficulty": "easy", "equipment_friendly": true, "stairs": false}'::jsonb),
    ('access', 'Steep Trail to Beach', 'Rocky trail down cliff face. Be careful with boards. Definitely not for beginners.', '{"difficulty": "difficult", "equipment_friendly": false, "stairs": false}'::jsonb),
    ('access', 'Long Walk from Parking', 'About 1/4 mile walk on sand. Good workout but manageable with gear.', '{"difficulty": "moderate", "equipment_friendly": true, "distance": "0.25_mile"}'::jsonb),
    
    -- Current surf conditions
    ('conditions', 'Clean 3-4ft Waves', 'Offshore winds cleaned it up nicely this morning. Shoulder to head high sets. Water temp around 65°F.', '{"wave_height_ft": "3-4", "wind": "offshore", "water_temp_f": 65, "cleanliness": "clean"}'::jsonb),
    ('conditions', 'Blown Out and Messy', 'Strong onshore winds have made it pretty choppy. Wait for the wind to back off this afternoon.', '{"wave_height_ft": "2-3", "wind": "onshore", "cleanliness": "poor", "recommendation": "wait"}'::jsonb),
    ('conditions', 'Epic Dawn Session!', 'Glassy conditions at sunrise with consistent 4-5ft sets. Best surf we''ve had in weeks!', '{"wave_height_ft": "4-5", "wind": "calm", "time": "dawn", "quality": "epic"}'::jsonb),
    ('conditions', 'Small but Fun', 'Only 1-2ft but really clean. Perfect for beginners or longboarders. Crystal clear water.', '{"wave_height_ft": "1-2", "wind": "light_offshore", "beginner_friendly": true, "water_clarity": "excellent"}'::jsonb),
    
    -- Crowd reports
    ('crowd', 'Pretty Mellow Crowd', 'About 15-20 people out. Everyone sharing waves nicely. Good vibe in the water.', '{"crowd_size": "moderate", "vibe": "positive", "wave_sharing": true}'::jsonb),
    ('crowd', 'Zoo Out There!', 'Super crowded today - at least 50+ surfers. Tough to get waves. Maybe try somewhere else.', '{"crowd_size": "very_high", "wave_availability": "limited", "recommendation": "try_elsewhere"}'::jsonb),
    ('crowd', 'Local Crew Only', 'Mostly locals who know each other. Respectful atmosphere if you follow lineup etiquette.', '{"crowd_type": "locals", "vibe": "respectful", "etiquette_required": true}'::jsonb),
    
    -- Hazards and safety
    ('hazard', 'Rocks at Low Tide', 'Watch out for exposed rocks on the inside at low tide. Fins have met their doom here.', '{"hazard_type": "rocks", "tide_dependent": true, "severity": "moderate"}'::jsonb),
    ('hazard', 'Strong Current Today', 'Rip current running pretty strong on the north side. Keep it in mind if you''re not a strong swimmer.', '{"hazard_type": "current", "location": "north_side", "severity": "high"}'::jsonb),
    ('hazard', 'Jellyfish Spotted', 'Saw a few jellyfish in the water this morning. Nothing too serious but heads up.', '{"hazard_type": "marine_life", "severity": "low", "species": "jellyfish"}'::jsonb),
    ('hazard', 'Sharp Reef Break', 'Shallow reef here - not for beginners. Know your limits and wear booties if you have them.', '{"hazard_type": "reef", "depth": "shallow", "protection_recommended": "booties"}'::jsonb),
    
    -- General tips and other info
    ('other', 'Best at Mid-Tide', 'This spot really comes alive at mid-incoming tide. Too shallow at low, too deep at high.', '{"optimal_tide": "mid_incoming", "tide_sensitivity": "high"}'::jsonb),
    ('other', 'Dawn Patrol Recommended', 'Wind usually picks up by 10am. Get here early for the best conditions.', '{"optimal_time": "dawn", "wind_pattern": "increases_morning"}'::jsonb),
    ('other', 'Beginner Friendly Inside', 'Advanced surfers go for the outside peak, beginners stay on the inside reform. Works well for everyone.', '{"skill_zones": {"inside": "beginner", "outside": "advanced"}, "wave_sharing": true}'::jsonb),
    ('other', 'Bring Cash for Tacos', 'Amazing fish taco truck in the parking lot. Cash only but totally worth it post-session.', '{"amenity": "food_truck", "type": "tacos", "payment": "cash_only"}'::jsonb)
) AS tag_data(tag, title, description, surf_conditions)
WHERE RANDOM() < 0.4; -- Only create posts for ~40% of beach/tag combinations to keep realistic

-- Create some confirmations for the intel posts
WITH recent_posts AS (
    SELECT ip.id as post_id, ip.user_id as original_user_id
    FROM public.intel_posts ip
    WHERE ip.created_at > NOW() - INTERVAL '7 days'
),
potential_confirmers AS (
    SELECT p.id as user_id
    FROM public.profiles p
    WHERE p.full_name LIKE '% %'
)
INSERT INTO public.intel_post_confirmations (intel_post_id, user_id, created_at)
SELECT DISTINCT
    rp.post_id,
    pc.user_id,
    NOW() - INTERVAL '1 hour' * FLOOR(RANDOM() * 168) -- Random time in last week
FROM recent_posts rp
CROSS JOIN potential_confirmers pc
WHERE rp.original_user_id != pc.user_id -- Don't confirm own posts
  AND RANDOM() < 0.3; -- 30% chance to confirm each post

COMMIT;