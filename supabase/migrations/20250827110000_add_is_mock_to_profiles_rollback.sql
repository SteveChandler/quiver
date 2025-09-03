-- Rollback: Remove is_mock column from profiles table
-- This reverts the changes from 20250827000001_add_is_mock_to_profiles.sql

BEGIN;

-- Drop the index first
DROP INDEX IF EXISTS public.idx_profiles_is_mock;

-- Remove the is_mock column
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS is_mock;

COMMIT;