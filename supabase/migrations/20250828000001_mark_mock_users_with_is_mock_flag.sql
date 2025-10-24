-- Mark existing mock users with is_mock = true for NPC daily activity workflow
-- This migration ensures that mock users created by earlier migrations are properly flagged
-- so the NPC workflow can find them via WHERE is_mock = true

BEGIN;

-- First, ensure the is_mock column exists (idempotent operation)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT false;

-- Create an index for efficient querying of mock users (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_is_mock 
ON public.profiles(is_mock) 
WHERE is_mock = true;

-- Add a comment for documentation (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_description 
    WHERE objoid = 'public.profiles'::regclass 
    AND objsubid = (
      SELECT attnum FROM pg_attribute 
      WHERE attrelid = 'public.profiles'::regclass 
      AND attname = 'is_mock'
    )
  ) THEN
    COMMENT ON COLUMN public.profiles.is_mock IS 'Flag to identify mock/test users for development and testing purposes';
  END IF;
END $$;

-- Mark all existing mock users as is_mock = true
-- These are users created by migration 20250817130000_seed_mock_users.sql
UPDATE public.profiles
SET is_mock = true
WHERE full_name IN (
    -- Original mock users from 20250817130000 migration
    'Liquid Snake',
    'Big Boss',
    'Solid Snake',
    'Riley R.',
    'Local Larry',
    'Tina C.',
    'P. Martinez',
    'Dawn Patrol',
    'NorCal Jake',
    'SoCal Sofia',
    'M. Johnson',
    'Kai N.',
    'Emma F.',
    'Ryan K.',
    'Mia R.'
);

-- Log the operation for audit purposes
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count 
    FROM public.profiles 
    WHERE is_mock = true;
    
    RAISE NOTICE 'Migration completed. % mock users now flagged with is_mock = true', updated_count;
END $$;

COMMIT;