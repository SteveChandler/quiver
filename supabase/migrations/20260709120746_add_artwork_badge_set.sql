BEGIN;
INSERT INTO badge_definitions (badge_slug, name, description, icon, category, xp_reward) VALUES
('three_day_streak', '3-Day Streak', 'Log sessions on 3 consecutive days', 'Calendar', 'journal', 75),
('new_break_logged', 'New Break Logged', 'Log a session at a new break', 'MapPin', 'global', 75),
('home_break_regular', 'Home Break Regular', 'Log 10 sessions at your home break', 'Home', 'global', 150),
('clean_conditions', 'Clean Conditions', 'Log 5 sessions in clean or glassy conditions', 'Sparkles', 'global', 100),
('best_session', 'Best Session', 'Rate a session 5 stars', 'Award', 'journal', 100)
ON CONFLICT (badge_slug) DO NOTHING;

UPDATE badge_definitions SET name = 'First Paddle Out' WHERE badge_slug = 'first_ride';
COMMIT;
