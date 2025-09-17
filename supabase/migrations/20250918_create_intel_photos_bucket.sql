-- Create intel-photos storage bucket and policies for intel image uploads

-- 1) Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('intel-photos', 'intel-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2) RLS enablement is managed by Supabase on hosted projects; do not alter table ownership here

-- 3) Allow public read of intel-photos bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
          AND policyname = 'Intel photos are publicly readable'
    ) THEN
        CREATE POLICY "Intel photos are publicly readable" ON storage.objects
        FOR SELECT USING (bucket_id = 'intel-photos');
    END IF;
END $$;

-- 4) Allow authenticated users to upload into their own folder
-- Path convention in app: intel-posts/<userId>/<timestamp>.<ext>
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
          AND policyname = 'Users can upload their own intel photos'
    ) THEN
        CREATE POLICY "Users can upload their own intel photos" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'intel-photos'
            AND (storage.foldername(name))[1] = 'intel-posts'
            AND auth.uid()::text = (storage.foldername(name))[2]
        );
    END IF;
END $$;

-- 5) Allow owners to update their own intel photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
          AND policyname = 'Users can update their own intel photos'
    ) THEN
        CREATE POLICY "Users can update their own intel photos" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'intel-photos'
            AND (storage.foldername(name))[1] = 'intel-posts'
            AND auth.uid()::text = (storage.foldername(name))[2]
        );
    END IF;
END $$;

-- 6) Allow owners to delete their own intel photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
          AND policyname = 'Users can delete their own intel photos'
    ) THEN
        CREATE POLICY "Users can delete their own intel photos" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'intel-photos'
            AND (storage.foldername(name))[1] = 'intel-posts'
            AND auth.uid()::text = (storage.foldername(name))[2]
        );
    END IF;
END $$;


