-- Migration: Create RPC for welcome email candidate selection
-- Used by /api/cron/welcome-email to find users eligible for delayed welcome emails
--
-- Case A (unconfirmed_24h): Signed up 24+ hours ago, never confirmed email
-- Case B (no_home_beach_48h): Confirmed but no home beach after 48 hours

CREATE OR REPLACE FUNCTION public.get_welcome_email_candidates()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  home_beach_id uuid,
  case_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.created_at,
    au.email_confirmed_at,
    p.home_beach_id,
    CASE
      WHEN au.email_confirmed_at IS NULL AND p.created_at < NOW() - INTERVAL '24 hours'
        THEN 'unconfirmed_24h'
      WHEN au.email_confirmed_at IS NOT NULL AND p.home_beach_id IS NULL
        AND p.created_at < NOW() - INTERVAL '48 hours'
        THEN 'no_home_beach_48h'
    END AS case_type
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  LEFT JOIN email_send_log esl ON esl.user_id = p.id AND esl.email_type = 'welcome'
  WHERE p.is_mock = false
    AND p.email IS NOT NULL
    AND esl.id IS NULL
    AND (
      (au.email_confirmed_at IS NULL AND p.created_at < NOW() - INTERVAL '24 hours')
      OR
      (au.email_confirmed_at IS NOT NULL AND p.home_beach_id IS NULL AND p.created_at < NOW() - INTERVAL '48 hours')
    );
END;
$$;
