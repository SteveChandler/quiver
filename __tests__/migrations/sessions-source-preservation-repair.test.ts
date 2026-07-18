import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260718140000_preserve_session_source_check.sql",
);

describe("sessions source CHECK preservation repair", () => {
  it("appends auto_title to the live constraint instead of hardcoding its values", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("pg_get_constraintdef");
    expect(sql).toContain("sessions_source_check");
    expect(sql).toContain("'auto_title'");
    expect(sql).toContain("current_check");
    expect(sql).toContain("missing_sources");
    expect(sql).toContain("NOT VALID");
    expect(sql).toContain("VALIDATE CONSTRAINT sessions_source_check");
    expect(sql).not.toMatch(/DELETE\s+FROM|TRUNCATE\s+|DROP\s+TABLE/i);
  });

  it("rejects future hardcoded rebuilds regardless of migration timestamp", () => {
    const migrationsDirectory = path.join(process.cwd(), "supabase/migrations");
    const appliedLegacyRebuilders = new Set([
      "20260312120000_add_conditions_report_fields.sql",
      "20260505171909_allow_maestro_smoke_session_source.sql",
      "20260717162000_allow_auto_title_session_source.sql",
    ]);
    const unsafeRebuilders = readdirSync(migrationsDirectory)
      .filter((filename) => filename.endsWith(".sql"))
      .filter((filename) => !appliedLegacyRebuilders.has(filename))
      .filter((filename) => {
        const sql = readFileSync(path.join(migrationsDirectory, filename), "utf8");
        const rebuildsSourceConstraint = /DROP\s+CONSTRAINT(?:\s+IF\s+EXISTS)?\s+sessions_source_check/i.test(
          sql,
        );
        return rebuildsSourceConstraint && !sql.includes("pg_get_constraintdef");
      });

    expect(unsafeRebuilders).toEqual([]);
  });
});
