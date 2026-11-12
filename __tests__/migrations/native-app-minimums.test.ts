import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261112200000_create_native_app_minimums.sql",
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("native_app_minimums migration", () => {
  it("creates one constrained row per platform and ships both rows dark", () => {
    const sql = readMigration();

    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.native_app_minimums/);
    expect(sql).toMatch(/platform text PRIMARY KEY/);
    expect(sql).toMatch(/CHECK \(platform IN \('ios', 'android'\)\)/);
    expect(sql).toMatch(/CHECK \(minimum_version ~ '\^\\d\+\(\\\.\\d\+\)\{0,3\}\$'\)/);
    expect(sql).toMatch(/minimum_bundle_created_at timestamptz,/);
    expect(sql).toMatch(/VALUES \('ios', NULL, NULL\), \('android', NULL, NULL\)\s+ON CONFLICT \(platform\) DO NOTHING/);
  });

  it("gives clients reads only, through RLS, and creates no function", () => {
    const sql = readMigration();

    expect(sql).toMatch(/ALTER TABLE public\.native_app_minimums ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/FOR SELECT\s+TO anon, authenticated\s+USING \(true\)/);
    expect(sql).toMatch(/REVOKE ALL ON public\.native_app_minimums FROM anon, authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON public\.native_app_minimums TO anon, authenticated;/);
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*TO[^;]*(anon|authenticated)/i);
    expect(sql).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/i);
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/i);
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
    expect(sql).not.toMatch(/\b(DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
