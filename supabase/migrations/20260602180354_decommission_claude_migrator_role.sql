BEGIN;

-- Decommission the deprecated agent migration role. It could not read Supabase
-- migration tracking or own/alter production objects. Its auth.users grants
-- are owned by supabase_auth_admin, so the production owner connection cannot
-- drop the role outright; instead remove the usable role name and login.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claude_migrator') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM claude_migrator';
    EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA public FROM claude_migrator';
    EXECUTE 'ALTER ROLE claude_migrator NOLOGIN';
    EXECUTE 'ALTER ROLE claude_migrator RENAME TO deprecated_claude_migrator_20260602';
    EXECUTE $comment$COMMENT ON ROLE deprecated_claude_migrator_20260602 IS
      'Deprecated Quiver migration role. Login disabled and public grants revoked by migration 20260602180354; auth.users grants remain under supabase_auth_admin.'$comment$;
  END IF;
END $$;

COMMIT;
