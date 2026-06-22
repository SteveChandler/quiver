BEGIN;
CREATE OR REPLACE FUNCTION public.get_user_streaks(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_best INT := 0;
  v_current INT := 0;
  v_this_week DATE := date_trunc('week', NOW())::date;
  v_caller UUID := auth.uid();
  v_has_deleted_at BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'get_user_streaks: p_user_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'get_user_streaks: caller may only read own streaks'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'deleted_at'
  )
  INTO v_has_deleted_at;

  EXECUTE format(
    $streak_query$
    WITH weeks AS (
      SELECT DISTINCT date_trunc('week', arrival_time)::date AS wk
      FROM public.sessions
      WHERE user_id = $1 %s
    ),
    islands AS (
      SELECT
        wk,
        (wk - ((ROW_NUMBER() OVER (ORDER BY wk))::int * INTERVAL '7 day'))::date AS grp
      FROM weeks
    ),
    runs AS (
      SELECT grp, COUNT(*)::int AS run_len, MAX(wk) AS last_wk
      FROM islands
      GROUP BY grp
    )
    SELECT
      COALESCE(MAX(run_len), 0),
      COALESCE(MAX(run_len) FILTER (WHERE last_wk >= $2 - INTERVAL '7 day'), 0)
    FROM runs
    $streak_query$,
    CASE WHEN v_has_deleted_at THEN 'AND deleted_at IS NULL' ELSE '' END
  )
  USING p_user_id, v_this_week
  INTO v_best, v_current;

  RETURN json_build_object(
    'weekly_session_streak_current', v_current,
    'weekly_session_streak_best',    v_best,
    'daily_call_streak_current',     0,
    'daily_call_streak_best',        0
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_streaks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_streaks(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_user_streaks(uuid) IS
  'Weekly session streak (consecutive ISO weeks with >=1 session) for a user. '
  'Current streak stays alive through the current week if last session was this week '
  'or last week (one-week grace). daily_call_* are 0 until Plan 008 lands. '
  'Applies sessions.deleted_at IS NULL when the column exists. '
  'SECURITY DEFINER with search_path protection and self-read guard.';
COMMIT;
