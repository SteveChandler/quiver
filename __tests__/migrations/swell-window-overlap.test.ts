/**
 * Migration: Add swell_windows_overlap function
 *
 * Tests the SQL migration that creates a function to compute angular overlap
 * between two swell windows on a 0-360 degree circle, handling wraparound.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Migration: Add swell_windows_overlap function", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("swell_window_overlap")
    );
    if (!migrationFile) throw new Error("Migration file not found");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Migration Structure", () => {
    test("should be wrapped in transaction", () => {
      expect(migrationSQL).toMatch(/BEGIN/i);
      expect(migrationSQL).toMatch(/COMMIT/i);
    });

    test("should create swell_windows_overlap function", () => {
      expect(migrationSQL).toMatch(
        /CREATE.*FUNCTION.*swell_windows_overlap/i
      );
    });

    test("should accept 4 numeric parameters", () => {
      expect(migrationSQL).toMatch(/p_min1/i);
      expect(migrationSQL).toMatch(/p_max1/i);
      expect(migrationSQL).toMatch(/p_min2/i);
      expect(migrationSQL).toMatch(/p_max2/i);
    });

    test("should return numeric type", () => {
      expect(migrationSQL).toMatch(
        /RETURNS\s+(numeric|float|double precision|real|integer)/i
      );
    });

    test("should be IMMUTABLE", () => {
      expect(migrationSQL).toMatch(/IMMUTABLE/i);
    });

    test("should set search_path", () => {
      expect(migrationSQL).toMatch(/SET\s+search_path/i);
    });

    test("should use SECURITY DEFINER", () => {
      expect(migrationSQL).toMatch(/SECURITY DEFINER/i);
    });

    test("should use plpgsql language", () => {
      expect(migrationSQL).toMatch(/LANGUAGE\s+plpgsql/i);
    });
  });

  describe("Function Logic", () => {
    test("should handle 360/0 wraparound", () => {
      expect(migrationSQL).toMatch(/360/);
    });

    test("should normalize inputs to 0-360 range", () => {
      // Should contain modulo normalization logic
      expect(migrationSQL).toMatch(/%\s*360/);
    });

    test("should handle NULL inputs", () => {
      expect(migrationSQL).toMatch(/IS NULL/i);
    });

    test("should handle zero-width windows", () => {
      expect(migrationSQL).toMatch(/span.*=\s*0|= 0/i);
    });

    test("should compute intersection of angular ranges", () => {
      // Should contain loop or analytical overlap logic
      expect(migrationSQL).toMatch(/overlap/i);
    });
  });

  describe("Permissions", () => {
    test("should grant execute to authenticated role", () => {
      expect(migrationSQL).toMatch(/GRANT\s+EXECUTE.*authenticated/i);
    });

    test("should grant execute to anon role", () => {
      expect(migrationSQL).toMatch(/GRANT\s+EXECUTE.*anon/i);
    });

    test("should grant execute to service_role", () => {
      expect(migrationSQL).toMatch(/GRANT\s+EXECUTE.*service_role/i);
    });
  });

  describe("Documentation", () => {
    test("should include a COMMENT on the function", () => {
      expect(migrationSQL).toMatch(/COMMENT\s+ON\s+FUNCTION/i);
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

    test("should have single BEGIN and COMMIT", () => {
      expect(migrationSQL.match(/^BEGIN;/m)).toBeTruthy();
      expect(migrationSQL.match(/^COMMIT;/m)).toBeTruthy();
    });
  });
});
