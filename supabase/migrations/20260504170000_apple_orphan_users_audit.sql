-- supabase/migrations/20260504170000_apple_orphan_users_audit.sql
--
-- Audit view: auth.users rows flagged as Apple sign-ins that have NO matching
-- row in auth.identities. By construction these rows cannot authenticate
-- (no provider link), but they retain a session, last_sign_in_at, and
-- (sometimes) NULL email — so they pollute user counts and break joins.
--
-- Known case 2026-05-01: user_id 612ecffe-…-87f5 was created 60ms before
-- Supabase recognized the Apple sub already belonged to user d053d48b-…-9d09
-- (a Google-primary account that had previously linked Apple). The new
-- auth.identities row was attached to d053d48b; 612ecffe was left orphaned.
--
-- This view is the more accurate detector than "duplicate sub in auth.users":
-- it queries auth.identities, the canonical OIDC store, instead of relying on
-- raw_user_meta_data->>'sub' (which is shared by every OIDC provider).
--
-- Service-role only — exposes user PII.

BEGIN;

CREATE OR REPLACE VIEW public.auth_apple_orphan_users
WITH (security_invoker = true)
AS
SELECT
  u.id AS user_id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  u.raw_app_meta_data->>'provider' AS primary_provider,
  u.raw_app_meta_data->'providers' AS providers_list,
  u.raw_user_meta_data->>'iss' AS iss,
  u.raw_user_meta_data->>'sub' AS apple_sub
FROM auth.users u
WHERE u.raw_user_meta_data->>'iss' LIKE '%appleid%'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );

COMMENT ON VIEW public.auth_apple_orphan_users IS
'Audit: auth.users rows flagged as Apple OIDC sign-ins (iss=appleid.apple.com) that have NO row in auth.identities. Expected count: 0. Non-zero indicates Supabase OAuth identity-resolution drift, typically when an Apple sub is recognized as an existing linked identity *after* a new auth.users row has already been created (and not cleaned up). Admin-only — exposes user emails.';

GRANT SELECT ON public.auth_apple_orphan_users TO service_role;
REVOKE ALL ON public.auth_apple_orphan_users FROM anon, authenticated, public;

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM public.auth_apple_orphan_users;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'APPLE SIGN-IN ORPHAN AUDIT';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Apple-flagged auth.users with no identity row: %', orphan_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: 0. Non-zero values indicate identity drift.';
  RAISE NOTICE 'Inspect: SELECT * FROM auth_apple_orphan_users;';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;

COMMIT;
