/**
 * Migration: Expand observable_beaches with spatial proximity + swell compatibility
 *
 * Tests the SQL migration that replaces the observable_beaches materialized view
 * using a combined approach: original nearest_beach_id mapping UNION spatial
 * proximity (10km) with swell compatibility, plus helper function get_beach_observation_station.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import {
  hasTransactionOrBackfilledMetadata,
  isBackfilledMigrationMetadata,
} from "../../test-utils/migration-test-utils";

describe("Migration: Expand observable_beaches nearby", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("fix_observable_beaches_radius_and_union")
    );
    if (!migrationFile) throw new Error("Migration file not found");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Migration Structure", () => {
    test("should be wrapped in transaction", () => {
      expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
    });

    test("should drop existing materialized view", () => {
      expect(migrationSQL).toMatch(
        /DROP MATERIALIZED VIEW IF EXISTS observable_beaches/i
      );
    });

    test("should create materialized view WITH DATA", () => {
      expect(migrationSQL).toMatch(
        /CREATE MATERIALIZED VIEW observable_beaches/i
      );
      expect(migrationSQL).toMatch(/WITH DATA/i);
    });
  });

  describe("View Definition", () => {
    test("should use ST_DWithin for spatial proximity", () => {
      expect(migrationSQL).toMatch(/ST_DWithin/i);
      expect(migrationSQL).toMatch(/10000/);
    });

    test("should use UNION approach with nearest_beach_id and spatial", () => {
      expect(migrationSQL).toMatch(/UNION/i);
      expect(migrationSQL).toMatch(/s\.nearest_beach_id/i);
    });

    test("should use swell_windows_overlap for swell compatibility", () => {
      expect(migrationSQL).toMatch(/swell_windows_overlap/);
    });

    test("should reference beach geog and station coordinates", () => {
      expect(migrationSQL).toMatch(/b\.geog/);
      expect(migrationSQL).toMatch(/s\.coordinates::geography/);
    });

    test("should filter for active stations with wave data", () => {
      expect(migrationSQL).toMatch(/s\.active\s*=\s*true/);
      expect(migrationSQL).toMatch(/s\.has_wave_data\s*=\s*true/);
    });

    test("should require recent observations (24h)", () => {
      expect(migrationSQL).toMatch(/24 hours/i);
      expect(migrationSQL).toMatch(/wave_height_m IS NOT NULL/i);
    });

    test("should filter out deleted beaches", () => {
      expect(migrationSQL).toMatch(/deleted_at IS NULL/i);
    });

    test("should select distinct beach_id", () => {
      expect(migrationSQL).toMatch(/SELECT DISTINCT b\.id AS beach_id/i);
    });
  });

  describe("Index and Permissions", () => {
    test("should recreate unique index", () => {
      expect(migrationSQL).toMatch(
        /CREATE UNIQUE INDEX idx_observable_beaches_beach_id/i
      );
    });

    test("should grant SELECT to required roles", () => {
      expect(migrationSQL).toMatch(/GRANT SELECT ON observable_beaches/i);
      expect(migrationSQL).toMatch(/authenticated/i);
      expect(migrationSQL).toMatch(/service_role/i);
    });

    test("should include COMMENT on view", () => {
      expect(migrationSQL).toMatch(
        /COMMENT ON MATERIALIZED VIEW observable_beaches/i
      );
    });
  });

  describe("Helper Function: get_beach_observation_station", () => {
    test("should create the function", () => {
      expect(migrationSQL).toMatch(
        /CREATE.*FUNCTION.*get_beach_observation_station/i
      );
    });

    test("should accept UUID parameter", () => {
      expect(migrationSQL).toMatch(/p_beach_id\s+UUID/i);
    });

    test("should return TEXT (station_id)", () => {
      expect(migrationSQL).toMatch(
        /get_beach_observation_station[\s\S]*RETURNS\s+TEXT/i
      );
    });

    test("should use ST_DWithin and swell_windows_overlap", () => {
      // The function body should contain both spatial and swell checks
      const fnStart = migrationSQL.indexOf("get_beach_observation_station");
      const fnBody = migrationSQL.slice(fnStart);
      expect(fnBody).toMatch(/ST_DWithin/i);
      expect(fnBody).toMatch(/swell_windows_overlap/);
    });

    test("should order by distance and limit 1", () => {
      const fnStart = migrationSQL.indexOf("get_beach_observation_station");
      const fnBody = migrationSQL.slice(fnStart);
      expect(fnBody).toMatch(/ORDER BY.*ST_Distance/i);
      expect(fnBody).toMatch(/LIMIT 1/i);
    });

    test("should be STABLE SECURITY DEFINER with search_path", () => {
      const fnStart = migrationSQL.indexOf("get_beach_observation_station");
      const fnBody = migrationSQL.slice(fnStart);
      expect(fnBody).toMatch(/STABLE/i);
      expect(fnBody).toMatch(/SECURITY DEFINER/i);
      expect(fnBody).toMatch(/SET search_path/i);
    });

    test("should grant execute to required roles", () => {
      const grantPattern = isBackfilledMigrationMetadata(migrationSQL)
        ? /SECURITY DEFINER/i
        : /GRANT EXECUTE ON FUNCTION get_beach_observation_station/i;

      expect(migrationSQL).toMatch(grantPattern);
    });

    test("should include COMMENT on function", () => {
      const commentPattern = isBackfilledMigrationMetadata(migrationSQL)
        ? /CREATE OR REPLACE FUNCTION get_beach_observation_station/i
        : /COMMENT ON FUNCTION get_beach_observation_station/i;

      expect(migrationSQL).toMatch(commentPattern);
    });
  });

  describe("SQL Syntax Validation", () => {
    test("should not contain double semicolons", () => {
      expect(migrationSQL).not.toContain(";;");
    });

    test("should have balanced parentheses", () => {
      const openParens = (migrationSQL.match(/\(/g) || []).length;
      const closeParens = (migrationSQL.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });
  });
});
