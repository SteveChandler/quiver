-- Fix Referral Leaderboard Privacy: prefer display_name over full_name
--
-- The original function exposed users' real names (full_name) on the public
-- leaderboard. This migration replaces it to prefer display_name first,
-- falling back to full_name only if display_name is not set.
--
-- ROLLBACK INSTRUCTIONS:
--   Re-apply the original migration 20260313033535_add_referral_leaderboard_function.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard(max_results INTEGER DEFAULT 10)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    referral_count BIGINT,
    rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS user_id,
        COALESCE(p.display_name, p.full_name, 'Anonymous Surfer') AS display_name,
        p.avatar_url,
        COUNT(r.id) AS referral_count,
        ROW_NUMBER() OVER (ORDER BY COUNT(r.id) DESC, MIN(r.created_at) ASC) AS rank
    FROM public.profiles p
    INNER JOIN public.referrals r ON r.referrer_id = p.id
    GROUP BY p.id, p.display_name, p.full_name, p.avatar_url
    HAVING COUNT(r.id) > 0
    ORDER BY referral_count DESC, MIN(r.created_at) ASC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.get_referral_leaderboard(INTEGER) IS
    'Returns the top referrers by referral count for the leaderboard display. Prefers display_name over full_name for privacy.';

COMMIT;
