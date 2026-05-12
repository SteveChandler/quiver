-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Drop view that depends on columns being removed
DROP VIEW IF EXISTS public.profiles_with_home_beach;

-- Drop FK constraint and dead columns
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_favorite_spot_id_fkey;
ALTER TABLE profiles DROP COLUMN IF EXISTS favorite_spot;
ALTER TABLE profiles DROP COLUMN IF EXISTS favorite_spot_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS home_beach_ids;
ALTER TABLE profiles DROP COLUMN IF EXISTS secondary_beaches;

-- Recreate view without dead columns
CREATE VIEW public.profiles_with_home_beach AS
SELECT p.id,
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
FROM profiles p
LEFT JOIN beaches b ON b.id = p.home_beach_id;
