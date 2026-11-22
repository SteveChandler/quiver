import { readFileSync } from "node:fs";
import path from "node:path";

const filename = "20261122054000_index_ml_predictions_cleanup";
const indexName = "idx_ml_predictions_log_created_at_id";

function normalizeSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSql(directory: "migrations" | "rollbacks", file: string): string {
  return normalizeSql(
    readFileSync(path.join(process.cwd(), "supabase", directory, `${file}.sql`), "utf8"),
  );
}

const migration = readSql("migrations", filename);
const rollback = readSql("rollbacks", `${filename}_rollback`);
const original = readSql(
  "migrations",
  "20260808210000_exempt_trusted_applications_from_ml_retention",
);
const flagCheck = "IF current_setting('app.ml_predictions_keyset_cleanup_enabled', true) = 'on' THEN";
const keysetPath = migration.slice(migration.indexOf(flagCheck), migration.indexOf(" ELSE LOOP"));

describe("ML predictions retention migration", () => {
  it("builds a valid index in seek order outside the function transaction", () => {
    expect(migration.startsWith(normalizeSql(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
        ON public.ml_predictions_log (created_at, id);
      BEGIN;
    `))).toBe(true);
    expect(migration).toContain(`indexrelid = 'public.${indexName}'::regclass`);
    expect(migration).toContain("AND indisvalid");
  });

  it("keeps the existing cleanup as the default and preserves function privileges", () => {
    expect(migration).toContain(normalizeSql(`
      CREATE OR REPLACE FUNCTION public.cleanup_old_ml_predictions()
      RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    `));
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.cleanup_old_ml_predictions() FROM PUBLIC;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.cleanup_old_ml_predictions() TO service_role;");
    expect(migration).toMatch(/retention_cutoff CONSTANT timestamptz := NOW\(\) - INTERVAL '30 days';/);
    expect(keysetPath).toContain(flagCheck);
    expect(migration).toContain(normalizeSql(`
      ELSE
        LOOP
          DELETE FROM public.ml_predictions_log
          WHERE id IN (
            SELECT id FROM public.ml_predictions_log
            WHERE created_at < retention_cutoff
              AND NOT EXISTS (
                SELECT 1
                FROM public.trusted_forecast_applications application
                WHERE application.prediction_snapshot_id = ml_predictions_log.id
              )
            LIMIT batch_size
          );
    `));
  });

  it("advances through bounded, timestamp-tied pages even when a full page deletes zero rows", () => {
    expect(migration).toContain("batch_size CONSTANT integer := 10000;");
    expect(keysetPath).toContain(normalizeSql(`
      WHERE log.created_at < retention_cutoff
        AND (log.created_at, log.id) >= (last_created_at, last_id)
      ORDER BY log.created_at, log.id
      LIMIT batch_size
    `));
    expect(keysetPath).toContain(normalizeSql(`
      INTO candidate_ids, last_created_at, last_id
      FROM candidates page_end
      ORDER BY page_end.created_at DESC, page_end.id DESC
      LIMIT 1;
    `));
    expect(keysetPath).toContain("EXIT WHEN NOT FOUND;");
    expect(keysetPath).toContain("EXIT WHEN cardinality(candidate_ids) < batch_size;");
    expect(keysetPath).not.toContain("EXIT WHEN batch_deleted");
  });

  it("deletes only expired, unreferenced candidates and returns the actual deletion count", () => {
    expect(keysetPath).toContain(normalizeSql(`
      DELETE FROM public.ml_predictions_log log
      WHERE log.id = ANY(candidate_ids)
        AND log.created_at < retention_cutoff
        AND NOT EXISTS (
          SELECT 1
          FROM public.trusted_forecast_applications application
          WHERE application.prediction_snapshot_id = log.id
        );
      GET DIAGNOSTICS batch_deleted = ROW_COUNT;
      deleted_count := deleted_count + batch_deleted;
    `));
    expect(migration).toContain("RETURN deleted_count;");
  });

  it("restores the prior function and grants before dropping the new index", () => {
    const originalFunction = original.match(
      /CREATE OR REPLACE FUNCTION .*?GRANT EXECUTE ON FUNCTION cleanup_old_ml_predictions\(\) TO service_role;/,
    )?.[0];
    const qualifiedFunction = originalFunction?.replaceAll(
      "FUNCTION cleanup_old_ml_predictions()",
      "FUNCTION public.cleanup_old_ml_predictions()",
    );
    expect(rollback).toBe(
      `BEGIN; ${qualifiedFunction} COMMIT; DROP INDEX CONCURRENTLY IF EXISTS public.${indexName};`,
    );
  });
});
