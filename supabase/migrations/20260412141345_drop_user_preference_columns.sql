BEGIN;

-- Drop partial indexes first
DROP INDEX IF EXISTS idx_profiles_wave_size;
DROP INDEX IF EXISTS idx_profiles_break_type;
DROP INDEX IF EXISTS idx_profiles_crowd_preference;

-- Drop dependent view (it freezes profiles.* column list at creation time
-- and blocks the column drops below). Recreated after the drops.
DROP VIEW IF EXISTS public.profiles_with_home_beach;

-- Drop columns
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_wave_size;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_break_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS crowd_preference;

-- Recreate view to match prod shape (explicit columns, no preferred_*).
CREATE VIEW public.profiles_with_home_beach
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.full_name,
  p.created_at,
  p.email_session_invites,
  p.inapp_session_invites,
  p.digest_session_invites,
  p.followers_count,
  p.following_count,
  p.is_mock,
  p.avatar_url,
  p.email,
  p.phone_number,
  p.bio,
  p.location,
  p.experience_level,
  p.instagram,
  p.updated_at,
  p.home_beach_id,
  p.onboarding_completed_at,
  b.name AS home_beach_name
FROM public.profiles p
LEFT JOIN public.beaches b ON b.id = p.home_beach_id;

COMMIT;
