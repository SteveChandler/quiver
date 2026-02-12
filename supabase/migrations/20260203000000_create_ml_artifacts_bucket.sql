-- Create ml-artifacts storage bucket for ML model artifacts
-- This bucket stores trained model files that are deployed to the ML service

-- Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ml-artifacts',
  'ml-artifacts',
  true, -- Public for ML service to access without auth
  52428800, -- 50 MB limit (models are typically 1-5 MB)
  ARRAY['application/json', 'application/octet-stream'] -- JSON model files
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the ml-artifacts bucket
-- Policy 1: Allow service role to upload/update/delete model files
CREATE POLICY "Service role can manage ml-artifacts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'ml-artifacts');

-- Policy 2: Allow public read access to model files (for ML service)
-- The ML service needs to download models without authentication
CREATE POLICY "Public can read ml-artifacts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ml-artifacts');

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON storage.objects TO service_role;
GRANT ALL ON storage.buckets TO service_role;

-- Note: COMMENT ON SCHEMA storage requires ownership, skipped for local compatibility
