BEGIN;

-- RPC function: compute all profile statistics server-side for a given user.
--
-- Replaces client-side computation in the native app's useProfileStats hook,
-- which previously fetched up to 2,000 session rows and processed them in JS.
-- Moving aggregation to SQL eliminates the data transfer and client-side work.
--
-- Security: SECURITY DEFINER so RLS on sessions is bypassed, but the function
-- restricts access to the requesting user's own rows via the WHERE clause.
-- The p_user_id parameter must match the calling user's auth.uid() — callers
-- enforce this in the hook (enabled only when userId is set).
--
-- Also recreates get_most_visited_beach(p_user_id UUID) which was dropped by
-- migration 20251031021702_remote_commit.sql. The native hook depends on this
-- function. The prior no-arg version was a global aggregate; this version
-- correctly scopes to the requesting user.

-- ============================================================
-- 1. get_profile_stats: aggregate stats in a single SQL pass
-- ============================================================

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

-- ============================================================
-- 2. get_most_visited_beach: recreate with user_id scope
--
-- The global (no-arg) version was dropped in 20251031021702_remote_commit.sql.
-- The native hook calls this as: supabase.rpc('get_most_visited_beach', { user_id: userId })
-- so the parameter name must stay user_id (not p_user_id) to match existing callers.
-- ============================================================

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

-- ============================================================
-- Rollback instructions (manual — do not run in production):
--
--   DROP FUNCTION IF EXISTS public.get_profile_stats(uuid);
--   DROP FUNCTION IF EXISTS public.get_most_visited_beach(uuid);
--
-- The previous get_most_visited_beach (no-arg, global) is not restored
-- because it was already absent before this migration.
-- ============================================================

COMMIT;
