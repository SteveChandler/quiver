import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Migration: profile analytics real-user fields", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((filename: string) =>
      filename.includes("profile_analytics_real_user_fields")
    );

    if (!migrationFile) throw new Error("Migration file not found");

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf8");
  });

  it("adds non-PII analytics fields to profiles", () => {
    expect(migrationSQL).toMatch(/ADD COLUMN IF NOT EXISTS analytics_is_real_user boolean/i);
    expect(migrationSQL).toMatch(/ADD COLUMN IF NOT EXISTS analytics_exclusion_reason text/i);
    expect(migrationSQL).toMatch(/ALTER COLUMN analytics_is_real_user SET DEFAULT true/i);
    expect(migrationSQL).not.toMatch(/ADD COLUMN IF NOT EXISTS email\s+text/i);
  });

  it("backfills and maintains fields from mock and test-email filters", () => {
    expect(migrationSQL).toMatch(/CREATE OR REPLACE FUNCTION public\.set_profile_analytics_real_user_fields/i);
    expect(migrationSQL).toMatch(/BEFORE INSERT OR UPDATE OF email,\s*is_mock ON public\.profiles/i);
    expect(migrationSQL).toMatch(/UPDATE public\.profiles/i);
    expect(migrationSQL).toMatch(/coalesce\(NEW\.is_mock,\s*false\)/i);
    expect(migrationSQL).toMatch(/%@local\.test/i);
    expect(migrationSQL).toMatch(/%@example\.invalid/i);
    expect(migrationSQL).toMatch(/%test%/i);
  });

  it("does not expose the trigger function as a public RPC", () => {
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.set_profile_analytics_real_user_fields\(\) FROM PUBLIC/i
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.set_profile_analytics_real_user_fields\(\) FROM anon,\s*authenticated/i
    );
  });
});
