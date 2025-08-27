-- Rollback for 20250826000002_add_safe_mock_users.sql
-- SAFE: This rollback only removes the specific mock users that were added
-- It does NOT affect any other users or existing data

BEGIN;

-- Remove boards belonging to the safe mock users
DELETE FROM public.boards b USING public.profiles p
WHERE b.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove beach review likes from these mock users
DELETE FROM public.beach_review_likes l USING public.beach_reviews r, public.profiles p
WHERE l.review_id = r.id AND r.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove beach reviews from these mock users
DELETE FROM public.beach_reviews r USING public.profiles p
WHERE r.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove intel post confirmations from these mock users
DELETE FROM public.intel_post_confirmations c USING public.intel_posts ip, public.profiles p
WHERE c.intel_post_id = ip.id AND ip.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove intel posts from these mock users
DELETE FROM public.intel_posts ip USING public.profiles p
WHERE ip.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove user activities from these mock users (if the table exists)
DELETE FROM public.user_activities ua USING public.profiles p
WHERE ua.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove user follows relationships (follower and following) from these mock users
DELETE FROM public.user_follows uf USING public.profiles p
WHERE (uf.follower_id = p.id OR uf.following_id = p.id) AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove sessions from these mock users (if they exist)
DELETE FROM public.sessions s USING public.profiles p
WHERE s.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- Remove favorite beaches from these mock users (if they exist)
DELETE FROM public.favorite_beaches fb USING public.profiles p
WHERE fb.user_id = p.id AND p.full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

-- SAFE: Finally, remove only the specific mock user profiles that were added
DELETE FROM public.profiles 
WHERE full_name IN (
    'Alex "Goofy" Thompson', 'Maria "Barrel" Santos', 'Josh "Early Bird" Kim', 
    'Sarah "Longboard" Mitchell', 'Chris "Shortboard" Rodriguez', 'Emma "SUP" Foster',
    'Tyler "Kook" Anderson', 'Jessica "Pro" Chen', 'Mike "Veteran" Johnson',
    'Luna "Sunrise" Martinez', 'Kai "Pipeline" Wilson', 'Zoe "Beginner" Davis',
    'Sam "Instructor" Brown', 'Maya "Photographer" Patel', 'Noah "Forecaster" Garcia',
    'Aria "Shaper" Lewis', 'River "Free" Walker', 'Sage "Eco" Green',
    'Phoenix "Competition" Reed', 'Storm "Big Wave" Cole'
);

COMMIT;