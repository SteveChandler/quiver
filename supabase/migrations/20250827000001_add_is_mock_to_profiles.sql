-- Add is_mock column to profiles table for identifying mock users
-- This allows us to safely seed and manage mock users for development and testing
-- without affecting real user data

BEGIN;

-- Add is_mock column to profiles table
-- Default to false for existing users (real users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT false;

-- Create an index for efficient querying of mock users
CREATE INDEX IF NOT EXISTS idx_profiles_is_mock 
ON public.profiles(is_mock) 
WHERE is_mock = true;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.is_mock IS 'Flag to identify mock/test users for development and testing purposes';

COMMIT;