import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("South OC/SanO shadow guardrail flag migration", () => {
  const migrationsDir = join(__dirname, "../../supabase/migrations");

  function readMigrationSQL(): string {
    const matches = readdirSync(migrationsDir).filter((filename) =>
      /^\d{14}_add_south_oc_sano_shadow_guardrail_flags\.sql$/.test(filename),
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

  it("wraps the feature-flag update in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("adds the South OC/SanO guardrail flag to the explicit production slug allowlist", () => {
    for (const slug of [
      "salt-creek",
      "strands",
      "doheny",
      "doheny-state-beach",
      "poche-beach",
      "204s",
      "san-clemente-pier-northside",
      "t-street",
      "riviera",
      "san-clemente-state-beach",
      "cottons",
      "upper-trestles",
      "lower-trestles",
      "middles",
      "church",
      "old-mans-sano",
      "san-onofre-state-beach",
      "trails",
    ]) {
      expect(normalizedSQL).toContain(`'${slug}'`);
    }

    expect(normalizedSQL).toContain("'south_oc_sano_shadow_guardrail'");
    expect(normalizedSQL).toContain("where b.slug = target.slug");
    expect(normalizedSQL).toContain("and b.deleted_at is null");
  });

  it("does not create regional multiplier tables or overwrite existing feature tags", () => {
    expect(normalizedSQL).not.toContain("create table");
    expect(normalizedSQL).not.toContain("multiplier");
    expect(normalizedSQL).toContain("coalesce(b.features, array[]::text[])");
  });
});
