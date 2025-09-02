-- Create avatar storage bucket and policies for profile image uploads

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own avatar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can upload their own avatar'
    ) THEN
        CREATE POLICY "Users can upload their own avatar" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'avatars' 
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END $$;

-- Policy: Users can update their own avatar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can update their own avatar'
    ) THEN
        CREATE POLICY "Users can update their own avatar" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'avatars' 
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END $$;

-- Policy: Users can delete their own avatar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can delete their own avatar'
    ) THEN
        CREATE POLICY "Users can delete their own avatar" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'avatars' 
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END $$;

-- Policy: Avatar images are publicly readable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Avatar images are publicly readable'
    ) THEN
        CREATE POLICY "Avatar images are publicly readable" ON storage.objects
        FOR SELECT USING (bucket_id = 'avatars');
    END IF;
END $$;