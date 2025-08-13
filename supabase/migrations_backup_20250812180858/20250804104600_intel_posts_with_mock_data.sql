-- Intel Posts Migration
-- Adds support for Local Intel Club feature

-- Create intel post tag enum
CREATE TYPE intel_post_tag AS ENUM ('parking', 'hazard', 'crowd', 'conditions', 'access', 'other');

-- Create intel_posts table
CREATE TABLE intel_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    tag intel_post_tag NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    photo_storage_path TEXT,
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intel_post_confirmations table
CREATE TABLE intel_post_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_post_id UUID NOT NULL REFERENCES intel_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(intel_post_id, user_id)
);

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_posts_location_idx ON public.intel_posts USING GIST (
      ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_posts_user_id_idx ON public.intel_posts(user_id);
    CREATE INDEX IF NOT EXISTS intel_posts_tag_idx ON public.intel_posts(tag);
    CREATE INDEX IF NOT EXISTS intel_posts_created_at_idx ON public.intel_posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS intel_posts_is_active_idx ON public.intel_posts(is_active);
  END IF;
  IF to_regclass('public.intel_post_confirmations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_post_confirmations_post_id_idx ON public.intel_post_confirmations(intel_post_id);
    CREATE INDEX IF NOT EXISTS intel_post_confirmations_user_id_idx ON public.intel_post_confirmations(user_id);
  END IF;
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_intel_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intel_posts_updated_at_trigger
    BEFORE UPDATE ON intel_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_intel_posts_updated_at();

-- Create trigger to update confirmations count
CREATE OR REPLACE FUNCTION update_intel_post_confirmations_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE intel_posts 
        SET confirmations_count = confirmations_count + 1 
        WHERE id = NEW.intel_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE intel_posts 
        SET confirmations_count = confirmations_count - 1 
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intel_post_confirmations_count_trigger
    AFTER INSERT OR DELETE ON intel_post_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_intel_post_confirmations_count();

-- Row Level Security
ALTER TABLE intel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_post_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for intel_posts
CREATE POLICY "Anyone can view active intel posts" ON intel_posts
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can insert their own intel posts" ON intel_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intel posts" ON intel_posts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intel posts" ON intel_posts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for intel_post_confirmations
CREATE POLICY "Anyone can view intel post confirmations" ON intel_post_confirmations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own confirmations" ON intel_post_confirmations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own confirmations" ON intel_post_confirmations
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to get nearby intel posts
CREATE OR REPLACE FUNCTION get_nearby_intel_posts(
    center_lat DECIMAL,
    center_lng DECIMAL,
    radius_miles DECIMAL DEFAULT 5,
    tag_filter intel_post_tag DEFAULT NULL,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    latitude DECIMAL,
    longitude DECIMAL,
    tag intel_post_tag,
    title TEXT,
    description TEXT,
    photo_url TEXT,
    photo_storage_path TEXT,
    confirmations_count INTEGER,
    is_active BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    distance_miles DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.latitude,
        p.longitude,
        p.tag,
        p.title,
        p.description,
        p.photo_url,
        p.photo_storage_path,
        p.confirmations_count,
        p.is_active,
        p.expires_at,
        p.created_at,
        p.updated_at,
        ROUND(
            (ST_Distance(
                ST_Point(center_lng, center_lat)::geography,
                ST_Point(p.longitude, p.latitude)::geography
            ) / 1609.344)::DECIMAL, 2
        ) AS distance_miles
    FROM intel_posts p
    WHERE 
        p.is_active = true
        AND (p.expires_at IS NULL OR p.expires_at > now())
        AND (tag_filter IS NULL OR p.tag = tag_filter)
        AND ST_DWithin(
            ST_Point(center_lng, center_lat)::geography,
            ST_Point(p.longitude, p.latitude)::geography,
            radius_miles * 1609.344
        )
    ORDER BY distance_miles ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_nearby_intel_posts TO authenticated;

COMMENT ON TABLE intel_posts IS 'Local Intel Club posts for surf conditions, hazards, parking, and crowd information';
COMMENT ON TABLE intel_post_confirmations IS 'User confirmations for intel posts to track accuracy';
COMMENT ON FUNCTION get_nearby_intel_posts IS 'Returns intel posts within a specified radius of a location';

-- ================================================
-- Mock Intel Data for Ocean Beach & La Jolla Shores
-- ================================================
-- Creates realistic intel posts to make the Local Intel feature look lively
-- Uses existing test users from the comprehensive mock data

DO $$
DECLARE
    -- Existing user IDs from comprehensive mock data
    liquid_snake_id UUID := '23233d36-97f9-4322-8b36-113c880b841f'::UUID;
    big_boss_id UUID := '16b87cb1-34b6-434d-820c-0bc4e0927f5b'::UUID;
    solid_snake_id UUID := '638edbd2-7fd3-49b5-8129-84456764df4c'::UUID;
    rookie_riley_id UUID := '05f3d22c-a282-4252-bb54-64dcb74a83dd'::UUID;
    local_larry_id UUID := '382c284f-e36d-43cd-8e44-0930544db459'::UUID;
    travel_tina_id UUID := '701beae0-96aa-43d4-a29a-4353ead6ea24'::UUID;
    photo_paul_id UUID := '31d78eb7-357e-444e-88cd-d728ebf4f1ae'::UUID;
    dawn_dana_id UUID := '3958e9bb-acf8-45a1-ab20-7953ec1cb0e7'::UUID;
    
    -- Coordinates for our focus beaches
    -- Ocean Beach: 32.7507, -117.254
    -- La Jolla Shores: 32.8507, -117.2726
    
BEGIN
    -- Skip mock data if required users do not exist
    IF (
      SELECT COUNT(*) FROM auth.users 
      WHERE id IN (liquid_snake_id, big_boss_id, solid_snake_id, rookie_riley_id, local_larry_id, travel_tina_id, photo_paul_id, dawn_dana_id)
    ) < 8 THEN
      RAISE NOTICE 'Skipping intel mock data insertion: required auth.users not found';
      RETURN;
    END IF;
    RAISE NOTICE 'Creating mock intel data for Ocean Beach and La Jolla Shores...';
    
    -- Ocean Beach Intel Posts (20+ posts)
    INSERT INTO intel_posts (user_id, latitude, longitude, tag, title, description, confirmations_count, is_active, expires_at, created_at) VALUES
    
    -- Recent conditions (last few hours)
    (local_larry_id, 32.7507, -117.254, 'conditions', 'OB Pumping Right Now!', 'Solid 4-5ft with clean faces. Offshore winds grooming it perfectly. Get out here before the afternoon wind kicks in. Best I''ve seen it all week!', 12, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '45 minutes'),
    (dawn_dana_id, 32.7510, -117.2543, 'conditions', 'Dawn Patrol at OB Was Epic', 'Had it almost to myself at sunrise. Clean 3-4ft waves with light offshore. Perfect for getting some long rides before work. Water temp feels like 64-65°F.', 8, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '3 hours'),
    (photo_paul_id, 32.7505, -117.2538, 'conditions', 'Great Light for Photos at OB', 'Beautiful golden hour lighting hitting the waves perfectly. Waves are manageable 2-3ft, perfect for capturing some action shots. Lots of stoked surfers out there!', 5, true, NOW() + INTERVAL '1 hour', NOW() - INTERVAL '2 hours'),
    
    -- Parking updates (very important for OB!)
    (travel_tina_id, 32.7507, -117.254, 'parking', 'OB Parking Nightmare Today', 'Every spot from Newport to Saratoga is taken. Had to park 4 blocks away. Street sweeping must have been this morning. Try the side streets near Dog Beach if desperate.', 15, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '1 hour'),
    (rookie_riley_id, 32.7512, -117.2545, 'parking', 'Found Parking on Orchard!', 'Just scored a spot on Orchard St near the fire station. About a 3-minute walk to the beach. Still some spots available as of 10 minutes ago!', 7, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '20 minutes'),
    (big_boss_id, 32.7504, -117.2535, 'parking', 'OB Pier Lot Has Space', 'Surprisingly the pier parking lot still has spots. $2/hour but beats circling for 30 minutes. Plus you''re right at the action near the pier break.', 9, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '1.5 hours'),
    (solid_snake_id, 32.7515, -117.2548, 'parking', 'Tactical Parking Intel', 'Observed multiple vacant spaces on Cornish Drive. Optimal positioning for rapid beach deployment. Meter enforcement appears minimal during early morning hours. Mission success.', 3, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '2 hours'),
    
    -- Crowd reports
    (local_larry_id, 32.7506, -117.2540, 'crowd', 'OB Getting Crowded Fast', 'Was mellow at 7am but now it''s getting zoo-like. About 30 people out at the main break. If you want space, head north toward Dog Beach or south toward the jetty.', 11, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '1 hour'),
    (travel_tina_id, 32.7508, -117.2542, 'crowd', 'Aggressive Vibes at OB Today', 'Some dude was being super territorial about "his" waves. Not the usual OB vibe. Most people are cool but there''s always one person who ruins it for everyone.', 6, true, NOW() + INTERVAL '8 hours', NOW() - INTERVAL '3 hours'),
    (dawn_dana_id, 32.7511, -117.2546, 'crowd', 'OB Surprisingly Mellow', 'Maybe because it''s a Tuesday but only about 10 people out. Super friendly vibe, everyone sharing waves and cheering each other on. This is why I love OB!', 13, true, NOW() + INTERVAL '5 hours', NOW() - INTERVAL '4 hours'),
    
    -- Hazards and safety
    (photo_paul_id, 32.7503, -117.2537, 'hazard', 'Watch the Rocks at OB South', 'Tide is super low and the rocks near the jetty are barely covered. Saw someone''s fin get chomped. Stay away from the south end unless you know exactly where you''re going.', 8, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
    (liquid_snake_id, 32.7509, -117.2544, 'hazard', 'Strong Rip Current at OB', 'Powerful northward rip near the main break. Perfect for getting out but be aware of inexperienced surfers getting swept. Use tactical knowledge to your advantage.', 10, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '1 hour'),
    (rookie_riley_id, 32.7507, -117.254, 'hazard', 'Lots of Beginners Today - Heads Up!', 'Surf school has like 20 students out there. Everyone please be patient and help keep them safe. We were all beginners once! Watch for runaway boards.', 12, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '2 hours'),
    
    -- Access and other info
    (big_boss_id, 32.7514, -117.2547, 'access', 'OB Beach Access Update', 'Main beach entrance near the pier is clear. Stairs and ramp are in good condition. Saw maintenance fixing the handrail this morning. No issues getting gear down.', 4, true, NOW() + INTERVAL '1 week', NOW() - INTERVAL '5 hours'),
    (travel_tina_id, 32.7505, -117.2539, 'other', 'Great Coffee at OB', 'Just discovered Black Cat Coffee on Bacon St. Amazing breakfast burritos and they open at 6am! Perfect post-dawn patrol fuel. Plus they validate parking at the lot next door.', 9, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '4 hours'),
    (local_larry_id, 32.7513, -117.2549, 'other', 'OB Cleanup This Weekend', 'Surfrider is doing a beach cleanup Saturday at 8am. Meet at the lifeguard tower. Free t-shirt and coffee for volunteers. Let''s keep our break clean!', 16, true, NOW() + INTERVAL '3 days', NOW() - INTERVAL '6 hours'),
    
    -- Older posts (last few days)
    (dawn_dana_id, 32.7508, -117.2541, 'conditions', 'Yesterday''s Sunset Session', 'Had an amazing glass-off session yesterday evening. 3ft clean waves with nobody out. Sometimes the best sessions happen when you least expect them!', 7, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    (solid_snake_id, 32.7506, -117.2540, 'parking', 'Weekend Parking Surveillance', 'Conducted weekend reconnaissance. Peak congestion occurs 0800-1000 hours. Alternative staging areas located on residential streets. Mission parameters: arrive before 0730 for optimal results.', 2, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (photo_paul_id, 32.7512, -117.2545, 'conditions', 'Great Week at OB', 'We''ve had consistent waves all week thanks to that south swell. Not huge but super fun and playful. Perfect for working on your turns and getting lots of waves.', 11, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 days'),
    (rookie_riley_id, 32.7504, -117.2538, 'other', 'Made New Friends at OB!', 'The surf community here is so welcoming! Got some great tips from locals and even got invited to a beach BBQ. This is what surfing is all about - the people!', 14, true, NOW() + INTERVAL '5 days', NOW() - INTERVAL '4 days'),
    
    -- La Jolla Shores Intel Posts (20+ posts)
    
    -- Recent conditions
    (photo_paul_id, 32.8507, -117.2726, 'conditions', 'LJ Shores Perfect for Beginners', 'Super gentle 1-2ft waves with crystal clear water. Perfect learning conditions. Saw some leopard sharks cruising around - totally harmless but so cool to see!', 18, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '1 hour'),
    (travel_tina_id, 32.8510, -117.2728, 'conditions', 'Glassy Conditions at Shores', 'No wind at all this morning. Water is like a mirror between sets. Perfect for SUP or longboarding. Visibility is incredible - can see the bottom in 10+ feet of water.', 12, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
    (dawn_dana_id, 32.8505, -117.2724, 'conditions', 'Sunrise Magic at Shores', 'Got here at 6am and had the most peaceful session. Small waves but perfect for soul surfing. Watched dolphins playing in the waves - doesn''t get better than this!', 15, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '3 hours'),
    (local_larry_id, 32.8508, -117.2727, 'conditions', 'Shores Picking Up Size', 'Getting some nice 2-3ft sets now. Still super mellow and perfect for all skill levels. Water temp is amazing - probably 66-67°F. Could surf in boardshorts if you wanted.', 9, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '1.5 hours'),
    
    -- Parking (always important!)
    (big_boss_id, 32.8507, -117.2726, 'parking', 'Shores Parking Lot Full', 'Main lot is completely packed by 9am. Try the overflow lot up the hill or street parking on La Jolla Shores Dr. It''s a bit of a walk but beats driving in circles.', 13, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '45 minutes'),
    (rookie_riley_id, 32.8512, -117.2730, 'parking', 'Found Street Parking!', 'Just found a spot on Calle Frescota. Free parking and only a 2-minute walk to the water. Some spots still available but filling up fast!', 6, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '30 minutes'),
    (travel_tina_id, 32.8509, -117.2729, 'parking', 'Meter Tips for Shores', 'Parking meters now take credit cards which is super convenient. $2/hour but you can pay for up to 4 hours. Way better than hunting for quarters!', 8, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '2 hours'),
    (solid_snake_id, 32.8506, -117.2725, 'parking', 'Optimal Parking Strategy', 'Secondary parking zone identified on residential streets. Minimal enforcement observed during early hours. Recommend arriving before 0800 for primary lot access. Mission planning essential.', 3, true, NOW() + INTERVAL '5 hours', NOW() - INTERVAL '3 hours'),
    
    -- Crowd reports
    (local_larry_id, 32.8511, -117.2731, 'crowd', 'Shores Getting Busy', 'Typical weekend scene - lots of families and surf schools. Still plenty of room for everyone but be extra careful of beginners and kids. Everyone''s having fun though!', 11, true, NOW() + INTERVAL '3 hours', NOW() - INTERVAL '1 hour'),
    (photo_paul_id, 32.8508, -117.2727, 'crowd', 'Great Photo Ops at Shores', 'So many happy families and kids learning to surf. Perfect conditions for capturing those first wave moments. Parents are stoked and kids are having a blast!', 7, true, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
    (dawn_dana_id, 32.8504, -117.2723, 'crowd', 'Early Bird Gets the Waves', 'Had Shores almost to myself until 8am. Then the morning crowd started showing up. If you want peaceful conditions, dawn patrol is definitely the way to go here.', 10, true, NOW() + INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
    
    -- Wildlife and hazards (mostly positive at Shores!)
    (travel_tina_id, 32.8509, -117.2728, 'other', 'Leopard Sharks at Shores!', 'Saw a bunch of leopard sharks in the shallows today! Totally harmless and actually really cool to see. They''re just cruising around minding their own business. Nature is amazing!', 22, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 hour'),
    (rookie_riley_id, 32.8507, -117.2726, 'other', 'Dolphins Playing at Shores!', 'OMG! A pod of dolphins came through during my session and were literally surfing the waves with us! One of the most magical experiences of my life. I''m still shaking with excitement!', 28, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '3 hours'),
    (photo_paul_id, 32.8510, -117.2729, 'hazard', 'Watch for Rays in Shallow Water', 'Lots of stingrays in the shallows today. Do the stingray shuffle when walking in! They''re not aggressive but nobody wants to step on one. Better safe than sorry!', 16, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
    (big_boss_id, 32.8505, -117.2724, 'hazard', 'Strong Currents on North End', 'Noticed some stronger currents on the north side near the marine protected area. Not dangerous but be aware if you''re not a strong swimmer. Stick to the main beach area if unsure.', 8, true, NOW() + INTERVAL '8 hours', NOW() - INTERVAL '1 hour'),
    
    -- Access and amenities
    (local_larry_id, 32.8512, -117.2730, 'access', 'Beach Access is Perfect', 'Easy walk from parking to the water. Nice wide beach with lots of space to set up. Bathrooms and showers are clean and convenient. Shores really has it all figured out.', 5, true, NOW() + INTERVAL '1 week', NOW() - INTERVAL '5 hours'),
    (travel_tina_id, 32.8506, -117.2725, 'other', 'Great Food Options Near Shores', 'The Taco Stand is amazing for post-surf fuel. Fresh fish tacos and they open early. Plus there''s a coffee cart in the parking lot with surprisingly good coffee!', 14, true, NOW() + INTERVAL '3 days', NOW() - INTERVAL '6 hours'),
    (dawn_dana_id, 32.8508, -117.2727, 'other', 'Yoga on the Beach', 'There''s a beach yoga class every Tuesday and Thursday at 7am. Super peaceful way to stretch out after a dawn patrol session. All skill levels welcome!', 9, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    
    -- Conditions updates from past few days
    (solid_snake_id, 32.8507, -117.2726, 'conditions', 'Tactical Assessment: Shores Optimal', 'Consistent small wave conditions ideal for training operations. Minimal hazards identified. Water clarity excellent for surveillance activities. Recommend for low-intensity aquatic missions.', 4, true, NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 days'),
    (liquid_snake_id, 32.8511, -117.2731, 'conditions', 'Shores Tactical Advantage', 'Perfect training ground for developing superior surfing techniques. Gentle waves allow for precision maneuver practice. Ideal for demonstrating dominance over inferior surfers.', 1, true, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '3 days'),
    (photo_paul_id, 32.8509, -117.2728, 'conditions', 'Consistent Week at Shores', 'What a great week of surf! Small but clean waves every day. Perfect for working on your technique or just having fun. The water has been so clear you can see everything!', 12, true, NOW() + INTERVAL '2 days', NOW() - INTERVAL '4 days'),
    (rookie_riley_id, 32.8504, -117.2723, 'other', 'Surf Lesson Success!', 'Finally stood up for more than 3 seconds! The instructors at Shores are amazing and so patient. This place is perfect for learning - soft waves and sandy bottom everywhere.', 17, true, NOW() + INTERVAL '5 days', NOW() - INTERVAL '5 days')
    
    ON CONFLICT DO NOTHING;
    
    -- Create realistic confirmations for the new posts
    INSERT INTO intel_post_confirmations (intel_post_id, user_id, created_at) VALUES
    
    -- Confirm the most useful/accurate posts
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'conditions' AND title LIKE '%OB Pumping%' LIMIT 1), travel_tina_id, NOW() - INTERVAL '30 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'conditions' AND title LIKE '%OB Pumping%' LIMIT 1), photo_paul_id, NOW() - INTERVAL '20 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'conditions' AND title LIKE '%OB Pumping%' LIMIT 1), dawn_dana_id, NOW() - INTERVAL '10 minutes'),
    
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'parking' AND title LIKE '%Parking Nightmare%' LIMIT 1), local_larry_id, NOW() - INTERVAL '45 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'parking' AND title LIKE '%Parking Nightmare%' LIMIT 1), rookie_riley_id, NOW() - INTERVAL '35 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'parking' AND title LIKE '%Parking Nightmare%' LIMIT 1), big_boss_id, NOW() - INTERVAL '25 minutes'),
    
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'other' AND title LIKE '%Leopard Sharks%' LIMIT 1), local_larry_id, NOW() - INTERVAL '40 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'other' AND title LIKE '%Leopard Sharks%' LIMIT 1), dawn_dana_id, NOW() - INTERVAL '30 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'other' AND title LIKE '%Leopard Sharks%' LIMIT 1), photo_paul_id, NOW() - INTERVAL '20 minutes'),
    
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'other' AND title LIKE '%Dolphins%' LIMIT 1), travel_tina_id, NOW() - INTERVAL '2 hours'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'other' AND title LIKE '%Dolphins%' LIMIT 1), local_larry_id, NOW() - INTERVAL '1.5 hours'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'other' AND title LIKE '%Dolphins%' LIMIT 1), big_boss_id, NOW() - INTERVAL '1 hour'),
    
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'conditions' AND title LIKE '%Perfect for Beginners%' LIMIT 1), rookie_riley_id, NOW() - INTERVAL '50 minutes'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'conditions' AND title LIKE '%Perfect for Beginners%' LIMIT 1), dawn_dana_id, NOW() - INTERVAL '40 minutes'),
    
    -- Cross-confirmations (users confirming each other's posts)
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'crowd' AND user_id = local_larry_id LIMIT 1), travel_tina_id, NOW() - INTERVAL '1 hour'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.7500 AND 32.7520 AND tag = 'hazard' AND user_id = photo_paul_id LIMIT 1), solid_snake_id, NOW() - INTERVAL '1.5 hours'),
    ((SELECT id FROM intel_posts WHERE latitude BETWEEN 32.8500 AND 32.8520 AND tag = 'parking' AND user_id = big_boss_id LIMIT 1), rookie_riley_id, NOW() - INTERVAL '30 minutes')
    
    ON CONFLICT (intel_post_id, user_id) DO NOTHING;
    
    -- Update confirmation counts to match the actual confirmations
    UPDATE intel_posts SET confirmations_count = (
        SELECT COUNT(*) FROM intel_post_confirmations 
        WHERE intel_post_confirmations.intel_post_id = intel_posts.id
    ) WHERE latitude BETWEEN 32.7500 AND 32.8520;
    
    RAISE NOTICE 'Created 40+ intel posts for Ocean Beach and La Jolla Shores with realistic confirmations';
    RAISE NOTICE 'Posts include: conditions, parking, crowds, hazards, access, and other local intel';
    RAISE NOTICE 'Mix of recent (last few hours) and older posts (last few days) for realistic timeline';
    
END $$; 