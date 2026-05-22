\set ON_ERROR_STOP on

-- Paired rollback for scripts/db/extension-relocation-apply.sql.
-- Run only if the relocatable extension apply step must be undone.

BEGIN;

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
      AND n.nspname = 'extensions';

    IF is_relocatable IS NULL THEN
      CONTINUE;
    END IF;

    IF is_relocatable = false THEN
      RAISE EXCEPTION 'Extension % is installed in extensions but is not relocatable', ext_name;
    END IF;

    EXECUTE format('ALTER EXTENSION %I SET SCHEMA public', ext_name);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
