/**
 * @jest-environment node
 *
 * The one test in `__tests__/migrations/` that actually parses SQL.
 *
 * Everything else in this directory reads a migration with `fs.readFileSync` and asserts
 * `toContain(...)`, which is why `20260802162000_detect_apple_orphan_after_sign_in.sql` merged
 * with a `CREATE FUNCTION` that Postgres refuses to compile. See
 * `test-utils/migration-sql-syntax.ts` for how the gate works and
 * `scripts/check-migration-syntax.ts` for the standalone command.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  formatSyntaxErrors,
  listMigrationFiles,
  type MigrationSyntaxReport,
} from "../../test-utils/migration-sql-syntax";

const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations");
const CHECKER = path.join(REPO_ROOT, "scripts/check-migration-syntax.ts");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");

// Booting Postgres-in-WASM and compiling ~900 routine bodies takes ~15s; the suite default is 15s.
jest.setTimeout(180_000);

/**
 * PGlite reaches its WASM bundle via a dynamic `import()`, which Jest's CommonJS VM rejects with
 * "A dynamic import callback was invoked without --experimental-vm-modules". Spawning keeps the
 * flag off the whole unit suite.
 */
function runCheck(migrationsDir: string): MigrationSyntaxReport {
  const result = spawnSync(TSX, [CHECKER, "--json", "--dir", migrationsDir], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (!result.stdout) {
    throw new Error(
      `check-migration-syntax produced no output (status ${result.status}):\n${result.stderr}`
    );
  }
  return JSON.parse(result.stdout) as MigrationSyntaxReport;
}

/** Writes each fixture to a throwaway migrations directory and checks them in one pass. */
function checkFixtures(fixtures: Record<string, string>): MigrationSyntaxReport {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-migration-syntax-"));
  try {
    for (const [name, contents] of Object.entries(fixtures)) {
      fs.writeFileSync(path.join(dir, name), contents);
    }
    return runCheck(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The bug that shipped: `current_user` is a reserved keyword, so it cannot alias a table.
 * `CREATE FUNCTION` aborts with `syntax error at or near "."`.
 */
const RESERVED_ALIAS_SQL = `BEGIN;

CREATE OR REPLACE FUNCTION public.reserved_alias_probe(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  v_created_at timestamptz;
BEGIN
  SELECT current_user.created_at
  INTO v_created_at
  FROM auth.users current_user
  WHERE current_user.id = p_user_id;

  RETURN v_created_at;
END;
$$;

COMMIT;
`;

const FIXED_ALIAS_SQL = RESERVED_ALIAS_SQL.replace(/current_user\b/g, "current_user_row");

const FIXTURES = {
  "20000101000001_reserved_alias.sql": RESERVED_ALIAS_SQL,
  "20000101000002_renamed_alias.sql": FIXED_ALIAS_SQL,
  "20000101000003_broken_statement.sql":
    "BEGIN;\nCREATE TABLE public.busted (id uuid PRIMARY KEY;\nCOMMIT;\n",
  "20000101000004_broken_do_block.sql":
    "BEGIN;\nDO $$\nBEGIN\n  IF true THEN\n    RAISE NOTICE 'x'\n  END IF;\nEND;\n$$;\nCOMMIT;\n",
};

describe("migration SQL syntax gate", () => {
  let report: MigrationSyntaxReport;
  let fixtureReport: MigrationSyntaxReport;

  // Two spawns, not one per test: each pays a fresh Postgres-in-WASM boot.
  beforeAll(() => {
    report = runCheck(MIGRATIONS_DIR);
    fixtureReport = checkFixtures(FIXTURES);
  });

  const fixtureErrors = (file: keyof typeof FIXTURES) =>
    fixtureReport.errors.filter((error) => error.file === file);

  it("parses and compiles every migration in supabase/migrations", () => {
    expect(formatSyntaxErrors(report.errors)).toBe("");
    expect(report.errors).toEqual([]);
  });

  it("actually covers the migration set rather than silently checking nothing", () => {
    // Guards against the gate degrading into a no-op if the parse-tree shape changes.
    expect(report.filesChecked).toBe(listMigrationFiles(MIGRATIONS_DIR).length);
    expect(report.filesChecked).toBeGreaterThan(400);
    expect(report.plpgsqlRoutinesChecked).toBeGreaterThan(300);
    expect(report.doBlocksChecked).toBeGreaterThan(300);

    // Routines whose signature references a type or table the scratch database does not have
    // are reported, not swallowed. Keep this small — a jump means coverage is being lost.
    expect(report.skipped.length).toBeLessThan(report.plpgsqlRoutinesChecked * 0.1);
  });

  it("rejects a reserved word used as a table alias inside a plpgsql body", () => {
    const errors = fixtureErrors("20000101000001_reserved_alias.sql");

    expect(errors).toHaveLength(1);
    expect(errors[0].where).toBe("plpgsql routine body");
    expect(errors[0].message).toContain("syntax error");
  });

  it("accepts the same routine once the alias is renamed", () => {
    expect(fixtureErrors("20000101000002_renamed_alias.sql")).toEqual([]);
    // Both alias fixtures are plpgsql, so the fixed one was compiled rather than skipped.
    expect(fixtureReport.plpgsqlRoutinesChecked).toBe(2);
  });

  it("rejects a top-level statement that Postgres cannot parse", () => {
    const errors = fixtureErrors("20000101000003_broken_statement.sql");

    expect(errors).toHaveLength(1);
    expect(errors[0].where).toBe("file");
  });

  it("rejects a broken DO block body", () => {
    const errors = fixtureErrors("20000101000004_broken_do_block.sql");

    expect(errors).toHaveLength(1);
    expect(errors[0].where).toBe("DO block");
  });
});
