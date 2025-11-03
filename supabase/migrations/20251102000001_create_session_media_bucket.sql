-- Create session-media storage bucket and policies for session photo/video uploads
-- Path format: {sessionId}/{userId}/{timestamp}.ext

-- 1) Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-media',
  'session-media',
  true,
  10485760, -- 10MB limit (5MB for photos after compression, allowing headroom)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- 2) RLS enablement is managed by Supabase on hosted projects; do not alter table ownership here

-- 3) Allow public read of session-media bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
          AND policyname = 'Session media are publicly readable'
    ) THEN
        CREATE POLICY "Session media are publicly readable" ON storage.objects
        FOR SELECT USING (bucket_id = 'session-media');
    END IF;
END $$;

-- 4) Allow authenticated users to upload into their session folders
-- Path convention in app: {sessionId}/{userId}/{timestamp}.ext
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
          AND policyname = 'Users can upload their own session media'
    ) THEN
        CREATE POLICY "Users can upload their own session media" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'session-media'
            AND auth.uid()::text = (storage.foldername(name))[2]
            AND (storage.foldername(name))[1] IS NOT NULL -- session_id must exist
        );
    END IF;
END $$;

-- 5) Allow owners to update their own session media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
          AND policyname = 'Users can update their own session media'
    ) THEN
        CREATE POLICY "Users can update their own session media" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'session-media'
            AND auth.uid()::text = (storage.foldername(name))[2]
        );
    END IF;
END $$;

-- 6) Allow owners to delete their own session media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
          AND policyname = 'Users can delete their own session media'
    ) THEN
        CREATE POLICY "Users can delete their own session media" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'session-media'
            AND auth.uid()::text = (storage.foldername(name))[2]
        );
    END IF;
END $$;
