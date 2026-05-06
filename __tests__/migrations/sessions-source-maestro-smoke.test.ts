import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("sessions source Maestro smoke migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((file) =>
      file.includes("allow_maestro_smoke_session_source")
    );

    if (!migrationFile) {
      throw new Error(
        "Migration file not found: *allow_maestro_smoke_session_source*"
      );
    }

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  it("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("recreates the sessions_source_check constraint", () => {
    expect(migrationSQL).toMatch(
      /DROP CONSTRAINT IF EXISTS sessions_source_check/i
    );
    expect(migrationSQL).toMatch(/ADD CONSTRAINT sessions_source_check/i);
    expect(migrationSQL).toMatch(/VALIDATE CONSTRAINT sessions_source_check/i);
  });

  it("keeps all existing source values and adds maestro_smoke", () => {
    expect(migrationSQL).toContain("'manual'");
    expect(migrationSQL).toContain("'conditions_report'");
    expect(migrationSQL).toContain("'email_one_tap'");
    expect(migrationSQL).toContain("'maestro_smoke'");
  });

  it("documents the Maestro smoke cleanup marker", () => {
    expect(migrationSQL).toMatch(/COMMENT ON CONSTRAINT sessions_source_check/i);
    expect(migrationSQL).toMatch(/maestro_smoke marks rows created by native Maestro smoke flows/i);
  });
});
