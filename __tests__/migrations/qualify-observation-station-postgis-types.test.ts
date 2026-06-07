import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("Migration: qualify observation station PostGIS types", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((filename: string) =>
      filename.includes("qualify_observation_station_postgis_types")
    );

    if (!migrationFile) throw new Error("Migration file not found");

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf8");
  });

  test("is wrapped in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  test("replaces only the station resolver function", () => {
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION get_beach_observation_station/i
    );
    expect(migrationSQL).not.toMatch(/DROP MATERIALIZED VIEW/i);
    expect(migrationSQL).not.toMatch(/CREATE MATERIALIZED VIEW/i);
  });

  test("qualifies PostGIS geography casts and functions under public search_path", () => {
    expect(migrationSQL).toMatch(/SET search_path = public/i);
    expect(migrationSQL).toMatch(/::extensions\.geography/i);
    expect(migrationSQL).toMatch(/extensions\.ST_DWithin/i);
    expect(migrationSQL).toMatch(/extensions\.ST_Distance/i);
    expect(migrationSQL).not.toMatch(/::geography/i);
    expect(migrationSQL).not.toMatch(/[^.]ST_DWithin\(/i);
    expect(migrationSQL).not.toMatch(/[^.]ST_Distance\(/i);
  });
});
