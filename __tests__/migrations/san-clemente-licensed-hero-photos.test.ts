import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("San Clemente licensed hero photos migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_add_san_clemente_licensed_hero_photos\.sql$/.test(filename)
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

  it("wraps the photo inserts in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds approved licensed Wikimedia photos for Church and Riviera", () => {
    expect(normalizedSQL).toContain("'church'");
    expect(normalizedSQL).toContain("'riviera'");
    expect(normalizedSQL).toContain("'wikimedia'");
    expect(normalizedSQL).toContain("file:trestles lifeguard tower.jpg");
    expect(normalizedSQL).toContain(
      "file:surfer in san clemente ca (unsplash).jpg"
    );
    expect(normalizedSQL).toContain("'cc by-sa 4.0'");
    expect(normalizedSQL).toContain("'cc0'");
    expect(normalizedSQL).toContain("true");
  });

  it("keeps the migration idempotent and revives only exact source matches", () => {
    expect(normalizedSQL).toContain(
      "on conflict (beach_id, source, source_id)"
    );
    expect(normalizedSQL).toContain("approved = true");
    expect(normalizedSQL).toContain("deleted_at = null");
    expect(normalizedSQL).toContain("fetched_at = now()");
  });

  it("does not use unknown-rights galleries or hard delete existing photos", () => {
    expect(normalizedSQL).not.toContain("californiabeaches.com");
    expect(normalizedSQL).not.toContain("license = unknown");
    expect(normalizedSQL).not.toContain("delete from public.beach_photos");
  });
});
