BEGIN;

-- ============================================================================
-- Migration: Add Conditions Alert Email System
-- Created: 2026-02-10
-- Description:
--   1. Expands CHECK constraints for new email types (conditions_alert, session_prompt)
--   2. Adds get_conditions_alert_candidates RPC for high-score morning alerts
--   3. Adds get_session_prompt_candidates RPC for post-good-day session prompts
-- ============================================================================

-- ============================================================================
-- 1. EXPAND CHECK CONSTRAINTS
-- ============================================================================

-- Add 'conditions_alert' and 'session_prompt' to email_send_log.email_type
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_email_type_check;

ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_email_type_check
  CHECK (email_type IN (
    'welcome',
    'forecast_digest',
    'reengagement',
    'weekly_recap',
    'conditions_alert',
    'session_prompt'
  ));

COMMENT ON CONSTRAINT email_send_log_email_type_check ON public.email_send_log IS
  'Allowed email types: welcome, forecast_digest, reengagement, weekly_recap, conditions_alert (high score morning alerts), session_prompt (post-good-day session reminder)';

-- Add 'conditions_alert', 'session_prompt', and 'reengagement' to forecast_alert_deliveries.alert_type
ALTER TABLE public.forecast_alert_deliveries
  DROP CONSTRAINT IF EXISTS forecast_alert_deliveries_alert_type_check;

ALTER TABLE public.forecast_alert_deliveries
  ADD CONSTRAINT forecast_alert_deliveries_alert_type_check
  CHECK (alert_type IN (
    'forecast_threshold',
    'daily_digest_email',
    'conditions_alert',
    'session_prompt',
    'reengagement'
  ));

COMMENT ON CONSTRAINT forecast_alert_deliveries_alert_type_check ON public.forecast_alert_deliveries IS
  'Allowed alert types: forecast_threshold, daily_digest_email, conditions_alert, session_prompt, reengagement';

-- ============================================================================
-- 2. CREATE get_conditions_alert_candidates RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_conditions_alert_candidates(
  p_min_score int DEFAULT 7
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
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
      p.home_beach_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
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
    WHERE bdi.forecast_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  active_today_filter AS (
    SELECT eu.id, eu.email, eu.display_name, eu.home_beach_id
    FROM eligible_users eu
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_events ue
      WHERE ue.user_id = eu.id
        AND ue.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AT TIME ZONE 'America/Los_Angeles'
    )
  ),
  email_dedup AS (
    SELECT atf.id, atf.email, atf.display_name, atf.home_beach_id
    FROM active_today_filter atf
    WHERE NOT EXISTS (
      SELECT 1
      FROM email_send_log esl
      WHERE esl.user_id = atf.id
        AND esl.sent_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AT TIME ZONE 'America/Los_Angeles'
    )
  )
  SELECT
    ed.id AS user_id,
    ed.email,
    ed.display_name,
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
  'Returns users eligible for conditions alert emails based on high beach_daily_intel scores today. Excludes users active in app today or who received any email today.';

GRANT EXECUTE ON FUNCTION public.get_conditions_alert_candidates(int) TO service_role;

-- ============================================================================
-- 3. CREATE get_session_prompt_candidates RPC
-- ============================================================================

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
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
  ),
  yesterday_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description
    FROM beach_daily_intel bdi
    WHERE bdi.forecast_date = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles') - INTERVAL '1 day')::date
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  no_session_yesterday AS (
    SELECT eu.id, eu.email, eu.display_name, eu.home_beach_id
    FROM eligible_users eu
    WHERE NOT EXISTS (
      SELECT 1
      FROM sessions s
      WHERE s.user_id = eu.id
        AND s.arrival_time >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles') - INTERVAL '1 day')::date AT TIME ZONE 'America/Los_Angeles'
        AND s.arrival_time < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AT TIME ZONE 'America/Los_Angeles'
    )
  ),
  active_today_filter AS (
    SELECT nsy.id, nsy.email, nsy.display_name, nsy.home_beach_id
    FROM no_session_yesterday nsy
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_events ue
      WHERE ue.user_id = nsy.id
        AND ue.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AT TIME ZONE 'America/Los_Angeles'
    )
  ),
  email_dedup AS (
    SELECT atf.id, atf.email, atf.display_name, atf.home_beach_id
    FROM active_today_filter atf
    WHERE NOT EXISTS (
      SELECT 1
      FROM email_send_log esl
      WHERE esl.user_id = atf.id
        AND esl.sent_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AT TIME ZONE 'America/Los_Angeles'
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
  'Returns users eligible for session prompt emails based on high beach_daily_intel scores yesterday but no logged session. Excludes users active in app today or who received any email today.';

GRANT EXECUTE ON FUNCTION public.get_session_prompt_candidates(int) TO service_role;

COMMIT;
