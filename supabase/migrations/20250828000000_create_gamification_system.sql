-- Gamification System Migration
-- Creates tables for XP tracking, badges, and user achievements

-- Create user_xp table for tracking user experience points and levels
CREATE TABLE IF NOT EXISTS public.user_xp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    xp_total INTEGER NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 9),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create badge_definitions table for static badge metadata
CREATE TABLE IF NOT EXISTS public.badge_definitions (
    badge_slug TEXT PRIMARY KEY CHECK (badge_slug ~ '^[a-z][a-z0-9_]*[a-z0-9]$'),
    name TEXT NOT NULL CHECK (LENGTH(name) <= 100),
    description TEXT NOT NULL CHECK (LENGTH(description) <= 500),
    icon TEXT NOT NULL CHECK (LENGTH(icon) <= 50),
    category TEXT NOT NULL CHECK (category IN ('global', 'journal', 'quiver')),
    xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_badges table for tracking earned badges per user
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_slug TEXT NOT NULL REFERENCES public.badge_definitions(badge_slug) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context JSONB DEFAULT '{}',
    
    UNIQUE(user_id, badge_slug)
);

-- Create xp_events table for logging XP-related events
CREATE TABLE IF NOT EXISTS public.xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (LENGTH(action) <= 100),
    xp_amount INTEGER NOT NULL CHECK (xp_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    related_entity_id UUID,
    related_entity_type TEXT CHECK (related_entity_type IN ('session', 'board', 'intel_post', 'review', 'invite', 'photo'))
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON public.user_xp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_level ON public.user_xp(level);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_slug ON public.user_badges(badge_slug);
CREATE INDEX IF NOT EXISTS idx_user_badges_unlocked_at ON public.user_badges(unlocked_at);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_action ON public.xp_events(action);
CREATE INDEX IF NOT EXISTS idx_xp_events_created_at ON public.xp_events(created_at);

-- Enable RLS on all gamification tables
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_xp
CREATE POLICY "Users can view own XP" ON public.user_xp
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own XP" ON public.user_xp  
    FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "System can insert user XP" ON public.user_xp
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Create RLS policies for badge_definitions (public read)
CREATE POLICY "Anyone can view badge definitions" ON public.badge_definitions
    FOR SELECT USING (true);

-- Create RLS policies for user_badges
CREATE POLICY "Users can view own badges" ON public.user_badges
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "System can insert user badges" ON public.user_badges
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Create RLS policies for xp_events
CREATE POLICY "Users can view own XP events" ON public.xp_events
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "System can insert XP events" ON public.xp_events
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to user_xp table
CREATE TRIGGER update_user_xp_updated_at 
    BEFORE UPDATE ON public.user_xp 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert badge definitions with icons
INSERT INTO public.badge_definitions (badge_slug, name, description, icon, category, xp_reward) VALUES 
-- Global Badges
('first_ride', 'First Ride', 'Complete your first surf session', 'Waves', 'global', 50),
('quiver_builder', 'Quiver Builder', 'Add 3+ boards to your quiver', 'Package', 'global', 100),
('wave_whisperer', 'Wave Whisperer', 'Share 10+ intel posts with the community', 'MessageSquare', 'global', 150),
('session_captain', 'Session Captain', 'Organize 5 group surf sessions', 'Users', 'global', 200),
('crowd_control', 'Crowd Control', 'Submit 10 beach reviews', 'Star', 'global', 150),
('locals_tip', 'Local''s Tip', 'Get 5+ likes on your intel posts', 'ThumbsUp', 'global', 100),
('the_recruiter', 'The Recruiter', 'Invite 3+ friends to join Quiver', 'UserPlus', 'global', 300),
('tag_team', 'Tag Team', 'Tag 10 different surfers in sessions', 'Tag', 'global', 100),
('sunrise_chaser', 'Sunrise Chaser', 'Log a session before 6am', 'Sun', 'global', 75),
('dawn_patrol_legend', 'Dawn Patrol Legend', 'Complete 5+ sessions before 7am', 'Sunrise', 'global', 200),
('storm_chaser', 'Storm Chaser', 'Surf during a swell event', 'CloudRain', 'global', 150),

-- Journal+ Badges
('first_entry', 'First Entry', 'Log your first surf session reflection', 'BookOpen', 'journal', 25),
('consistency_king_queen', 'Consistency King/Queen', 'Log sessions consistently for 7+ days', 'Calendar', 'journal', 150),
('board_logger', 'Board Logger', 'Tag boards to 10+ sessions', 'Clipboard', 'journal', 100),
('water_watcher', 'Water Watcher', 'Record water temperature 20+ times', 'Eye', 'journal', 75),
('wave_rater', 'Wave Rater', 'Rate wave quality for 15+ sessions', 'BarChart3', 'journal', 75),
('seasoned_tracker', 'Seasoned Tracker', 'Log 50+ complete session entries', 'Trophy', 'journal', 250),

-- Quiver Badges
('quiver_starter', 'Quiver Starter', 'Add your first board to the quiver', 'Plus', 'quiver', 30),
('board_collector', 'Board Collector', 'Own 5+ boards in your quiver', 'Grid3x3', 'quiver', 150),
('tech_spec_pro', 'Tech Spec Pro', 'Add detailed specs to 3+ boards', 'Settings', 'quiver', 100),
('ride_logger', 'Ride Logger', 'Use the same board in 10+ sessions', 'Activity', 'quiver', 100),
('twin_fin_fan', 'Twin Fin Fan', 'Use twin fin boards in 5+ sessions', '♦️', 'quiver', 75),
('quiver_king_queen', 'Quiver King/Queen', 'Master of boards - own 10+ boards', 'Crown', 'quiver', 500)

ON CONFLICT (badge_slug) DO NOTHING;