-- Add an idempotent SECURITY DEFINER initializer for authenticated XP reads.
-- The XP hardening migration removed direct client writes to user_xp; read paths
-- still need a safe way to create the zero-XP row for legitimate users.
BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_user_xp(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ensure_user_xp: p_user_id is required';
  END IF;

  IF auth.uid() IS NULL THEN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'ensure_user_xp: caller must be authenticated';
    END IF;
  ELSIF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ensure_user_xp: caller may only initialize XP for self';
  END IF;

  INSERT INTO public.user_xp (user_id, xp_total, level)
  VALUES (p_user_id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_xp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_xp(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.ensure_user_xp(uuid)
  IS 'Idempotent SECURITY DEFINER initializer for user_xp zero rows; authenticated users may initialize only themselves.';

COMMIT;
