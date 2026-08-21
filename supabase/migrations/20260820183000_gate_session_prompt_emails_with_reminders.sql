BEGIN;

CREATE OR REPLACE FUNCTION public.get_session_prompt_candidates(
  p_min_score int DEFAULT 7
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  home_beach_id uuid,
  beach_name text,
  beach_slug text,
  conditions_score int,
  surf_description text,
  wind_description text
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
      p.home_beach_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_reminders = true
      AND COALESCE(p.is_mock, false) = false
  ),
  users_with_beach AS (
    SELECT
      eu.id,
      eu.email,
      eu.display_name,
      eu.home_beach_id,
      COALESCE(b.timezone, 'America/Los_Angeles') AS beach_tz
    FROM eligible_users eu
    INNER JOIN beaches b ON b.id = eu.home_beach_id
  ),
  yesterday_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description
    FROM beach_daily_intel bdi
    INNER JOIN users_with_beach uwb ON uwb.home_beach_id = bdi.beach_id
    WHERE bdi.forecast_date = ((CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz) - INTERVAL '1 day')::date
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  no_session_yesterday AS (
    SELECT uwb.id, uwb.email, uwb.display_name, uwb.home_beach_id, uwb.beach_tz
    FROM users_with_beach uwb
    WHERE NOT EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.user_id = uwb.id
        AND s.arrival_time >= ((CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz) - INTERVAL '1 day')::date AT TIME ZONE uwb.beach_tz
        AND s.arrival_time < (CURRENT_TIMESTAMP AT TIME ZONE uwb.beach_tz)::date AT TIME ZONE uwb.beach_tz
    )
  ),
  active_today_filter AS (
    SELECT nsy.id, nsy.email, nsy.display_name, nsy.home_beach_id, nsy.beach_tz
    FROM no_session_yesterday nsy
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_events ue
      WHERE ue.user_id = nsy.id
        AND ue.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE nsy.beach_tz)::date AT TIME ZONE nsy.beach_tz
    )
  ),
  email_dedup AS (
    SELECT atf.id, atf.email, atf.display_name, atf.home_beach_id
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
    ed.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    yi.conditions_score,
    yi.surf_description,
    yi.wind_description
  FROM email_dedup ed
  INNER JOIN beaches b ON b.id = ed.home_beach_id
  INNER JOIN yesterday_intel yi ON yi.beach_id = ed.home_beach_id;
END;
$$;

COMMENT ON FUNCTION public.get_session_prompt_candidates(int) IS
  'Returns users eligible for session prompt emails when email and reminder preferences are enabled, yesterday had a high beach_daily_intel score, and no session was logged. Excludes users active in app today or who received any email today. Uses beach-specific timezone for date calculations.';

COMMIT;
