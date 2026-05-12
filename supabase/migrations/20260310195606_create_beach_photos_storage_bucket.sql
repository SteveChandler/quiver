-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

BEGIN;

-- Create beach-photos storage bucket for downloaded Google Places photos
-- These are cached copies of place photos served as beach imagery

-- 1) Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'beach-photos',
  'beach-photos',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2) Public read access — anyone can view beach photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Beach photos are publicly readable'
    ) THEN
        CREATE POLICY "Beach photos are publicly readable"
        ON storage.objects
        FOR SELECT
        TO public
        USING (bucket_id = 'beach-photos');
    END IF;
END $$;

-- 3) Service role can insert beach photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Service role can insert beach photos'
    ) THEN
        CREATE POLICY "Service role can insert beach photos"
        ON storage.objects
        FOR INSERT
        TO service_role
        WITH CHECK (bucket_id = 'beach-photos');
    END IF;
END $$;

-- 4) Service role can update beach photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Service role can update beach photos'
    ) THEN
        CREATE POLICY "Service role can update beach photos"
        ON storage.objects
        FOR UPDATE
        TO service_role
        USING (bucket_id = 'beach-photos');
    END IF;
END $$;

-- 5) Service role can delete beach photos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Service role can delete beach photos'
    ) THEN
        CREATE POLICY "Service role can delete beach photos"
        ON storage.objects
        FOR DELETE
        TO service_role
        USING (bucket_id = 'beach-photos');
    END IF;
END $$;

COMMIT;
