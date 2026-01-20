-- Add onboarding_completed_at to profiles_with_home_beach view
-- This allows the /api/profile endpoint to fetch the field in one query
-- instead of requiring a separate database round-trip
--
-- Note: Must DROP and recreate because CREATE OR REPLACE VIEW cannot change column order

DROP VIEW IF EXISTS "public"."profiles_with_home_beach";

CREATE VIEW "public"."profiles_with_home_beach" AS SELECT p.id,
    p.full_name,
    p.created_at,
    p.email_session_invites,
    p.inapp_session_invites,
    p.digest_session_invites,
    p.favorite_spot,
    p.favorite_spot_id,
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
   FROM (public.profiles p
     LEFT JOIN public.beaches b ON ((b.id = p.home_beach_id)));
