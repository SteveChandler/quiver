import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationsDir = join(__dirname, "../../supabase/migrations");

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

describe("beach_photos.approved default migration", () => {
  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_beach_photos_approved_default_false\.sql$/.test(filename)
    );

    expect(matches).toHaveLength(1);
    return readFileSync(join(migrationsDir, matches[0]), "utf8");
  }

  let migrationSQL: string;
  let normalizedSQL: string;

  beforeAll(() => {
    migrationSQL = readMigrationSQL();
    normalizedSQL = stripSqlComments(migrationSQL).replace(/\s+/g, " ").toLowerCase();
  });

  it("runs in a transaction with a lock timeout", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
    expect(normalizedSQL).toContain("set local lock_timeout");
  });

  it("flips the column default to false without touching rows", () => {
    expect(normalizedSQL).toContain(
      "alter table public.beach_photos alter column approved set default false;"
    );
    expect(normalizedSQL).not.toMatch(/\bupdate\b/);
    expect(normalizedSQL).not.toMatch(/\bdelete\b/);
    expect(normalizedSQL).not.toMatch(/\binsert\b/);
  });

  it("matches the local schema snapshot", () => {
    const snapshot = readFileSync(
      join(__dirname, "../../supabase/snapshots/schema.sql"),
      "utf8"
    );
    const table = snapshot.match(
      /CREATE TABLE IF NOT EXISTS "public"\."beach_photos" \(([\s\S]*?)\n\);/
    );
    expect(table?.[1]).toContain('"approved" boolean DEFAULT false NOT NULL');
  });
});

// With the default now false, a curated insert that leaves `approved` out
// would silently hide its photo. Every migration insert names it.
describe("beach_photos migration inserts", () => {
  const inserts = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .flatMap((filename) => {
      const sql = stripSqlComments(readFileSync(join(migrationsDir, filename), "utf8"));
      return [
        ...sql.matchAll(/insert\s+into\s+(?:"?public"?\.)?"?beach_photos"?(?!\w)\s*(\(([^)]*)\))?/gi),
      ].map((match) => ({
        filename,
        // An insert without a column list cannot be checked; it fails below.
        columns: (match[2] ?? "").split(",").map((column) => column.trim().replace(/"/g, "").toLowerCase()),
      }));
    });

  it("finds the curated inserts", () => {
    expect(inserts.length).toBeGreaterThanOrEqual(16);
  });

  it.each(inserts.map((insert) => [insert.filename, insert.columns] as const))(
    "%s sets approved explicitly",
    (_filename, columns) => {
      expect(columns).toContain("approved");
    }
  );
});
