-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Service-role release gate for Apple Sign-In orphan auth rows.
--
-- `auth_apple_orphan_users` intentionally exposes PII and stays locked down.
-- This SECURITY DEFINER count function gives release automation a narrow,
-- non-PII check that can still read auth.users/auth.identities.

BEGIN;

CREATE OR REPLACE FUNCTION public.count_auth_apple_orphan_users()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'iss' LIKE '%appleid%'
    AND NOT EXISTS (
      SELECT 1
      FROM auth.identities i
      WHERE i.user_id = u.id
    );
$$;

COMMENT ON FUNCTION public.count_auth_apple_orphan_users() IS
'Release audit gate: counts Apple OIDC auth.users rows with no auth.identities row. Expected value before mobile release: 0. Service-role only; returns no PII.';

REVOKE ALL ON FUNCTION public.count_auth_apple_orphan_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_auth_apple_orphan_users() TO service_role;

COMMIT;
