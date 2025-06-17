-- Session Media System Migration
-- Run this in Supabase SQL Editor

-- Create session media table
CREATE TABLE IF NOT EXISTS session_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  media_type VARCHAR(20) CHECK (media_type IN ('photo', 'video')) DEFAULT 'photo',
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  file_size INTEGER, -- Track for free tier monitoring
  metadata JSONB, -- dimensions, compression ratio, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create storage usage tracking table for free tier management
CREATE TABLE IF NOT EXISTS storage_usage (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  total_bytes BIGINT DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_session_media_session_id ON session_media(session_id);
CREATE INDEX IF NOT EXISTS idx_session_media_user_id ON session_media(user_id);
CREATE INDEX IF NOT EXISTS idx_session_media_created_at ON session_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_usage_user_id ON storage_usage(user_id);

-- Enable RLS on both tables
ALTER TABLE session_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

-- Session Media Policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all session media" ON session_media;
DROP POLICY IF EXISTS "Users can insert their own session media" ON session_media;
DROP POLICY IF EXISTS "Users can update their own session media" ON session_media;
DROP POLICY IF EXISTS "Users can delete their own session media" ON session_media;

CREATE POLICY "Users can view all session media"
ON session_media FOR SELECT USING (true);

CREATE POLICY "Users can insert their own session media"
ON session_media FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session media"
ON session_media FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session media"
ON session_media FOR DELETE USING (auth.uid() = user_id);

-- Storage Usage Policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own storage usage" ON storage_usage;
DROP POLICY IF EXISTS "Users can update their own storage usage" ON storage_usage;
DROP POLICY IF EXISTS "Users can update their own storage usage records" ON storage_usage;

CREATE POLICY "Users can view their own storage usage"
ON storage_usage FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage usage"
ON storage_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage usage records"
ON storage_usage FOR UPDATE USING (auth.uid() = user_id);

-- Create storage bucket for session media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'session-media', 
  'session-media', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage Bucket Policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload session media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view session media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own session media" ON storage.objects;

CREATE POLICY "Users can upload session media"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'session-media' 
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND (storage.foldername(name))[1] IS NOT NULL -- session_id must exist
);

CREATE POLICY "Anyone can view session media"
ON storage.objects FOR SELECT 
USING (bucket_id = 'session-media');

CREATE POLICY "Users can delete their own session media"
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'session-media' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Function to update user storage usage
CREATE OR REPLACE FUNCTION update_user_storage_usage(
  p_user_id UUID,
  p_bytes_to_add INTEGER,
  p_images_to_add INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO storage_usage (user_id, total_bytes, image_count, last_updated)
  VALUES (p_user_id, GREATEST(0, p_bytes_to_add), GREATEST(0, p_images_to_add), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    total_bytes = GREATEST(0, storage_usage.total_bytes + p_bytes_to_add),
    image_count = GREATEST(0, storage_usage.image_count + p_images_to_add),
    last_updated = NOW();
END;
$$;

-- Function to automatically track media uploads
CREATE OR REPLACE FUNCTION track_session_media_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update storage usage when new media is inserted
  IF TG_OP = 'INSERT' THEN
    PERFORM update_user_storage_usage(NEW.user_id, NEW.file_size, 1);
    RETURN NEW;
  END IF;
  
  -- Update storage usage when media is deleted
  IF TG_OP = 'DELETE' THEN
    PERFORM update_user_storage_usage(OLD.user_id, -OLD.file_size, -1);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers for automatic storage tracking
DROP TRIGGER IF EXISTS trigger_track_session_media_upload ON session_media;
CREATE TRIGGER trigger_track_session_media_upload
  AFTER INSERT OR DELETE ON session_media
  FOR EACH ROW EXECUTE FUNCTION track_session_media_upload();

-- Function to clean up orphaned media (media without session records)
CREATE OR REPLACE FUNCTION cleanup_orphaned_session_media()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete media records that reference non-existent sessions
  DELETE FROM session_media 
  WHERE session_id NOT IN (SELECT id FROM sessions);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to get user's storage stats
CREATE OR REPLACE FUNCTION get_user_storage_stats(p_user_id UUID)
RETURNS TABLE (
  total_bytes BIGINT,
  image_count INTEGER,
  remaining_bytes BIGINT,
  usage_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_limit CONSTANT BIGINT := 104857600; -- 100MB per user
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(su.total_bytes, 0) as total_bytes,
    COALESCE(su.image_count, 0) as image_count,
    GREATEST(0, user_limit - COALESCE(su.total_bytes, 0)) as remaining_bytes,
    ROUND((COALESCE(su.total_bytes, 0)::NUMERIC / user_limit::NUMERIC) * 100, 2) as usage_percentage
  FROM storage_usage su
  WHERE su.user_id = p_user_id
  UNION ALL
  SELECT 0::BIGINT, 0::INTEGER, user_limit, 0.00::NUMERIC
  WHERE NOT EXISTS (SELECT 1 FROM storage_usage WHERE user_id = p_user_id)
  LIMIT 1;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Add helpful comments
COMMENT ON TABLE session_media IS 'Stores media files associated with surf sessions';
COMMENT ON TABLE storage_usage IS 'Tracks storage usage per user for free tier management';
COMMENT ON FUNCTION update_user_storage_usage IS 'Updates user storage usage statistics';
COMMENT ON FUNCTION cleanup_orphaned_session_media IS 'Removes session media records that reference deleted sessions';
COMMENT ON FUNCTION get_user_storage_stats IS 'Returns comprehensive storage statistics for a user'; 