-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalSessions',      COUNT(*),
    'totalMinutes',       COALESCE(SUM(duration_minutes), 0),
    'avgRating',          ROUND(COALESCE(AVG(rating), 0)::numeric, 1),
    'uniqueBeaches',      COUNT(DISTINCT beach_id),
    'longestSession',     COALESCE(MAX(duration_minutes), 0),
    'sessionsThisMonth',  COUNT(*) FILTER (
                            WHERE arrival_time >= date_trunc('month', NOW())
                          ),
    'ytdSessions',        COUNT(*) FILTER (
                            WHERE arrival_time >= date_trunc('year', NOW())
                          ),
    'ytdMinutes',         COALESCE(
                            SUM(duration_minutes) FILTER (
                              WHERE arrival_time >= date_trunc('year', NOW())
                            ), 0
                          ),
    'ytdBeaches',         COUNT(DISTINCT beach_id) FILTER (
                            WHERE arrival_time >= date_trunc('year', NOW())
                          ),
    'ytdBestRating',      COALESCE(
                            MAX(rating) FILTER (
                              WHERE arrival_time >= date_trunc('year', NOW())
                            ), 0
                          )
  ) INTO result
  FROM sessions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_profile_stats IS
  'Returns aggregated session statistics for a user. '
  'SECURITY DEFINER — access is restricted to the specified user_id row set. '
  'Replaces client-side 2,000-row fetch in the native useProfileStats hook.';

DROP FUNCTION IF EXISTS public.get_most_visited_beach(uuid);

CREATE OR REPLACE FUNCTION public.get_most_visited_beach(user_id UUID)
RETURNS TABLE(beach_id UUID, visit_count BIGINT, beach_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.beach_id,
    COUNT(s.id)::BIGINT AS visit_count,
    b.name              AS beach_name
  FROM sessions s
  JOIN beaches b ON b.id = s.beach_id
  WHERE s.user_id = get_most_visited_beach.user_id
    AND s.deleted_at IS NULL
  GROUP BY s.beach_id, b.name
  ORDER BY visit_count DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_most_visited_beach(uuid) IS
  'Returns the beach a user has visited most frequently. '
  'Recreated with a user_id parameter after the global version was dropped in remote_commit migration. '
  'SECURITY DEFINER with search_path protection.';
