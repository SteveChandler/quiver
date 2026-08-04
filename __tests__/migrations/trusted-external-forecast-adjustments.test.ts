import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql",
  ),
  "utf8",
);

describe("trusted external forecast adjustment schema", () => {
  it("keeps source forecasts and decisions service-role-only", () => {
    expect(migrationSQL).toContain(
      "CREATE TABLE IF NOT EXISTS public.trusted_external_forecasts",
    );
    expect(migrationSQL).toContain(
      "CREATE TABLE IF NOT EXISTS public.trusted_forecast_adjustments",
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON TABLE public\.trusted_external_forecasts[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON TABLE public\.trusted_forecast_adjustments[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(migrationSQL).not.toMatch(
      /GRANT SELECT[\s\S]*trusted_external_forecasts[\s\S]*TO (?:anon|authenticated)/,
    );
  });

  it("stores immutable source issues and bounded window decisions", () => {
    expect(migrationSQL).toContain("valid_end > valid_start");
    expect(migrationSQL).toContain(
      "CHECK (offset_ft IN (-0.50, -0.25, 0, 0.25, 0.50))",
    );
    expect(migrationSQL).toContain("source_hash text NOT NULL");
    expect(migrationSQL).toContain("target_key text NOT NULL");
    expect(migrationSQL).toContain(
      "CHECK (source_scope = 'regional' OR beach_id IS NOT NULL)",
    );
    expect(migrationSQL).toContain("evidence_ids uuid[]");
    expect(migrationSQL).toMatch(
      /GRANT SELECT, INSERT\s+ON TABLE public\.trusted_external_forecasts TO service_role;/,
    );
    expect(migrationSQL).not.toMatch(
      /GRANT SELECT, INSERT, UPDATE\s+ON TABLE public\.trusted_external_forecasts/,
    );
  });

  it("adds non-public forecast-log attribution", () => {
    expect(migrationSQL).toContain(
      "trusted_forecast_adjustment_key text",
    );
    expect(migrationSQL).toContain(
      "trusted_forecast_baseline_height_m numeric(7,3)",
    );
    expect(migrationSQL).toContain(
      "trusted_forecast_offset_ft numeric(4,2)",
    );
    expect(migrationSQL).toContain(
      "trusted_forecast_adjustment_applied boolean",
    );
  });

  it("contains no production data mutation", () => {
    expect(migrationSQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migrationSQL).not.toMatch(/\bUPDATE\s+public\./i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/\bDROP\s+TABLE\b/i);
  });
});
