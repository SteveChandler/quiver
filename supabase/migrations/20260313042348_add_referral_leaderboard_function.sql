-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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
        COALESCE(p.full_name, 'Anonymous Surfer') AS display_name,
        p.avatar_url,
        COUNT(r.id) AS referral_count,
        ROW_NUMBER() OVER (ORDER BY COUNT(r.id) DESC, MIN(r.created_at) ASC) AS rank
    FROM public.profiles p
    INNER JOIN public.referrals r ON r.referrer_id = p.id
    GROUP BY p.id, p.full_name, p.avatar_url
    HAVING COUNT(r.id) > 0
    ORDER BY referral_count DESC, MIN(r.created_at) ASC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION public.get_referral_leaderboard(INTEGER) IS
    'Returns the top referrers by referral count for the leaderboard display.';

GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard(INTEGER) TO authenticated;
