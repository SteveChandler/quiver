import { readFileSync } from "fs";
import { join } from "path";

const migrationPath = join(
  __dirname,
  "../../supabase/migrations/20260717162000_allow_auto_title_session_source.sql"
);

describe("sessions source auto-title migration", () => {
  const migrationSQL = readFileSync(migrationPath, "utf8");

  it("preserves existing source values and allows auto_title", () => {
    expect(migrationSQL).toContain("'manual'");
    expect(migrationSQL).toContain("'conditions_report'");
    expect(migrationSQL).toContain("'email_one_tap'");
    expect(migrationSQL).toContain("'maestro_smoke'");
    expect(migrationSQL).toContain("'auto_title'");
  });

  it("recreates and validates the constraint inside a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/DROP CONSTRAINT IF EXISTS sessions_source_check/i);
    expect(migrationSQL).toMatch(/ADD CONSTRAINT sessions_source_check/i);
    expect(migrationSQL).toMatch(/VALIDATE CONSTRAINT sessions_source_check/i);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });
});
