BEGIN;

DROP FUNCTION IF EXISTS public.get_conditions_alert_candidates(int);

CREATE OR REPLACE FUNCTION public.get_conditions_alert_candidates(
  p_min_score int DEFAULT 7
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  experience_level text,
  home_beach_id uuid,
  beach_name text,
  beach_slug text,
  beach_state text,
  beach_city text,
  conditions_score int,
  surf_description text,
  wind_description text,
  best_window_start time,
  best_window_end time,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH eligible_users AS (
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.experience_level,
      p.home_beach_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
  ),
  users_with_beach AS (
    SELECT
      eu.id,
      eu.email,
      eu.display_name,
      eu.experience_level,
      eu.home_beach_id,
      COALESCE(b.timezone, 'America/Los_Angeles') AS beach_tz
    FROM eligible_users eu
    INNER JOIN beaches b ON b.id = eu.home_beach_id
  ),
  latest_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description,
      bdi.best_window_start,
      bdi.best_window_end,
      bdi.recommendation
    FROM beach_daily_intel bdi
    INNER JOIN users_with_beach uwb ON uwb.home_beach_id = bdi.beach_id
    WHERE bdi.forecast_date = (CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz)::date
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  active_today_filter AS (
    SELECT
      uwb.id,
      uwb.email,
      uwb.display_name,
      uwb.experience_level,
      uwb.home_beach_id,
      uwb.beach_tz
    FROM users_with_beach uwb
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_events ue
      WHERE ue.user_id = uwb.id
        AND ue.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz)::date AT TIME ZONE uwb.beach_tz
    )
  ),
  email_dedup AS (
    SELECT
      atf.id,
      atf.email,
      atf.display_name,
      atf.experience_level,
      atf.home_beach_id
    FROM active_today_filter atf
    WHERE NOT EXISTS (
      SELECT 1
      FROM email_send_log esl
      WHERE esl.user_id = atf.id
        AND esl.sent_at >= (CURRENT_TIMESTAMP AT TIME ZONE atf.beach_tz)::date AT TIME ZONE atf.beach_tz
    )
  )
  SELECT
    ed.id AS user_id,
    ed.email,
    ed.display_name,
    ed.experience_level,
    ed.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    b.state AS beach_state,
    b.city AS beach_city,
    li.conditions_score,
    li.surf_description,
    li.wind_description,
    li.best_window_start,
    li.best_window_end,
    li.recommendation
  FROM email_dedup ed
  INNER JOIN beaches b ON b.id = ed.home_beach_id
  INNER JOIN latest_intel li ON li.beach_id = ed.home_beach_id;
END;
$$;

COMMENT ON FUNCTION public.get_conditions_alert_candidates(int) IS
  'Returns users eligible for conditions alert emails based on high beach_daily_intel scores today, including experience_level for skill-aware re-scoring. Excludes users active in app today or who received any email today. Uses beach-specific timezone for date calculations.';

-- Recreating the function resets its ACL, and Supabase's default privileges
-- re-grant EXECUTE to anon + authenticated. This RPC returns user emails +
-- home beaches and is SECURITY DEFINER, so it must NOT be callable via the
-- anon/authenticated PostgREST roles — only the service-role cron. Re-assert
-- the hardened posture explicitly (matches the pre-migration prod ACL).
REVOKE ALL ON FUNCTION public.get_conditions_alert_candidates(int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_conditions_alert_candidates(int) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
