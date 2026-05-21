\set ON_ERROR_STOP on

-- Separate extension relocation step for relocatable extensions only.
-- Preflight first:
--   psql "$POSTGRES_URL_NON_POOLING" -f scripts/db/extension-relocation-inventory.sql
--
-- PostGIS is intentionally excluded. PostGIS 2.3+ is not normally relocatable
-- with ALTER EXTENSION SET SCHEMA; resolve that warning with a fresh backup and
-- Supabase support-assisted relocation or a drop/recreate/restore plan.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

DO $$
DECLARE
  ext_name text;
  is_relocatable boolean;
BEGIN
  FOREACH ext_name IN ARRAY ARRAY['pg_trgm', 'unaccent'] LOOP
    SELECT e.extrelocatable
    INTO is_relocatable
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = ext_name
      AND n.nspname = 'public';

    IF is_relocatable IS NULL THEN
      CONTINUE;
    END IF;

    IF is_relocatable = false THEN
      RAISE EXCEPTION 'Extension % is installed in public but is not relocatable', ext_name;
    END IF;

    EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
