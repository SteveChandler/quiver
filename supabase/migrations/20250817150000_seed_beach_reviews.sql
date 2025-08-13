-- Seed comprehensive beach reviews with realistic ratings and experiences
-- Creates detailed reviews covering different aspects of each beach

BEGIN;

-- Create beach reviews with varied experiences and ratings
WITH beach_reviewers AS (
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
INSERT INTO public.beach_reviews (
    beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating, 
    parking_rating, accessibility_rating, title, content, visit_date, helpful_count, created_at
)
SELECT 
    br.beach_id,
    (br.user_ids)[FLOOR(RANDOM() * array_length(br.user_ids, 1)) + 1] as user_id,
    review_data.overall_rating,
    review_data.wave_quality_rating,
    review_data.crowd_density_rating,
    review_data.parking_rating,
    review_data.accessibility_rating,
    review_data.title,
    review_data.content,
    CURRENT_DATE - INTERVAL '1 day' * FLOOR(RANDOM() * 365), -- Random date in last year
    FLOOR(RANDOM() * 25)::INTEGER, -- 0-25 helpful votes
    NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 180) -- Created in last 6 months
FROM beach_reviewers br
CROSS JOIN (
    VALUES 
    -- Excellent overall experiences (4-5 stars)
    (5, 5, 4, 3, 5, 'Perfect Dawn Session Paradise', 
     'This spot is absolutely magical at sunrise. Consistent waves, clean water, and easy access make it my go-to beach. The only downside is parking can be tricky on weekends, but the early bird gets the best waves and spots! Wave quality is consistently excellent with multiple peaks to choose from. Local vibe is friendly and welcoming.'),
    
    (5, 4, 3, 4, 4, 'Hidden Gem Worth the Drive', 
     'Discovered this place through a friend and wow! The wave quality is outstanding on the right swell. Not too crowded which is rare these days. Parking is decent with a short walk to the beach. Great for intermediate to advanced surfers. The reef break produces some really fun walls when it''s working.'),
    
    (4, 5, 2, 5, 3, 'World-Class Waves, Gnarly Access', 
     'The waves here are absolutely incredible - some of the best I''ve surfed on the coast. However, getting down to the beach is no joke. Steep, rocky trail that requires careful navigation with a board. Not for beginners or anyone with mobility issues. But if you can make it down, you''re in for a treat.'),
    
    (4, 4, 4, 4, 4, 'Solid All-Around Beach Break', 
     'Really consistent spot that works in a variety of conditions. Great for progressing your surfing as it offers both mellow inside waves and more challenging outside sets. Facilities are good, parking is reasonable, and the local crew is welcoming. Perfect for a regular surf routine.'),
    
    -- Good experiences (3-4 stars)
    (4, 3, 4, 2, 3, 'Great Waves, Terrible Parking', 
     'The surf here can be really good, especially on the right tide and swell combo. Unfortunately, parking is a nightmare. Limited spots that fill up fast, and expensive meters everywhere. If you can sort out the parking situation, the waves make it worth it. Best at mid to high tide.'),
    
    (3, 4, 2, 3, 4, 'Quality Waves, Heavy Locals', 
     'Wave quality is definitely above average with some really fun sections. However, the local crew can be pretty territorial. Respect the lineup and you''ll be fine, but don''t expect to get the best waves on your first visit. Parking and access are straightforward which is nice.'),
    
    (4, 3, 3, 4, 5, 'Perfect for Learning', 
     'This is hands down the best beginner beach in the area. Gentle, forgiving waves with a sandy bottom. Easy access right from the parking lot. Can get pretty crowded with surf schools, but that''s because it''s such a great learning environment. Lifeguards on duty which adds safety.'),
    
    (3, 4, 3, 2, 2, 'Good Surf, Challenging Everything Else', 
     'When this place is working, the waves are fantastic. Long, peeling rights that go on forever. The problem is everything else - parking is expensive and limited, the walk to the beach is long, and the currents can be tricky. Come prepared and it''s worth it.'),
    
    -- Average experiences (2-3 stars)  
    (3, 2, 4, 3, 4, 'Hit or Miss Conditions', 
     'This spot can be really fun on its day, but it''s pretty fickle. Needs the right combination of swell, wind, and tide to work properly. When it''s off, it''s really off. The crowd is usually pretty mellow since it''s not consistent. Good backup option when other spots are too crowded.'),
    
    (2, 3, 2, 4, 3, 'Overcrowded Tourist Trap', 
     'Used to be a great spot before it got discovered. Now it''s packed with beginners and tourists who don''t know lineup etiquette. The waves are still decent, and parking/access are good, but the experience is often frustrating. Better early in the morning or late afternoon.'),
    
    (3, 2, 3, 1, 2, 'Mediocre Waves, Worse Parking', 
     'Pretty average surf spot that''s really only worth it if you live nearby. Waves are small and mushy most of the time. Parking situation is awful - expensive and you often have to walk forever. There are definitely better options in the area unless this is super convenient for you.'),
    
    -- Below average experiences (1-2 stars)
    (2, 1, 4, 2, 3, 'Only Good for SUP', 
     'Really disappointing surf here. Waves are tiny and have no power. Might be okay for stand-up paddleboarding or absolute beginners, but anyone with experience will be bored. The one positive is that it''s not crowded, probably because the waves are so lackluster.'),
    
    (2, 2, 1, 3, 4, 'Blown Out Constantly', 
     'This spot seems to be blown out by wind every time I check it. The few times I''ve surfed it when clean, the waves were mediocre at best. Easy access and okay parking, but what''s the point if the surf is consistently poor? Maybe it''s good at some specific time I haven''t figured out.'),
    
    (1, 2, 2, 1, 1, 'Avoid This Place', 
     'Honestly not sure why this spot is even recommended. Waves are consistently small and mushy. Parking is a nightmare and expensive. The walk to the beach is unnecessarily difficult. Crowds are aggressive despite the poor wave quality. There are so many better options nearby.')
    
) AS review_data(overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating, title, content)
WHERE RANDOM() < 0.25; -- Create reviews for ~25% of potential beach/user combinations

-- Create some additional detailed reviews for specific personas
INSERT INTO public.beach_reviews (
    beach_id, user_id, overall_rating, wave_quality_rating, crowd_density_rating, 
    parking_rating, accessibility_rating, title, content, visit_date, helpful_count, created_at
)
SELECT 
    b.id as beach_id,
    p.id as user_id,
    CASE 
        WHEN p.full_name LIKE '%Rookie%' THEN 4 -- Beginners love beginner spots
        WHEN p.full_name LIKE '%Expert%' OR p.full_name LIKE '%Boss%' THEN FLOOR(RANDOM() * 2 + 4) -- Experts are pickier
        ELSE FLOOR(RANDOM() * 3 + 2) -- Others give mixed reviews
    END,
    CASE 
        WHEN p.full_name LIKE '%Rookie%' THEN FLOOR(RANDOM() * 2 + 3) -- Beginners rate quality lower
        WHEN p.full_name LIKE '%Hawaii%' THEN FLOOR(RANDOM() * 2 + 4) -- Hawaii expert has high standards  
        ELSE FLOOR(RANDOM() * 4 + 2)
    END,
    FLOOR(RANDOM() * 4 + 2), -- Random crowd rating
    FLOOR(RANDOM() * 4 + 2), -- Random parking rating  
    FLOOR(RANDOM() * 4 + 2), -- Random accessibility rating
    CASE 
        WHEN p.full_name LIKE '%Rookie%' THEN 'Great for Learning!'
        WHEN p.full_name LIKE '%Local%' THEN 'Local''s Perspective'
        WHEN p.full_name LIKE '%Travel%' THEN 'Visitor Review'
        WHEN p.full_name LIKE '%PhotoPro%' THEN 'Photographer''s Take'
        WHEN p.full_name LIKE '%Dawn%' THEN 'Dawn Patrol Report'
        WHEN p.full_name LIKE '%Weather%' THEN 'Meteorologist''s Analysis'
        WHEN p.full_name LIKE '%Safety%' THEN 'Safety Assessment'
        ELSE 'Honest Review'
    END,
    CASE 
        WHEN p.full_name LIKE '%Rookie%' THEN 
            'As someone new to surfing, this spot has been perfect for building my confidence. The waves are forgiving and the crowd is generally helpful with tips. I''ve seen so much improvement in my surfing coming here regularly.'
        WHEN p.full_name LIKE '%Local%' THEN 
            'Been surfing this break for over a decade. It''s got character and rewards those who take time to understand its moods. Not the most consistent, but when it''s on, it''s really on. Respect the locals and you''ll have a good time.'
        WHEN p.full_name LIKE '%Travel%' THEN 
            'Stumbled upon this spot during my travels and was pleasantly surprised. Different from what I''m used to back home, but the local style is fun to adapt to. Good addition to any surf trip itinerary.'
        WHEN p.full_name LIKE '%PhotoPro%' THEN 
            'From a visual perspective, this break offers some incredible shooting opportunities. The way the waves break against the backdrop makes for stunning shots. Surfing-wise, it''s solid too with some photogenic barrels on bigger days.'
        WHEN p.full_name LIKE '%Dawn%' THEN 
            'This spot really shines in the early morning hours. Glass-off conditions are common, and you''ll often have it to yourself until the crowds arrive. Perfect for those willing to set the early alarm.'
        WHEN p.full_name LIKE '%Weather%' THEN 
            'From a meteorological standpoint, this break is interesting because it''s very sensitive to wind direction changes. The morning offshore pattern creates optimal conditions, but you need to time it right with the swell direction.'
        WHEN p.full_name LIKE '%Safety%' THEN 
            'Safety-wise, this is a relatively low-risk beach with good visibility and manageable currents. Recommend booties due to some rocky areas. Always good to have a buddy system, especially on bigger days.'
        ELSE 
            'Solid spot that delivers consistent fun. Good range of wave sizes means there''s usually something for everyone. Facilities are decent and the vibe is generally positive.'
    END,
    CURRENT_DATE - INTERVAL '1 day' * FLOOR(RANDOM() * 90), -- Last 3 months
    FLOOR(RANDOM() * 15 + 5)::INTEGER, -- 5-20 helpful votes  
    NOW() - INTERVAL '1 day' * FLOOR(RANDOM() * 90)
FROM public.beaches b
CROSS JOIN public.profiles p
WHERE p.full_name LIKE '% %'
  AND RANDOM() < 0.15 -- Create specific persona reviews for ~15% of combinations
LIMIT 50; -- Cap at 50 additional reviews

-- Create some review likes for the helpful count
INSERT INTO public.beach_review_likes (review_id, user_id, created_at)
SELECT 
    br.id as review_id,
    p.id as user_id,
    NOW() - INTERVAL '1 hour' * FLOOR(RANDOM() * 24 * 30) -- Random time in last month
FROM public.beach_reviews br
CROSS JOIN public.profiles p
WHERE p.full_name LIKE '% %'
  AND br.user_id != p.id -- Don't like own reviews
  AND RANDOM() < 0.4 -- 40% chance to like each review
ON CONFLICT (review_id, user_id) DO NOTHING; -- Handle duplicate likes gracefully

COMMIT;