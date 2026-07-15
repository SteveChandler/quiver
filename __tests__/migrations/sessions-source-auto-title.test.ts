import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("sessions source auto-title migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((file) =>
      file.includes("allow_auto_title_session_source"),
    );

    if (!migrationFile) {
      throw new Error(
        "Migration file not found: *allow_auto_title_session_source*",
      );
    }

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  it("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("recreates and validates the sessions_source_check constraint safely", () => {
    expect(migrationSQL).toMatch(
      /DROP CONSTRAINT IF EXISTS sessions_source_check/i,
    );
    expect(migrationSQL).toMatch(/ADD CONSTRAINT sessions_source_check/i);
    expect(migrationSQL).toMatch(/\) NOT VALID;/i);
    expect(migrationSQL).toMatch(/VALIDATE CONSTRAINT sessions_source_check/i);
  });

  it("accepts auto_title and every existing source while rejecting unknown values", () => {
    expect(migrationSQL).toMatch(/source IS NULL\s+OR source IN/i);

    const sourceListMatch = migrationSQL.match(
      /source IN\s*\(([\s\S]*?)\)\s*\) NOT VALID/i,
    );
    const allowedSources = Array.from(
      sourceListMatch?.[1].matchAll(/'([^']+)'/g) ?? [],
      (match) => match[1],
    );
    const acceptsSource = (source: string | null): boolean =>
      source === null || allowedSources.includes(source);

    expect(allowedSources).toEqual([
      "manual",
      "conditions_report",
      "email_one_tap",
      "maestro_smoke",
      "auto_title",
    ]);
    expect(acceptsSource(null)).toBe(true);
    expect(acceptsSource("auto_title")).toBe(true);
    expect(acceptsSource("unknown_source")).toBe(false);
  });

  it("documents the generated-title source", () => {
    expect(migrationSQL).toMatch(/COMMENT ON CONSTRAINT sessions_source_check/i);
    expect(migrationSQL).toMatch(
      /auto_title marks native sessions whose title was generated rather than user-entered/i,
    );
  });
});
