-- Create session_likes table to track which users have liked which sessions
CREATE TABLE session_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id) -- Prevent duplicate likes from same user
);

-- Add RLS policies for session_likes
ALTER TABLE session_likes ENABLE ROW LEVEL SECURITY;

-- Allow users to view all likes (to show counts)
CREATE POLICY "Session likes are viewable by everyone" 
ON session_likes 
FOR SELECT 
USING (true);

-- Allow users to insert their own likes
CREATE POLICY "Users can like sessions" 
ON session_likes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own likes
CREATE POLICY "Users can unlike sessions" 
ON session_likes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_session_likes_session_id ON session_likes(session_id);
CREATE INDEX idx_session_likes_user_id ON session_likes(user_id);
CREATE INDEX idx_session_likes_unique ON session_likes(session_id, user_id);

-- Create a function to update session likes_count when likes are added/removed
CREATE OR REPLACE FUNCTION update_session_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment likes_count
    UPDATE sessions 
    SET likes_count = COALESCE(likes_count, 0) + 1 
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement likes_count
    UPDATE sessions 
    SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) 
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update likes_count
CREATE TRIGGER update_session_likes_count_insert
  AFTER INSERT ON session_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_session_likes_count();

CREATE TRIGGER update_session_likes_count_delete
  AFTER DELETE ON session_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_session_likes_count(); 