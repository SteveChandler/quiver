import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("Puerto Rico beginner and longboard beach expansion migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_expand_puerto_rico_beginner_longboard_beaches\.sql$/.test(
        filename
      )
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

  it("wraps the data update in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("retags only researched Puerto Rico beginner and longboard candidates", () => {
    for (const slug of ["crash-boat", "jobos", "middles-isabela", "la-pared"]) {
      expect(normalizedSQL).toContain(`'${slug}'`);
    }

    for (const advancedSlug of [
      "shacks",
      "wilderness",
      "tres-palmas",
      "indicators",
    ]) {
      expect(normalizedSQL).not.toContain(`'${advancedSlug}'`);
    }

    expect(normalizedSQL).toContain("where b.state = 'pr'");
    expect(normalizedSQL).toContain("and b.deleted_at is null");
  });

  it("adds San Juan metro spots that were missing from the Puerto Rico seed set", () => {
    expect(normalizedSQL).toContain("'pine-grove'");
    expect(normalizedSQL).toContain("'la-ocho'");
    expect(normalizedSQL).toContain("'carolina'");
    expect(normalizedSQL).toContain("'san juan'");
    expect(normalizedSQL).toContain("'america/puerto_rico'");
  });

  it("uses idempotent insert guards instead of relying on duplicate failures", () => {
    expect(normalizedSQL).toContain("where not exists");
    expect(normalizedSQL).toContain("existing.state = spot.state");
    expect(normalizedSQL).toContain("existing.city = spot.city");
    expect(normalizedSQL).toContain("existing.slug = spot.slug");
    expect(normalizedSQL).not.toContain("on conflict");
  });

  it("keeps explicit reef caveats on La Ocho despite beginner intent eligibility", () => {
    expect(normalizedSQL).toContain("la ocho");
    expect(normalizedSQL).toContain("reef and rocks under the wave");
    expect(normalizedSQL).toContain("not beginner-friendly when head high or bigger");
  });
});
