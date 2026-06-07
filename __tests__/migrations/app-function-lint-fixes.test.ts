import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Migration: app function lint fixes", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((filename: string) =>
      filename.includes("fix_app_function_lint_errors"),
    );

    if (!migrationFile) throw new Error("Migration file not found");

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf8");
  });

  it("keeps PostGIS resolution portable without writing deprecated beach coordinates", () => {
    expect(migrationSQL).toMatch(/SET LOCAL search_path TO public,\s*extensions,\s*pg_temp/i);
    expect(migrationSQL).toMatch(/SET\s+lat\s*=\s*p_latitude,\s*lon\s*=\s*p_longitude/i);
    expect(migrationSQL).toMatch(/s\.coordinates::geography/i);
    expect(migrationSQL).not.toMatch(/coordinates\s*=\s*ST_SetSRID/i);
    expect(migrationSQL).not.toMatch(/extensions\.geography/i);
  });

  it("removes known PL/pgSQL lint failures from application functions", () => {
    expect(migrationSQL).toMatch(/v_is_admin BOOLEAN/i);
    expect(migrationSQL).toMatch(/jsonb_build_object\(\s*'maintenance_started'/i);
    expect(migrationSQL).not.toMatch(/beach_checkins/i);
    expect(migrationSQL).toMatch(/RETURN QUERY\s+WITH claimed_captures AS/i);
    expect(migrationSQL).not.toMatch(/CREATE TEMP TABLE claimed_captures/i);
  });

  it("avoids output-column ambiguity in strict snapshot repair", () => {
    expect(migrationSQL).toMatch(
      /ON CONFLICT ON CONSTRAINT unique_session_forecast_snapshot DO NOTHING/i,
    );
    expect(migrationSQL).toMatch(
      /RETURNING public\.session_forecast_snapshots\.session_id AS inserted_session_id/i,
    );
    expect(migrationSQL).not.toMatch(/ON CONFLICT \(session_id\) DO NOTHING/i);
  });
});
