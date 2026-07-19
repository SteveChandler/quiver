import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260719120000_create_weekend_scout_location_snapshots.sql"
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("Weekend Scout location snapshots migration", () => {
  it("creates one privacy-bounded current location row per user", () => {
    const sql = readMigration();

    expect(sql).toMatch(/BEGIN;/i);
    expect(sql).toMatch(/COMMIT;/i);
    expect(sql).toMatch(/CREATE TABLE public\.user_location_snapshots/i);
    expect(sql).toMatch(/user_id uuid PRIMARY KEY/i);
    expect(sql).toMatch(/CHECK \(lat BETWEEN -90 AND 90\)/i);
    expect(sql).toMatch(/CHECK \(lon BETWEEN -180 AND 180\)/i);
    expect(sql).toMatch(/captured_at timestamptz NOT NULL/i);
    expect(sql).toMatch(/source text NOT NULL CHECK/i);
    expect(sql).not.toMatch(/location_history/i);
  });

  it("creates immutable one-per-weekend ranking snapshots", () => {
    const sql = readMigration();

    expect(sql).toMatch(/CREATE TABLE public\.weekend_scout_snapshots/i);
    expect(sql).toMatch(/UNIQUE \(user_id, weekend_start\)/i);
    expect(sql).toMatch(/qualifying_count BETWEEN 1 AND 3/i);
    expect(sql).toMatch(/contract_version = 'weekend-scout-v1'/i);
    expect(sql).toMatch(/jsonb_typeof\(rankings\) = 'array'/i);
    expect(sql).toMatch(/weekend_end = weekend_start \+ 1/i);
  });

  it("keeps location writes behind the API and snapshots append-only", () => {
    const sql = readMigration();

    expect(sql).toMatch(/ALTER TABLE public\.user_location_snapshots ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.weekend_scout_snapshots ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/auth\.uid\(\)\) = user_id/i);
    expect(sql).toMatch(/GRANT SELECT, DELETE ON TABLE public\.user_location_snapshots TO authenticated/i);
    expect(sql).not.toMatch(/GRANT[^;]+INSERT[^;]+user_location_snapshots TO authenticated/i);
    expect(sql).not.toMatch(/GRANT[^;]+UPDATE[^;]+user_location_snapshots TO authenticated/i);
    expect(sql).toMatch(/GRANT SELECT ON TABLE public\.weekend_scout_snapshots TO authenticated/i);
    expect(sql).not.toMatch(/GRANT SELECT, INSERT[^;]+weekend_scout_snapshots TO authenticated/i);
    expect(sql).toMatch(/GRANT SELECT, INSERT ON TABLE public\.weekend_scout_snapshots TO service_role/i);
    expect(sql).not.toMatch(/GRANT[^;]+UPDATE[^;]+weekend_scout_snapshots TO service_role/i);
    expect(sql).not.toMatch(/GRANT[^;]+DELETE[^;]+weekend_scout_snapshots TO service_role/i);
  });

  it("defines a service-only exhaustive candidate RPC with truncation evidence", () => {
    const sql = readMigration();

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_weekend_scout_candidates/i);
    expect(sql).toMatch(/count\(\*\) OVER \(\) AS total_count/i);
    expect(sql).toMatch(/ST_DWithin/i);
    expect(sql).toMatch(/ST_Distance/i);
    expect(sql).toMatch(/b\.is_private IS NOT TRUE/i);
    expect(sql).toMatch(/b\.deleted_at IS NULL/i);
    expect(sql).toMatch(/public\.user_beach_exclusions/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_weekend_scout_candidates/i);
    expect(sql).toMatch(/TO service_role/i);
    expect(sql).not.toMatch(/get_weekend_scout_candidates[^;]+TO authenticated/i);
    expect(sql).not.toMatch(/get_weekend_scout_candidates[^;]+TO anon/i);
  });
});
