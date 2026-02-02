-- Migration: Create RPC function to find re-engagement email candidates
-- Part of re-engagement email system for inactive users
--
-- Finds users who:
-- 1. Have a home beach with good conditions today (score >= threshold)
-- 2. Haven't been active in N days (no sessions)
-- 3. Haven't received a re-engagement email in M hours
-- 4. Haven't received ANY email in the last X hours (global rate limit)

BEGIN;

CREATE OR REPLACE FUNCTION public.get_reengagement_email_candidates(
  p_inactive_days int DEFAULT 7,
  p_min_score int DEFAULT 7,
  p_dedupe_hours int DEFAULT 72,
  p_global_cooldown_hours int DEFAULT 48
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
  wind_description text,
  best_window_start time,
  best_window_end time,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dedupe_threshold timestamptz;
  v_global_threshold timestamptz;
  v_inactive_threshold timestamptz;
BEGIN
  v_dedupe_threshold := NOW() - (p_dedupe_hours || ' hours')::interval;
  v_global_threshold := NOW() - (p_global_cooldown_hours || ' hours')::interval;
  v_inactive_threshold := NOW() - (p_inactive_days || ' days')::interval;

  RETURN QUERY
  WITH
  -- Get users who are inactive (no sessions in N days)
  inactive_users AS (
    SELECT p.id AS user_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
      -- No sessions in the inactive period
      AND NOT EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.user_id = p.id
          AND s.arrival_time > v_inactive_threshold
      )
  ),
  -- Get latest intel for each home beach
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
    WHERE bdi.forecast_date = CURRENT_DATE
      AND bdi.conditions_score >= p_min_score
    ORDER BY bdi.beach_id, bdi.generated_at DESC
  ),
  -- Filter out users who received reengagement email recently
  dedupe_filtered AS (
    SELECT iu.user_id
    FROM inactive_users iu
    WHERE NOT EXISTS (
      SELECT 1 FROM forecast_alert_deliveries fad
      WHERE fad.user_id = iu.user_id
        AND fad.alert_type = 'reengagement'
        AND fad.last_sent_at > v_dedupe_threshold
    )
  ),
  -- Filter out users who received ANY email recently (global rate limit)
  global_filtered AS (
    SELECT df.user_id
    FROM dedupe_filtered df
    WHERE NOT EXISTS (
      SELECT 1 FROM forecast_alert_deliveries fad
      WHERE fad.user_id = df.user_id
        AND fad.last_sent_at > v_global_threshold
    )
  )
  SELECT
    p.id AS user_id,
    p.email,
    p.display_name,
    p.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    li.conditions_score::int,
    li.surf_description,
    li.wind_description,
    li.best_window_start,
    li.best_window_end,
    li.recommendation
  FROM global_filtered gf
  JOIN profiles p ON p.id = gf.user_id
  JOIN beaches b ON b.id = p.home_beach_id
  JOIN latest_intel li ON li.beach_id = p.home_beach_id;
END;
$$;

COMMENT ON FUNCTION public.get_reengagement_email_candidates IS
  'Returns inactive users whose home beach has good conditions today. Respects per-type and global email rate limits.';

-- Grant execute to service_role (used by cron jobs)
GRANT EXECUTE ON FUNCTION public.get_reengagement_email_candidates TO service_role;

COMMIT;
