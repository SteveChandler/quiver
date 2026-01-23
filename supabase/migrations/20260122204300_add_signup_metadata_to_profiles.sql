-- Migration: Add signup metadata columns to profiles table
-- Stores timezone, signup context (UTM, device, etc.), and IP-based location data

BEGIN;

-- Add timezone for localized features and email scheduling
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;
COMMENT ON COLUMN profiles.timezone IS 'IANA timezone from signup (e.g., America/Los_Angeles)';

-- Store full signup context for attribution and analytics
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_context JSONB;
COMMENT ON COLUMN profiles.signup_context IS 'Signup context: method, UTM params, device, referrer, entrypoint, landing_path';

-- Store IP-based location data from signup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_location JSONB;
COMMENT ON COLUMN profiles.signup_location IS 'IP-derived location at signup: city, region, country, lat/lng';

-- Index on timezone for email scheduling queries
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone) WHERE timezone IS NOT NULL;

-- Revoke direct UPDATE on signup columns from authenticated users.
-- The SECURITY DEFINER trigger (handle_new_user) still has full access.
REVOKE UPDATE (signup_context, signup_location) ON public.profiles FROM authenticated;

COMMIT;
