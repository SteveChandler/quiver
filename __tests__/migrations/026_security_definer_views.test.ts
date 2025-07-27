/**
 * Migration 026: Fix Security Definer Views Test
 *
 * This test validates the migration that fixes Supabase security linter warnings
 * for views with SECURITY DEFINER property by recreating them with SECURITY INVOKER.
 */

import { readFileSync } from "fs";
import { join } from "path";

describe("Migration 026: Fix Security Definer Views", () => {
  let migrationSQL: string;

  beforeAll(() => {
    // Read the migration file
    const migrationPath = join(
      __dirname,
      "../../scripts/migrations/026_fix_security_definer_views.sql"
    );
    migrationSQL = readFileSync(migrationPath, "utf8");
  });

  describe("Migration Structure", () => {
    test("should contain proper transaction management", () => {
      expect(migrationSQL).toContain("BEGIN;");
      expect(migrationSQL).toContain("COMMIT;");
    });

    test("should include security documentation", () => {
      expect(migrationSQL).toContain("SECURITY ISSUE ADDRESSED");
      expect(migrationSQL).toContain("SECURITY DEFINER");
      expect(migrationSQL).toContain("SECURITY INVOKER");
    });

    test("should handle both problematic views", () => {
      expect(migrationSQL).toContain("v_index_usage_stats");
      expect(migrationSQL).toContain("activity_feed_secure");
    });
  });

  describe("Security Fixes", () => {
    test("should recreate v_index_usage_stats with SECURITY INVOKER", () => {
      expect(migrationSQL).toContain("DROP VIEW IF EXISTS v_index_usage_stats");
      expect(migrationSQL).toContain(
        "CREATE OR REPLACE VIEW v_index_usage_stats"
      );
      expect(migrationSQL).toContain("WITH (security_invoker = true)");
    });

    test("should handle activity_feed_secure conditionally", () => {
      expect(migrationSQL).toContain("IF EXISTS");
      expect(migrationSQL).toContain("information_schema.views");
      expect(migrationSQL).toContain("activity_feed_secure");
    });

    test("should include proper permission grants", () => {
      expect(migrationSQL).toContain("GRANT SELECT");
      expect(migrationSQL).toContain("authenticated");
      expect(migrationSQL).toContain("service_role");
    });

    test("should add security comments", () => {
      expect(migrationSQL).toContain("COMMENT ON VIEW");
      expect(migrationSQL).toContain("SECURITY INVOKER");
      expect(migrationSQL).toContain("respect user permissions");
    });
  });

  describe("View Definitions", () => {
    test("v_index_usage_stats should have correct columns", () => {
      expect(migrationSQL).toContain("schemaname");
      expect(migrationSQL).toContain("relname as tablename");
      expect(migrationSQL).toContain("indexrelname as indexname");
      expect(migrationSQL).toContain("idx_tup_read");
      expect(migrationSQL).toContain("idx_scan");
      expect(migrationSQL).toContain("avg_tuples_per_scan");
    });

    test("activity_feed_secure should have user context filtering", () => {
      expect(migrationSQL).toContain("auth.uid()");
      expect(migrationSQL).toContain("user_follows");
      expect(migrationSQL).toContain("follower_id");
    });

    test("should filter by public schema only", () => {
      expect(migrationSQL).toContain("WHERE schemaname = 'public'");
    });
  });

  describe("Error Handling", () => {
    test("should use conditional blocks for optional operations", () => {
      expect(migrationSQL).toContain("DO $$");
      expect(migrationSQL).toContain("BEGIN");
      expect(migrationSQL).toContain("IF EXISTS");
      expect(migrationSQL).toContain("RAISE NOTICE");
    });

    test("should handle view existence gracefully", () => {
      expect(migrationSQL).toContain("does not exist - skipping");
      expect(migrationSQL).toContain(
        "Fixed activity_feed_secure view with SECURITY INVOKER"
      );
    });
  });

  describe("Success Messaging", () => {
    test("should provide clear success feedback", () => {
      expect(migrationSQL).toContain(
        "✅ Security Definer Views Fixed Successfully"
      );
      expect(migrationSQL).toContain("✓ v_index_usage_stats");
      expect(migrationSQL).toContain("Views now respect user permissions");
    });

    test("should include verification instructions", () => {
      expect(migrationSQL).toContain("📋 Verification Commands");
      expect(migrationSQL).toContain("information_schema.views");
      expect(migrationSQL).toContain("🔒 Security Benefits");
    });
  });

  describe("SQL Syntax Validation", () => {
    test("should not contain obvious syntax errors", () => {
      // Check for common SQL syntax issues
      expect(migrationSQL).not.toContain(";;"); // Double semicolons
      expect(migrationSQL).toContain("COMMIT;"); // Should have proper COMMIT
      expect(migrationSQL).toContain("BEGIN;"); // Should have proper BEGIN
    });

    test("should have balanced quotes and parentheses", () => {
      const singleQuotes = (migrationSQL.match(/'/g) || []).length;
      const doubleQuotes = (migrationSQL.match(/"/g) || []).length;

      // Single quotes should be even (balanced)
      expect(singleQuotes % 2).toBe(0);

      // Double quotes should be even (balanced)
      expect(doubleQuotes % 2).toBe(0);

      // Parentheses should be balanced
      const openParens = (migrationSQL.match(/\(/g) || []).length;
      const closeParens = (migrationSQL.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });
  });

  describe("Security Best Practices", () => {
    test("should not use SECURITY DEFINER anywhere", () => {
      // Ensure we're not accidentally creating new SECURITY DEFINER views
      const securityDefinerMatches =
        migrationSQL.match(/SECURITY DEFINER/g) || [];
      // All matches should be in comments or documentation only
      securityDefinerMatches.forEach((match) => {
        const line = migrationSQL.split(match)[0].split("\n").pop();
        expect(line?.trim().startsWith("--") || line?.includes("/*")).toBe(
          true
        );
      });
    });

    test("should explicitly use SECURITY INVOKER", () => {
      expect(migrationSQL).toContain("security_invoker = true");
    });

    test("should include user permission filtering", () => {
      expect(migrationSQL).toContain("auth.uid()");
    });
  });
});
