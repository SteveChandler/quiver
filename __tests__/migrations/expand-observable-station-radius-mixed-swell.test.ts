import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("Migration: expand observable station radius for mixed swell", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((filename: string) =>
      filename.includes("expand_observable_station_radius_for_mixed_swell")
    );

    if (!migrationFile) throw new Error("Migration file not found");

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf8");
  });

  test("is wrapped in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  test("recreates observable_beaches and get_beach_observation_station", () => {
    expect(migrationSQL).toMatch(/DROP MATERIALIZED VIEW IF EXISTS observable_beaches/i);
    expect(migrationSQL).toMatch(/CREATE MATERIALIZED VIEW observable_beaches/i);
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION get_beach_observation_station/i
    );
  });

  test("uses 50km spatial matching in both observable view and resolver", () => {
    const radiusMatches = migrationSQL.match(/ST_DWithin\([\s\S]*?50000/g) || [];

    expect(radiusMatches).toHaveLength(4);
    expect(migrationSQL).not.toMatch(/ST_DWithin\([\s\S]*?25000/);
  });

  test("keeps swell compatibility and recent-observation gates", () => {
    const viewStart = migrationSQL.indexOf("CREATE MATERIALIZED VIEW observable_beaches");
    const viewEnd = migrationSQL.indexOf("WITH DATA", viewStart);
    const viewBody = migrationSQL.slice(viewStart, viewEnd);

    expect(viewBody).toMatch(/swell_windows_overlap[\s\S]*>= 30/i);
    expect(viewBody).toMatch(/NOW\(\) - INTERVAL '24 hours'/i);
    expect(viewBody).toMatch(/NOW\(\) - INTERVAL '48 hours'/i);
  });

  test("preserves IOOS and NDBC-direct station paths", () => {
    expect(migrationSQL).toMatch(/FROM ioos_stations s/i);
    expect(migrationSQL).toMatch(/FROM ndbc_direct_stations s/i);
    expect(migrationSQL).toMatch(/s\.ioos_station_id IS NULL/i);
  });
});
