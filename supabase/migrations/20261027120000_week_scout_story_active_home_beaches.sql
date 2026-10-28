BEGIN;

CREATE FUNCTION public.week_scout_story_active_home_beaches(p_region text)
RETURNS TABLE (beach_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT b.id
  FROM public.beaches b
  JOIN public.profiles p ON p.home_beach_id = b.id
  WHERE b.region = p_region AND b.deleted_at IS NULL
    AND p.is_mock IS NOT TRUE AND p.is_system_account IS NOT TRUE AND (
      EXISTS (
        SELECT 1 FROM public.user_events e
        WHERE e.user_id = p.id AND e.created_at >= now() - interval '30 days'
          AND e.bot_flagged IS NOT TRUE
      ) OR EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = p.id
          AND u.last_sign_in_at >= now() - interval '30 days'
      )
    );
$$;
REVOKE ALL ON FUNCTION public.week_scout_story_active_home_beaches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.week_scout_story_active_home_beaches(text) TO service_role;

COMMIT;
