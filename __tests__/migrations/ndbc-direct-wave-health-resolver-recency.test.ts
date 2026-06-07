import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("Migration: NDBC direct wave health resolver recency", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((filename: string) =>
      filename.includes("ndbc_direct_wave_health_resolver_recency")
    );

    if (!migrationFile) throw new Error("Migration file not found");

    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf8");
  });

  test("is wrapped in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  test("adds NDBC direct wave-source health metadata", () => {
    expect(migrationSQL).toMatch(/ALTER TABLE public\.ndbc_direct_stations/i);
    expect(migrationSQL).toMatch(/last_wave_fetch_at\s+TIMESTAMPTZ/i);
    expect(migrationSQL).toMatch(/last_wave_fetch_status\s+TEXT/i);
    expect(migrationSQL).toMatch(/last_wave_observed_at\s+TIMESTAMPTZ/i);
    expect(migrationSQL).toMatch(/'ok'/i);
    expect(migrationSQL).toMatch(/'no_wave_data'/i);
    expect(migrationSQL).toMatch(/'not_found'/i);
    expect(migrationSQL).toMatch(/'error'/i);
  });

  test("updates only the resolver function, leaving observable_beaches intact", () => {
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION get_beach_observation_station/i
    );
    expect(migrationSQL).not.toMatch(/DROP MATERIALIZED VIEW/i);
    expect(migrationSQL).not.toMatch(/CREATE MATERIALIZED VIEW/i);
  });

  test("requires recent source observations in every resolver tier", () => {
    const functionStart = migrationSQL.indexOf(
      "CREATE OR REPLACE FUNCTION get_beach_observation_station"
    );
    const functionEnd = migrationSQL.indexOf("COMMENT ON FUNCTION", functionStart);
    const functionSQL = migrationSQL.slice(functionStart, functionEnd);

    expect(functionSQL).toMatch(/FROM public\.ioos_observations o/i);
    expect(functionSQL).toMatch(/FROM public\.ndbc_direct_observations o/i);
    expect(functionSQL).toMatch(/NOW\(\) - INTERVAL '24 hours'/i);
    expect(functionSQL).toMatch(/NOW\(\) - INTERVAL '48 hours'/i);

    const ioosRecencyGates =
      functionSQL.match(/public\.ioos_observations[\s\S]*?o\.observed_at > NOW\(\) - INTERVAL '(24|48) hours'/gi) ||
      [];
    const ndbcRecencyGates =
      functionSQL.match(/public\.ndbc_direct_observations[\s\S]*?o\.observed_at > NOW\(\) - INTERVAL '(24|48) hours'/gi) ||
      [];

    expect(ioosRecencyGates).toHaveLength(2);
    expect(ndbcRecencyGates).toHaveLength(2);
  });

  test("keeps PostGIS calls schema-qualified under public search_path", () => {
    expect(migrationSQL).toMatch(/SET search_path = public/i);
    expect(migrationSQL).toMatch(/::extensions\.geography/i);
    expect(migrationSQL).toMatch(/extensions\.ST_DWithin/i);
    expect(migrationSQL).toMatch(/extensions\.ST_Distance/i);
  });
});
