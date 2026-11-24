/**
 * Migration: read-time buoy matching
 *
 * Forecast rows are paired with the nearest buoy reading when they are read,
 * instead of Seaside writing observed_m back onto every row (2026-11-03
 * backfill incident). Locks in the mapping view, the match function's
 * contract, and that nothing writes back.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Migration: read-time buoy matching", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const migrationFile = readdirSync(migrationDir).find((f: string) =>
      f.includes("read_time_buoy_matching")
    );
    if (!migrationFile) throw new Error("Migration file not found");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  test("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  test("creates the beach-to-station mapping with a unique beach index", () => {
    expect(migrationSQL).toMatch(
      /CREATE MATERIALIZED VIEW public\.beach_observation_stations/
    );
    expect(migrationSQL).toMatch(
      /CREATE UNIQUE INDEX \w+ ON public\.beach_observation_stations \(beach_id\)/
    );
  });

  test("refreshes the mapping daily at 09:15 UTC", () => {
    expect(migrationSQL).toMatch(
      /cron\.schedule\(\s*'refresh-beach-observation-stations',\s*'15 9 \* \* \*'/
    );
  });

  test("defines get_prediction_observations(beach, since, until)", () => {
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_prediction_observations\(\s*p_beach_id uuid,\s*p_since timestamptz,\s*p_until timestamptz\s*\)/
    );
  });

  test("matches within ±12 hours on positive wave heights", () => {
    expect(migrationSQL.match(/interval '12 hours'/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(migrationSQL).toMatch(/wave_height_m > 0/);
  });

  test("refuses ranges longer than 31 days", () => {
    expect(migrationSQL).toMatch(/p_until - p_since > interval '31 days'/);
    expect(migrationSQL).toMatch(/RAISE EXCEPTION/);
  });

  test("drops beaches without a station via an inner join", () => {
    expect(migrationSQL).toMatch(/\bJOIN public\.beach_observation_stations/);
    expect(migrationSQL).not.toMatch(/LEFT JOIN public\.beach_observation_stations/);
  });

  test("picks the nearest reading, earlier reading on a tie", () => {
    expect(migrationSQL).toMatch(
      /ORDER BY abs\(extract\(epoch from \(\w+\.observed_at - \w+\.predicted_at\)\)\),\s*\w+\.observed_at/i
    );
  });

  test.each([
    "get_prediction_observations(uuid, timestamptz, timestamptz)",
    "refresh_beach_observation_stations()",
  ])("%s is service-role only", (signature: string) => {
    const escaped = signature.replace(/[()]/g, "\\$&");
    expect(migrationSQL).toMatch(
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${escaped} FROM PUBLIC, anon, authenticated`
      )
    );
    expect(migrationSQL).toMatch(
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${escaped} TO service_role`)
    );
  });

  test("postgres can execute the match function, so session saves never depend on its owner", () => {
    expect(migrationSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_prediction_observations\(uuid, timestamptz, timestamptz\) TO postgres/
    );
  });

  test("never writes observations back onto ml_predictions_log", () => {
    expect(migrationSQL).not.toMatch(/UPDATE public\.ml_predictions_log/i);
  });

  describe("session snapshot buoy", () => {
    let syncBody: string;

    beforeAll(() => {
      const start = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION public.sync_session_wave_observation_candidate("
      );
      if (start === -1) throw new Error("sync_session_wave_observation_candidate not redefined");
      const bodyStart = migrationSQL.indexOf("$$", start);
      const bodyEnd = migrationSQL.indexOf("$$", bodyStart + 2);
      syncBody = migrationSQL.slice(start, bodyEnd);
    });

    test("no longer copies the written-back observed_m", () => {
      expect(syncBody).not.toMatch(/nearest_prediction\.observed_m/);
    });

    test("reads the buoy for the nearest prediction at read time", () => {
      expect(syncBody).toMatch(
        /get_prediction_observations\(\s*p_beach_id,\s*nearest_prediction\.predicted_at,\s*nearest_prediction\.predicted_at \+ interval '1 second'\s*\)/
      );
      expect(syncBody).toMatch(/\w+\.prediction_id = nearest_prediction\.id/);
    });
  });
});
