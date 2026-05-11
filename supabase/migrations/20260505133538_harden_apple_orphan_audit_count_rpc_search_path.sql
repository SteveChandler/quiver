-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Harden the Apple orphan audit RPC search path after production creation.

BEGIN;

ALTER FUNCTION public.count_auth_apple_orphan_users()
SET search_path = auth, pg_catalog;

COMMIT;
