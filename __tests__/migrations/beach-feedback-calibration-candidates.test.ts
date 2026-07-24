import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260724030000_create_beach_feedback_calibration_candidates.sql",
  ),
  "utf8",
);

describe("temporary feedback height calibration schema", () => {
  it("creates the service-role-only candidate table and lifecycle contract", () => {
    expect(migrationSQL).toContain(
      "CREATE TABLE IF NOT EXISTS public.beach_feedback_calibration_candidates",
    );
    for (const status of [
      "shadow",
      "active_temp",
      "expired",
      "rejected",
      "manual_hold",
    ]) {
      expect(migrationSQL).toContain(`'${status}'`);
    }
    expect(migrationSQL).toContain(
      "WHERE status = 'active_temp'",
    );
    expect(migrationSQL).toContain(
      "ENABLE ROW LEVEL SECURITY",
    );
    expect(migrationSQL).toMatch(
      /REVOKE ALL ON TABLE public\.beach_feedback_calibration_candidates[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(migrationSQL).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*TO service_role/,
    );
  });

  it("clamps offsets and adds forecast-log attribution", () => {
    expect(migrationSQL).toContain(
      "CHECK (offset_ft BETWEEN -0.50 AND 0.50)",
    );
    expect(migrationSQL).toContain(
      "feedback_height_calibration_candidate_id uuid",
    );
    expect(migrationSQL).toContain(
      "feedback_height_offset_ft numeric(4,2)",
    );
    expect(migrationSQL).toContain(
      "feedback_height_calibration_applied boolean",
    );
  });

  it("contains no production data mutation", () => {
    expect(migrationSQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migrationSQL).not.toMatch(/\bUPDATE\s+public\./i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
  });
});
