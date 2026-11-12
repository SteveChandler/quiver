import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationsDir = join(__dirname, "../../supabase/migrations");

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

describe("beaches_slug_unique restore migration", () => {
  let migrationSQL: string;
  let normalizedSQL: string;

  beforeAll(() => {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_restore_beaches_slug_unique_index\.sql$/.test(filename)
    );
    expect(matches).toHaveLength(1);
    migrationSQL = readFileSync(join(migrationsDir, matches[0]), "utf8");
    normalizedSQL = stripSqlComments(migrationSQL).replace(/\s+/g, " ").toLowerCase();
  });

  it("runs in a transaction with a lock timeout", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
    expect(normalizedSQL).toContain("set local lock_timeout");
    expect(normalizedSQL).not.toContain("concurrently");
  });

  // Readers lowercase the slug before .eq("slug"), so uniqueness must be on lower(slug).
  it("creates the partial unique index on lower(slug)", () => {
    expect(normalizedSQL).toContain(
      "create unique index if not exists beaches_slug_unique on public.beaches (lower(slug)) where slug is not null;"
    );
  });

  it("fails with a named error when duplicates exist, before the index build", () => {
    const guard = normalizedSQL.indexOf("raise exception");
    const create = normalizedSQL.indexOf("create unique index");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(create);
    expect(normalizedSQL).toContain("having count(*) > 1");
  });

  it("changes nothing else", () => {
    expect(normalizedSQL).not.toMatch(/\b(update|delete|insert|alter table|drop)\b/);
  });

  it("matches the local schema snapshot", () => {
    const snapshot = readFileSync(
      join(__dirname, "../../supabase/snapshots/schema.sql"),
      "utf8"
    );
    expect(snapshot).toContain(
      'CREATE UNIQUE INDEX "beaches_slug_unique" ON "public"."beaches" USING "btree" ("lower"("slug")) WHERE ("slug" IS NOT NULL);'
    );
  });
});
