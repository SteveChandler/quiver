-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;
INSERT INTO badge_definitions (badge_slug, name, description, icon, category, xp_reward) VALUES
('skill_tracker', 'Skill Tracker', 'Rate your skills in 10 sessions', 'TrendingUp', 'journal', 100),
('streak_warrior', 'Streak Warrior', 'Maintain a 14-day session streak', 'Flame', 'journal', 200),
('sweet_spot_finder', 'Sweet Spot Finder', 'Discover your ideal surf conditions', 'Target', 'journal', 150),
('progression_sharer', 'Progression Sharer', 'Share a progression milestone', 'Share2', 'global', 75)
ON CONFLICT (badge_slug) DO NOTHING;
COMMIT;
