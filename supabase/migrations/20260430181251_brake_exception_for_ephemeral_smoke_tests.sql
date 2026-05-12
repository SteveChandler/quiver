-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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

CREATE OR REPLACE FUNCTION prevent_delete_on_protected()
RETURNS trigger
LANGUAGE plpgsql AS $$
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
CREATE OR REPLACE FUNCTION cleanup_orphan_smoke_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

REVOKE ALL ON FUNCTION cleanup_orphan_smoke_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_orphan_smoke_profiles() TO service_role;
