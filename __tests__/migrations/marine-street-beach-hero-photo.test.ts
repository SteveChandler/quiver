import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("Marine Street Beach hero photo migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_add_marine_street_beach_hero_photo\.sql$/.test(filename)
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

  it("adds an approved Wikimedia photo for Marine Street Beach", () => {
    expect(normalizedSQL).toContain("'marine-street-beach'");
    expect(normalizedSQL).toContain("'ca'");
    expect(normalizedSQL).toContain("'wikimedia'");
    expect(normalizedSQL).toContain(
      "file:san diego la jolla marine street beach.jpg"
    );
    expect(normalizedSQL).toContain(
      "san_diego_la_jolla_marine_street_beach.jpg"
    );
    expect(normalizedSQL).toContain("'jirimatejicek'");
    expect(normalizedSQL).toContain("'cc by-sa 4.0'");
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
