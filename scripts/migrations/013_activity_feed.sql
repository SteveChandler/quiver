-- Activity Feed System Migration
-- Run this in Supabase SQL Editor

-- Create user_activities table for activity tracking
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id_created_at ON user_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_type_created_at ON user_activities(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_entity ON user_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);

-- Enable RLS on user_activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_activities (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view public activities" ON user_activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON user_activities;

CREATE POLICY "Users can view public activities" ON user_activities
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own activities" ON user_activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to create activity records
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS create_activity(UUID, VARCHAR, VARCHAR, UUID, JSONB);

CREATE OR REPLACE FUNCTION create_activity(
  p_user_id UUID,
  p_activity_type VARCHAR(50),
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;

-- Function to get activity feed for a user (their activities + people they follow)
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS get_user_activity_feed(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_activity_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_type VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  user_name TEXT,
  user_avatar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.id,
    ua.user_id,
    ua.activity_type,
    ua.entity_type,
    ua.entity_id,
    ua.metadata,
    ua.created_at,
    p.full_name as user_name,
    p.avatar_url as user_avatar
  FROM user_activities ua
  JOIN profiles p ON ua.user_id = p.id
  WHERE ua.user_id = p_user_id 
    OR ua.user_id IN (
      SELECT following_id 
      FROM user_follows 
      WHERE follower_id = p_user_id
    )
  ORDER BY ua.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Triggers to automatically create activities

-- Session activities
CREATE OR REPLACE FUNCTION create_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_activity(
      NEW.user_id,
      'session_logged',
      'session',
      NEW.id,
      jsonb_build_object(
        'beach_name', NEW.beach_name,
        'status', NEW.status
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'completed' THEN
    PERFORM create_activity(
      NEW.user_id,
      'session_completed',
      'session',
      NEW.id,
      jsonb_build_object(
        'beach_name', NEW.beach_name,
        'rating', NEW.rating
      )
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_session_activity ON sessions;
CREATE TRIGGER trigger_session_activity
  AFTER INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_session_activity();

-- Beach review activities
CREATE OR REPLACE FUNCTION create_beach_review_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_activity(
      NEW.user_id,
      'beach_reviewed',
      'beach_review',
      NEW.id,
      jsonb_build_object(
        'beach_id', NEW.beach_id,
        'overall_rating', NEW.overall_rating,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_beach_review_activity ON beach_reviews;
CREATE TRIGGER trigger_beach_review_activity
  AFTER INSERT ON beach_reviews
  FOR EACH ROW
  EXECUTE FUNCTION create_beach_review_activity();

-- Follow activities
CREATE OR REPLACE FUNCTION create_follow_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_activity(
      NEW.follower_id,
      'user_followed',
      'user_follow',
      NEW.id,
      jsonb_build_object(
        'followed_user_id', NEW.following_id
      )
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_follow_activity ON user_follows;
CREATE TRIGGER trigger_follow_activity
  AFTER INSERT ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_activity();

-- Add helpful comments
COMMENT ON TABLE user_activities IS 'Tracks user activities for the activity feed system';
COMMENT ON FUNCTION create_activity IS 'Creates a new activity record';
COMMENT ON FUNCTION get_user_activity_feed IS 'Gets activity feed for a user including activities from people they follow';