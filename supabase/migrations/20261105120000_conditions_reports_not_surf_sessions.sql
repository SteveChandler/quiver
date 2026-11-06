-- A conditions report writes a hidden session (source = 'conditions_report', duration 0,
-- is_public = true) so approved report videos satisfy the public session_media RLS arm.
-- It is not a surf: keep it out of the public feed, profile totals and the weekly streak.
-- is_public stays as-is because report-video RLS depends on it.
--
-- Each object is recreated from its latest definition with only the source filter added:
--   public_session_feed_eligibility  20260709123000_public_session_feed_eligibility.sql
--   get_profile_stats                20260313033921_add_get_profile_stats_rpc.sql, made SECURITY
--                                    INVOKER by 20260521120000 and 20261020233000 (kept here)
--   get_user_streaks                 20260622032237_create_daily_calls_and_daily_streak.sql
-- CREATE OR REPLACE keeps existing grants and comments; the view's columns are unchanged.
BEGIN;

CREATE OR REPLACE VIEW public.public_session_feed_eligibility
WITH (security_invoker = true) AS
WITH classified AS (
  SELECT
    s.id AS session_id,
    s.user_id,
    s.beach_id,
    s.arrival_time,
    s.created_at,
    (
      length(btrim(coalesce(s.notes, ''))) >= 12
      OR (
        s.source IS DISTINCT FROM 'auto_title'
        AND length(btrim(coalesce(s.description, ''))) >= 12
      )
      OR s.wave_quality IS NOT NULL
      OR coalesce(array_length(s.wave_characteristics, 1), 0) > 0
      OR s.tide_height_ft IS NOT NULL
      OR s.tide_status IS NOT NULL
      OR s.tide_rate_ft_per_hr IS NOT NULL
      OR s.rip_current_observed IS NOT NULL
      OR s.rip_current_risk IS NOT NULL
      OR s.crowd_level IS NOT NULL
      OR s.water_temp IS NOT NULL
    ) AS has_context,
    (
      nullif(btrim(coalesce(s.image_url, '')), '') IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.session_media sm
        WHERE sm.session_id = s.id
          AND sm.deleted_at IS NULL
      )
    ) AS has_media,
    s.rating
  FROM public.sessions s
  WHERE s.status = 'completed'
    AND s.is_public = true
    AND s.deleted_at IS NULL
    AND s.source IS DISTINCT FROM 'conditions_report'
)
SELECT
  session_id,
  user_id,
  beach_id,
  arrival_time,
  created_at,
  has_context,
  has_media,
  (NOT has_context AND NOT has_media) AS thin,
  (rating IS NOT NULL AND rating <= 2 AND (has_context OR has_media)) AS warning,
  (has_context OR has_media) AS informative,
  (rating IS NOT NULL AND rating >= 4 AND (has_context OR has_media)) AS strong
FROM classified;

GRANT SELECT ON public.public_session_feed_eligibility TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
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
    AND deleted_at IS NULL
    AND source IS DISTINCT FROM 'conditions_report';

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_streaks(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_best INT := 0;
  v_week_current INT := 0;
  v_day_best INT := 0;
  v_day_current INT := 0;
  v_this_week DATE := date_trunc('week', NOW())::date;
  v_today DATE := CURRENT_DATE;
  v_caller UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'get_user_streaks: p_user_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'get_user_streaks: caller may only read own streaks'
      USING ERRCODE = '42501';
  END IF;

  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', arrival_time)::date AS wk
    FROM public.sessions
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND source IS DISTINCT FROM 'conditions_report'
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
    COALESCE(MAX(run_len) FILTER (WHERE last_wk >= v_this_week - INTERVAL '7 day'), 0)
  INTO v_week_best, v_week_current
  FROM runs;

  WITH days AS (
    SELECT DISTINCT call_date AS d
    FROM public.daily_calls
    WHERE user_id = p_user_id
  ),
  islands AS (
    SELECT
      d,
      (d - ((ROW_NUMBER() OVER (ORDER BY d))::int * INTERVAL '1 day'))::date AS grp
    FROM days
  ),
  runs AS (
    SELECT grp, COUNT(*)::int AS run_len, MAX(d) AS last_d
    FROM islands
    GROUP BY grp
  )
  SELECT
    COALESCE(MAX(run_len), 0),
    COALESCE(MAX(run_len) FILTER (WHERE last_d >= v_today - INTERVAL '1 day'), 0)
  INTO v_day_best, v_day_current
  FROM runs;

  RETURN json_build_object(
    'weekly_session_streak_current', v_week_current,
    'weekly_session_streak_best',    v_week_best,
    'daily_call_streak_current',     v_day_current,
    'daily_call_streak_best',        v_day_best
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_streaks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_streaks(uuid) TO authenticated, service_role;

COMMIT;
