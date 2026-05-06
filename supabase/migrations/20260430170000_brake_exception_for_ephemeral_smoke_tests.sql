-- Amends prevent_delete_on_protected() (defined in
-- 20250825000000_create_claude_migrator_and_delete_brakes.sql) to allow two
-- specific deletion paths without requiring app.allow_destructive=on:
--
--   1. auth.users rows tagged with `app_metadata.is_ephemeral_smoke_test = true`.
--      The marker is set by signUpEphemeral() in e2e/helpers/onboarding-flow.ts
--      via the service-role admin API. `app_metadata` is server-controlled —
--      it cannot be set via public signup, so a real user can never carry it.
--
--   2. public.profiles rows whose corresponding auth.users row no longer
--      exists (orphans). Profiles has no FK to auth.users in this schema, so
--      deleting an auth user leaves a dangling profile. Once the user side is
--      gone, the profile is by definition not associated with any account
--      and is safe to clean up.
--
-- The DBA escape hatch (set app.allow_destructive=on) is preserved unchanged
-- for all other DELETE paths.
--
-- Why this matters: Playwright global-teardown calls
-- supabase.auth.admin.deleteUser() to sweep ephemeral test users at the end
-- of every run. Today the brake silently blocks every delete and leaks
-- accumulate forever. This amendment closes the loop without weakening the
-- protection for real users.

BEGIN;

CREATE OR REPLACE FUNCTION prevent_delete_on_protected()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Allow ephemeral-smoke-test users to be deleted regardless of the
  -- destructive flag. Marker is server-only (app_metadata).
  IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
    IF (OLD.raw_app_meta_data->>'is_ephemeral_smoke_test')::boolean IS TRUE THEN
      RETURN OLD;
    END IF;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'profiles' THEN
    -- Orphan profiles (auth.users row already deleted) are always safe.
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.id) THEN
      RETURN OLD;
    END IF;
  END IF;

  -- Existing escape hatch: explicit DBA flag inside a transaction.
  IF current_setting('app.allow_destructive', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DELETE blocked on % (user=%). Set app.allow_destructive=on inside a transaction if you truly need to proceed.',
      TG_TABLE_NAME, current_user;
  END IF;
  RETURN OLD;
END;
$$;

-- Orphan-profile sweep RPC. Server-side filter avoids round-trips and prevents
-- the "profile delete failed mid-sweep -> auth row gone -> orphan invisible to
-- listUsers() -> permanent leak" failure mode flagged in code review.
--
-- Deletes profiles whose:
--   - email matches the smoke-test pattern, AND
--   - corresponding auth.users row no longer exists.
--
-- The orphan check is enforced both here (as the WHERE clause) and by the
-- amended trigger above (which double-checks at row level). Returns the count
-- so callers can log/track sweep effectiveness.
--
-- SECURITY DEFINER: runs as the migration owner so it bypasses RLS without
-- requiring the caller to be service_role. Marked STABLE-incompatible (it
-- writes), so no STABLE modifier.
CREATE OR REPLACE FUNCTION cleanup_orphan_smoke_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.profiles p
    WHERE p.email LIKE 'smoke+%@quiversurf.test'
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- Lock down execution: only service_role and postgres can call. Tests use the
-- service-role key, so this matches existing access patterns. Anon and
-- authenticated cannot reach it.
REVOKE ALL ON FUNCTION cleanup_orphan_smoke_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_orphan_smoke_profiles() TO service_role;

COMMIT;
