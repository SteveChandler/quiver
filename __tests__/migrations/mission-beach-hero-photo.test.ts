import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("Mission Beach hero photo migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_add_mission_beach_hero_photo\.sql$/.test(filename)
    );

    expect(matches).toHaveLength(1);
    return readFileSync(join(migrationsDir, matches[0]), "utf8");
  }

  let migrationSQL: string;
  let normalizedSQL: string;

  beforeAll(() => {
    migrationSQL = readMigrationSQL();
    normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();
  });

  it("wraps the photo insert in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("adds an approved public-domain Wikimedia photo for Mission Beach", () => {
    expect(normalizedSQL).toContain("'mission-beach'");
    expect(normalizedSQL).toContain("'san diego'");
    expect(normalizedSQL).toContain("'ca'");
    expect(normalizedSQL).toContain("'wikimedia'");
    expect(normalizedSQL).toContain(
      "file:mission beach-san diego-california.jpg"
    );
    expect(normalizedSQL).toContain("'public domain'");
    expect(normalizedSQL).toContain("approved");
    expect(normalizedSQL).toContain("true");
  });

  it("keeps the migration idempotent and avoids destructive cleanup", () => {
    expect(normalizedSQL).toContain(
      "on conflict (beach_id, source, source_id)"
    );
    expect(normalizedSQL).toContain("deleted_at = null");
    expect(normalizedSQL).toContain("fetched_at = now()");
    expect(normalizedSQL).not.toContain("delete from public.beach_photos");
  });
});
