-- Add NPC behavioral configuration fields to profiles table
-- These enable personality-driven posting patterns and beach selection

BEGIN;

-- Home region for the NPC (e.g., 'north-san-diego', 'sf-bay-area')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_region TEXT;

-- Primary home beaches - 70% of posts come from these (array of beach UUIDs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_beach_ids UUID[];

-- Secondary/regional beaches - 25% of posts (array of beach UUIDs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_beaches UUID[];

-- Posting window preferences as JSON (e.g., {"primary": [5, 8], "secondary": [16, 19]})
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posting_window JSONB;

-- Activity frequency: 'high' (5-7/week), 'medium' (2-4/week), 'low' (1-2/week)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level TEXT CHECK (activity_level IN ('high', 'medium', 'low'));

-- Personality type for content generation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personality_type TEXT CHECK (personality_type IN ('rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster'));

-- System account flag for Quiver Surf Forecast bot
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN DEFAULT false;

-- Create index for querying NPCs by activity level and personality
CREATE INDEX IF NOT EXISTS idx_profiles_npc_config ON profiles (activity_level, personality_type) WHERE is_mock = true;

COMMIT;
