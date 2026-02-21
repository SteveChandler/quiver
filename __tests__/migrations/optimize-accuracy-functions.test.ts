/**
 * Migration: Optimize accuracy-related functions (code review fixes)
 *
 * Tests the SQL migration that:
 * 1. Replaces swell_windows_overlap FOR loop with O(1) analytical math
 * 2. Replaces get_yesterday_accuracy with range-based filter + capped error
 * 3. Replaces observable_beaches correlated subqueries with JOINs
 * 4. Replaces get_beach_observation_station correlated subqueries with JOINs
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Migration: Optimize accuracy functions", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("optimize_accuracy_functions")
    );
    if (!migrationFile) throw new Error("Migration file not found");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Migration Structure", () => {
    test("should be wrapped in transaction", () => {
      expect(migrationSQL).toMatch(/^BEGIN;/m);
      expect(migrationSQL).toMatch(/^COMMIT;/m);
    });

    test("should not contain double semicolons", () => {
      expect(migrationSQL).not.toContain(";;");
    });

    test("should have balanced parentheses", () => {
      const openParens = (migrationSQL.match(/\(/g) || []).length;
      const closeParens = (migrationSQL.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });
  });

  describe("swell_windows_overlap O(1) optimization", () => {
    test("should replace with analytical interval math", () => {
      expect(migrationSQL).toMatch(
        /CREATE OR REPLACE FUNCTION swell_windows_overlap/i
      );
      // Should NOT have the FOR loop
      expect(migrationSQL).not.toMatch(/FOR d IN 0\.\.359 LOOP/i);
    });

    test("should use GREATEST/LEAST for interval overlap", () => {
      const fnStart = migrationSQL.indexOf("swell_windows_overlap");
      const fnEnd = migrationSQL.indexOf(
        "LANGUAGE plpgsql IMMUTABLE",
        fnStart
      );
      const fnBody = migrationSQL.slice(fnStart, fnEnd);
      expect(fnBody).toMatch(/GREATEST\(0,[\s\S]*LEAST/);
    });

    test("should remain IMMUTABLE SECURITY DEFINER", () => {
      // Find the actual function definition (not the comment header)
      const fnStart = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION swell_windows_overlap"
      );
      const nextFnStart = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION get_yesterday_accuracy",
        fnStart
      );
      const fnSection = migrationSQL.slice(fnStart, nextFnStart);
      expect(fnSection).toMatch(/IMMUTABLE/i);
      expect(fnSection).toMatch(/SECURITY DEFINER/i);
    });

    test("should preserve NULL handling", () => {
      expect(migrationSQL).toMatch(/IS NULL/i);
      expect(migrationSQL).toMatch(/RETURN 0/);
    });
  });

  describe("get_yesterday_accuracy range optimization", () => {
    test("should use pre-computed range variables", () => {
      const fnStart = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION get_yesterday_accuracy"
      );
      const fnBody = migrationSQL.slice(fnStart, fnStart + 3000);
      expect(fnBody).toMatch(/v_start TIMESTAMPTZ/i);
      expect(fnBody).toMatch(/v_end TIMESTAMPTZ/i);
    });

    test("should use range filter instead of DATE() function on column", () => {
      const fnStart = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION get_yesterday_accuracy"
      );
      const fnBody = migrationSQL.slice(fnStart, fnStart + 3000);
      expect(fnBody).toMatch(/p\.predicted_at >= v_start/);
      expect(fnBody).toMatch(/p\.predicted_at < v_end/);
      // Should NOT have DATE(p.predicted_at AT TIME ZONE ...)
      expect(fnBody).not.toMatch(
        /DATE\(p\.predicted_at AT TIME ZONE/i
      );
    });

    test("should cap relative_error_pct with LEAST", () => {
      const fnStart = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION get_yesterday_accuracy"
      );
      const fnBody = migrationSQL.slice(fnStart, fnStart + 3000);
      expect(fnBody).toMatch(/LEAST\(/);
      expect(fnBody).toMatch(/999/);
    });

    test("should be plpgsql STABLE SECURITY DEFINER", () => {
      const fnStart = migrationSQL.indexOf(
        "CREATE OR REPLACE FUNCTION get_yesterday_accuracy"
      );
      const nextSection = migrationSQL.indexOf(
        "DROP MATERIALIZED VIEW",
        fnStart
      );
      const fnSection = migrationSQL.slice(fnStart, nextSection);
      expect(fnSection).toMatch(/LANGUAGE plpgsql/i);
      expect(fnSection).toMatch(/STABLE/i);
      expect(fnSection).toMatch(/SECURITY DEFINER/i);
    });
  });

  describe("observable_beaches JOIN optimization", () => {
    test("should recreate materialized view", () => {
      expect(migrationSQL).toMatch(
        /DROP MATERIALIZED VIEW IF EXISTS observable_beaches/i
      );
      expect(migrationSQL).toMatch(
        /CREATE MATERIALIZED VIEW observable_beaches/i
      );
    });

    test("should use JOIN instead of correlated subqueries", () => {
      // Find the view definition
      const viewStart = migrationSQL.indexOf(
        "CREATE MATERIALIZED VIEW observable_beaches"
      );
      const viewEnd = migrationSQL.indexOf("WITH DATA", viewStart);
      const viewBody = migrationSQL.slice(viewStart, viewEnd);
      expect(viewBody).toMatch(/JOIN beaches nb ON nb\.id = s\.nearest_beach_id/i);
      // Should NOT have correlated subqueries for swell windows
      expect(viewBody).not.toMatch(
        /\(SELECT b2\.swell_window_min_deg FROM beaches b2/i
      );
    });

    test("should preserve UNION approach and 10km radius", () => {
      expect(migrationSQL).toMatch(/UNION/i);
      expect(migrationSQL).toMatch(/10000/);
    });

    test("should recreate unique index", () => {
      expect(migrationSQL).toMatch(
        /CREATE UNIQUE INDEX idx_observable_beaches_beach_id/i
      );
    });
  });

  describe("get_beach_observation_station JOIN optimization", () => {
    test("should use JOIN for station's nearest beach", () => {
      const fnStart = migrationSQL.lastIndexOf(
        "get_beach_observation_station"
      );
      const fnBody = migrationSQL.slice(fnStart);
      expect(fnBody).toMatch(/JOIN beaches nb ON nb\.id = s\.nearest_beach_id/i);
    });

    test("should not have correlated subqueries", () => {
      const fnStart = migrationSQL.lastIndexOf(
        "get_beach_observation_station"
      );
      const fnBody = migrationSQL.slice(fnStart);
      expect(fnBody).not.toMatch(
        /\(SELECT b2\.swell_window_min_deg FROM beaches b2/i
      );
    });
  });
});
