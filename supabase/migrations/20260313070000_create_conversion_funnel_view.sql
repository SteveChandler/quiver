-- Conversion Funnel Dashboard
-- Creates an RPC function that returns the signup conversion funnel metrics
-- from anonymous_sessions -> cta_views -> cta_clicks -> auth_modal_opens ->
-- signup_starts -> signup_completes -> onboarding_completes.
--
-- Filters out bot-flagged events. Supports date range filtering.
-- Queryable via Supabase client: supabase.rpc('get_conversion_funnel', { days: 7 })
--
-- ROLLBACK INSTRUCTIONS:
--   DROP FUNCTION IF EXISTS public.get_conversion_funnel(INTEGER);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_conversion_funnel(days INTEGER DEFAULT 7)
RETURNS TABLE (
  funnel_step TEXT,
  step_order INTEGER,
  total_count BIGINT,
  unique_sessions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff TIMESTAMPTZ;
BEGIN
  cutoff := NOW() - (days || ' days')::INTERVAL;

  RETURN QUERY
  WITH funnel_events AS (
    SELECT
      event_type,
      COALESCE(session_id::text, user_id::text) AS identity_key
    FROM public.user_events
    WHERE created_at >= cutoff
      AND (bot_flagged IS NULL OR bot_flagged = false)
  )
  SELECT
    s.step_name AS funnel_step,
    s.step_order,
    COALESCE(f.total_count, 0) AS total_count,
    COALESCE(f.unique_sessions, 0) AS unique_sessions
  FROM (
    VALUES
      ('anonymous_sessions', 1),
      ('cta_views', 2),
      ('cta_clicks', 3),
      ('auth_modal_opens', 4),
      ('signup_starts', 5),
      ('signup_completes', 6),
      ('onboarding_completes', 7)
  ) AS s(step_name, step_order)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_count,
      COUNT(DISTINCT fe.identity_key) AS unique_sessions
    FROM funnel_events fe
    WHERE
      CASE s.step_name
        -- Any event from an anonymous session = anonymous session
        WHEN 'anonymous_sessions' THEN fe.event_type IN (
          'page_view', 'beach_view', 'tab_view', 'forecast_interaction',
          'beach_search', 'map_interaction', 'map_marker_click',
          'signup_cta_view', 'signup_cta_click', 'signin_cta_click',
          'auth_modal_opened', 'auth_method_selected',
          'signup_started', 'signup_success', 'login_success'
        )
        WHEN 'cta_views' THEN fe.event_type = 'signup_cta_view'
        WHEN 'cta_clicks' THEN fe.event_type IN ('signup_cta_click', 'signin_cta_click', 'cta_click')
        WHEN 'auth_modal_opens' THEN fe.event_type = 'auth_modal_opened'
        WHEN 'signup_starts' THEN fe.event_type = 'signup_started'
        WHEN 'signup_completes' THEN fe.event_type = 'signup_success'
        WHEN 'onboarding_completes' THEN fe.event_type = 'onboarding_step'
          AND fe.identity_key IN (
            SELECT p.id::text FROM public.profiles p
            WHERE p.onboarding_completed_at IS NOT NULL
              AND p.onboarding_completed_at >= cutoff
          )
        ELSE false
      END
  ) f ON true
  ORDER BY s.step_order;
END;
$$;

COMMENT ON FUNCTION public.get_conversion_funnel(INTEGER) IS
  'Returns the signup conversion funnel metrics for the past N days. '
  'Steps: anonymous_sessions -> cta_views -> cta_clicks -> auth_modal_opens -> '
  'signup_starts -> signup_completes -> onboarding_completes. '
  'Excludes bot-flagged events.';

-- Allow authenticated users (admins) to call this function
GRANT EXECUTE ON FUNCTION public.get_conversion_funnel(INTEGER) TO authenticated;

COMMIT;
