#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DEFAULT_MIGRATION =
  "supabase/migrations/20260521120000_supabase_advisor_cleanup.sql";

function parseArgs(argv) {
  const options = {
    migration: DEFAULT_MIGRATION,
    databaseUrl: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL,
    psql: process.env.PSQL_BIN || "psql",
    keepSql: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--migration") {
      options.migration = argv[++i];
    } else if (arg === "--database-url") {
      options.databaseUrl = argv[++i];
    } else if (arg === "--psql") {
      options.psql = argv[++i];
    } else if (arg === "--keep-sql") {
      options.keepSql = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function stripMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const firstStatementIndex = lines.findIndex((line) => line.trim() === "BEGIN;");
  const lastCommitIndex = lines.findLastIndex((line) => line.trim() === "COMMIT;");

  if (firstStatementIndex === -1 || lastCommitIndex === -1 || lastCommitIndex <= firstStatementIndex) {
    throw new Error("Migration must contain top-level BEGIN; and COMMIT; lines");
  }

  return [
    ...lines.slice(0, firstStatementIndex),
    ...lines.slice(firstStatementIndex + 1, lastCommitIndex),
    ...lines.slice(lastCommitIndex + 1),
  ].join("\n");
}

function buildRollbackValidationSql(migrationBody) {
  return String.raw`
\set ON_ERROR_STOP on

CREATE TEMP TABLE advisor_cleanup_baseline AS
WITH target_storage_policies AS (
  SELECT unnest(ARRAY[
    'Avatar images are publicly readable',
    'Beach photos are publicly readable',
    'Public read access for diorama videos',
    'Intel photos are publicly readable',
    'Public can read ML artifacts',
    'Session media are publicly readable'
  ]) AS policyname
),
snapshot AS (
  SELECT
    'profiles_with_home_beach_reloptions' AS key,
    COALESCE((
      SELECT array_to_string(c.reloptions, ',')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles_with_home_beach'
    ), '<missing>') AS value
  UNION ALL
  SELECT
    'public_extensions',
    COALESCE((
      SELECT string_agg(e.extname, ',' ORDER BY e.extname)
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname IN ('pg_trgm', 'unaccent', 'postgis')
        AND n.nspname = 'public'
    ), '')
  UNION ALL
  SELECT
    'broad_storage_policies',
    COALESCE((
      SELECT string_agg(p.policyname, ',' ORDER BY p.policyname)
      FROM pg_policies p
      JOIN target_storage_policies t ON t.policyname = p.policyname
      WHERE p.schemaname = 'storage'
        AND p.tablename = 'objects'
    ), '')
  UNION ALL
  SELECT
    'anon_security_definer_execute_count',
    (
      SELECT count(*)::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    )
)
SELECT * FROM snapshot;

BEGIN;

${migrationBody}

DO $$
DECLARE
  failing_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles_with_home_beach'
      AND COALESCE(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'profiles_with_home_beach is not security_invoker';
  END IF;

  SELECT count(*) INTO failing_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'Avatar images are publicly readable',
      'Beach photos are publicly readable',
      'Public read access for diorama videos',
      'Intel photos are publicly readable',
      'Public can read ML artifacts',
      'Session media are publicly readable'
    );
  IF failing_count > 0 THEN
    RAISE EXCEPTION 'broad storage listing policies remain: %', failing_count;
  END IF;

  SELECT count(*) INTO failing_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      JOIN pg_extension e ON e.oid = d.refobjid
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF failing_count > 0 THEN
    RAISE EXCEPTION 'anon can still execute SECURITY DEFINER function(s): %', failing_count;
  END IF;

  SELECT count(*) INTO failing_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      JOIN pg_extension e ON e.oid = d.refobjid
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(value)
      WHERE config.value LIKE 'search_path=%'
    );
  IF failing_count > 0 THEN
    RAISE EXCEPTION 'public function(s) still have mutable search_path: %', failing_count;
  END IF;

  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    SELECT count(*) INTO failing_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'spatial_ref_sys'
      AND c.relrowsecurity = false;
    IF failing_count > 0 THEN
      RAISE NOTICE 'public.spatial_ref_sys still lacks RLS; resolve through PostGIS relocation/support if the migration role cannot alter the extension-owned table';
    END IF;
  END IF;

  IF to_regclass('public.beach_dioramas') IS NOT NULL THEN
    SELECT count(*) INTO failing_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'beach_dioramas'
      AND c.relrowsecurity = false;
    IF failing_count > 0 THEN
      RAISE EXCEPTION 'public.beach_dioramas exists without RLS';
    END IF;
  END IF;

  IF to_regclass('public.dev_session_mutation_audit') IS NOT NULL THEN
    SELECT count(*) INTO failing_count
    WHERE has_table_privilege('anon', 'public.dev_session_mutation_audit', 'SELECT')
       OR has_table_privilege('authenticated', 'public.dev_session_mutation_audit', 'SELECT');
    IF failing_count > 0 THEN
      RAISE EXCEPTION 'dev_session_mutation_audit remains client-readable';
    END IF;
  END IF;

  SELECT count(*) INTO failing_count
  FROM (VALUES
    ('observable_beaches'),
    ('beach_ml_performance_baseline'),
    ('mv_beach_amenities')
  ) AS target(name)
  WHERE to_regclass(format('public.%I', target.name)) IS NOT NULL
    AND (
      has_table_privilege('anon', format('public.%I', target.name), 'SELECT')
      OR has_table_privilege('authenticated', format('public.%I', target.name), 'SELECT')
    );
  IF failing_count > 0 THEN
    RAISE EXCEPTION 'materialized view(s) still exposed to anon/authenticated: %', failing_count;
  END IF;
END $$;

ROLLBACK;

CREATE TEMP TABLE advisor_cleanup_after_rollback AS
WITH target_storage_policies AS (
  SELECT unnest(ARRAY[
    'Avatar images are publicly readable',
    'Beach photos are publicly readable',
    'Public read access for diorama videos',
    'Intel photos are publicly readable',
    'Public can read ML artifacts',
    'Session media are publicly readable'
  ]) AS policyname
),
snapshot AS (
  SELECT
    'profiles_with_home_beach_reloptions' AS key,
    COALESCE((
      SELECT array_to_string(c.reloptions, ',')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles_with_home_beach'
    ), '<missing>') AS value
  UNION ALL
  SELECT
    'public_extensions',
    COALESCE((
      SELECT string_agg(e.extname, ',' ORDER BY e.extname)
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname IN ('pg_trgm', 'unaccent', 'postgis')
        AND n.nspname = 'public'
    ), '')
  UNION ALL
  SELECT
    'broad_storage_policies',
    COALESCE((
      SELECT string_agg(p.policyname, ',' ORDER BY p.policyname)
      FROM pg_policies p
      JOIN target_storage_policies t ON t.policyname = p.policyname
      WHERE p.schemaname = 'storage'
        AND p.tablename = 'objects'
    ), '')
  UNION ALL
  SELECT
    'anon_security_definer_execute_count',
    (
      SELECT count(*)::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    )
)
SELECT * FROM snapshot;

DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM advisor_cleanup_baseline EXCEPT SELECT * FROM advisor_cleanup_after_rollback)
    UNION ALL
    (SELECT * FROM advisor_cleanup_after_rollback EXCEPT SELECT * FROM advisor_cleanup_baseline)
  ) THEN
    RAISE EXCEPTION 'rollback did not restore advisor cleanup baseline snapshot';
  END IF;
END $$;

SELECT 'rollback validation passed' AS status;
`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.databaseUrl) {
    throw new Error(
      "Set POSTGRES_URL_NON_POOLING or DATABASE_URL, or pass --database-url",
    );
  }

  const migrationPath = resolve(process.cwd(), options.migration);
  const migrationSql = readFileSync(migrationPath, "utf8");
  const migrationBody = stripMigrationTransaction(migrationSql);
  const validationSql = buildRollbackValidationSql(migrationBody);
  const tmpDir = mkdtempSync(join(tmpdir(), "quiver-advisor-rollback-"));
  const sqlPath = join(tmpDir, "rollback-validate-advisor-cleanup.sql");
  writeFileSync(sqlPath, validationSql);

  const result = spawnSync(options.psql, [options.databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    encoding: "utf8",
    stdio: "inherit",
  });

  if (options.keepSql) {
    console.log(`Validation SQL kept at ${sqlPath}`);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main();
