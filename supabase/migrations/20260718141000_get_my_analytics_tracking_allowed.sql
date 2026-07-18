BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_analytics_tracking_allowed(
  p_expected_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL
      OR (SELECT auth.uid()) <> p_expected_user_id
      THEN false
    ELSE COALESCE(
      (
        SELECT p.allow_implicit_tracking
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.id = p_expected_user_id
      ),
      true
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_my_analytics_tracking_allowed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_analytics_tracking_allowed(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_analytics_tracking_allowed(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_my_analytics_tracking_allowed(uuid) IS
  'Returns analytics consent only for the authenticated profile selected by auth.uid(); defaults to the schema default when the profile is still bootstrapping.';

COMMIT;
