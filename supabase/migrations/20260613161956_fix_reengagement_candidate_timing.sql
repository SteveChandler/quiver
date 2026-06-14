-- Fix re-engagement candidate timing so recent intel from yesterday can qualify
-- and keep only per-type re-engagement dedupe at candidate selection time.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_reengagement_email_candidates(
  p_inactive_days integer DEFAULT 7,
  p_min_score integer DEFAULT 70,
  p_dedupe_hours integer DEFAULT 72,
  p_global_cooldown_hours integer DEFAULT 48
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  home_beach_id uuid,
  beach_name text,
  beach_slug text,
  conditions_score integer,
  surf_description text,
  wind_description text,
  best_window_start time,
  best_window_end time,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_dedupe_threshold timestamptz;
  v_inactive_threshold timestamptz;
BEGIN
  v_dedupe_threshold := NOW() - (p_dedupe_hours || ' hours')::interval;
  v_inactive_threshold := NOW() - (p_inactive_days || ' days')::interval;

  RETURN QUERY
  WITH
  inactive_users AS (
    SELECT p.id AS user_id
    FROM profiles p
    WHERE p.home_beach_id IS NOT NULL
      AND p.email IS NOT NULL
      AND p.notif_email_enabled = true
      AND p.notif_forecast_alerts = true
      AND COALESCE(p.is_mock, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM sessions s
        WHERE s.user_id = p.id
          AND s.arrival_time > v_inactive_threshold
      )
  ),
  recent_intel AS (
    SELECT DISTINCT ON (bdi.beach_id)
      bdi.beach_id,
      bdi.conditions_score,
      bdi.surf_description,
      bdi.wind_description,
      bdi.best_window_start,
      bdi.best_window_end,
      bdi.recommendation
    FROM beach_daily_intel bdi
    WHERE bdi.forecast_date >= CURRENT_DATE - INTERVAL '1 day'
    ORDER BY bdi.beach_id, bdi.forecast_date DESC, bdi.generated_at DESC
  ),
  latest_intel AS (
    SELECT
      ri.beach_id,
      ri.conditions_score,
      ri.surf_description,
      ri.wind_description,
      ri.best_window_start,
      ri.best_window_end,
      ri.recommendation
    FROM recent_intel ri
    WHERE ri.conditions_score >= p_min_score
  ),
  dedupe_filtered AS (
    SELECT iu.user_id
    FROM inactive_users iu
    WHERE NOT EXISTS (
      SELECT 1
      FROM forecast_alert_deliveries fad
      WHERE fad.user_id = iu.user_id
        AND fad.alert_type = 'reengagement'
        AND fad.last_sent_at > v_dedupe_threshold
    )
  )
  SELECT
    p.id AS user_id,
    p.email,
    p.display_name,
    p.home_beach_id,
    b.name AS beach_name,
    b.slug AS beach_slug,
    li.conditions_score::integer,
    li.surf_description,
    li.wind_description,
    li.best_window_start,
    li.best_window_end,
    li.recommendation
  FROM dedupe_filtered df
  JOIN profiles p ON p.id = df.user_id
  JOIN beaches b ON b.id = p.home_beach_id
  JOIN latest_intel li ON li.beach_id = p.home_beach_id;
END;
$$;

COMMENT ON FUNCTION public.get_reengagement_email_candidates(integer, integer, integer, integer) IS
  'Returns inactive users whose home beach has recent high-scoring conditions. Respects per-type re-engagement dedupe; p_global_cooldown_hours is retained for signature compatibility only.';

REVOKE ALL ON FUNCTION public.get_reengagement_email_candidates(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reengagement_email_candidates(integer, integer, integer, integer) TO service_role;

COMMIT;
