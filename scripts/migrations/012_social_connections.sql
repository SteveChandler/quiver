-- Social Connections System Migration
-- Run this in Supabase SQL Editor

-- Create user_follows table for social connections
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id) -- Prevent self-following
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON user_follows(created_at DESC);

-- Enable RLS on user_follows
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_follows
CREATE POLICY "Users can view all follows" ON user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON user_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others" ON user_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Add follower/following counts to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE profiles 
    SET following_count = COALESCE(following_count, 0) + 1 
    WHERE id = NEW.follower_id;
    
    -- Increment followers count for the person being followed
    UPDATE profiles 
    SET followers_count = COALESCE(followers_count, 0) + 1 
    WHERE id = NEW.following_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower
    UPDATE profiles 
    SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0) 
    WHERE id = OLD.follower_id;
    
    -- Decrement followers count for the person being unfollowed
    UPDATE profiles 
    SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0) 
    WHERE id = OLD.following_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update follow counts
DROP TRIGGER IF EXISTS update_follow_counts_insert ON user_follows;
DROP TRIGGER IF EXISTS update_follow_counts_delete ON user_follows;

CREATE TRIGGER update_follow_counts_insert
  AFTER INSERT ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

CREATE TRIGGER update_follow_counts_delete
  AFTER DELETE ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Initialize counts for existing profiles
UPDATE profiles SET 
  followers_count = (
    SELECT COUNT(*) FROM user_follows WHERE following_id = profiles.id
  ),
  following_count = (
    SELECT COUNT(*) FROM user_follows WHERE follower_id = profiles.id
  );

-- Add helpful comments
COMMENT ON TABLE user_follows IS 'Stores social connections between users (following/followers)';
COMMENT ON FUNCTION update_follow_counts IS 'Updates follower and following counts when relationships change'; 