/**
 * Migration 027: Fix Remaining Security Warnings Test
 *
 * This test validates the migration that fixes all remaining Supabase security linter warnings:
 * - 18 functions with mutable search_path issues
 * - 1 materialized view API exposure issue
 */

import { readFileSync } from "fs";
import { join } from "path";

describe("Migration 027: Fix Remaining Security Warnings", () => {
  let migrationSQL: string;
  const expectedFunctions = [
    "get_most_visited_beach",
    "update_follow_counts",
    "update_beach_name",
    "check_foreign_key_indexes",
    "increment",
    "decrement",
    "cleanup_old_enhanced_forecasts",
    "cleanup_old_activities",
    "create_beach_review_activity",
    "create_follow_activity",
    "format_coordinates",
    "direction_to_compass",
    "get_nearby_intel_posts",
    "consolidate_buoy_conditions",
    "get_user_activity_feed",
    "update_user_storage_usage",
    "add_session_owner_as_participant",
    "handle_invitation_acceptance",
  ];

  beforeAll(() => {
    // Read the migration file
    const migrationPath = join(
      __dirname,
      "../../scripts/migrations/027_fix_remaining_security_warnings.sql"
    );
    migrationSQL = readFileSync(migrationPath, "utf8");
  });

  describe("Migration Structure", () => {
    test("should contain proper transaction management", () => {
      expect(migrationSQL).toContain("BEGIN;");
      expect(migrationSQL).toContain("COMMIT;");
    });

    test("should include comprehensive security documentation", () => {
      expect(migrationSQL).toContain("SECURITY ISSUES ADDRESSED");
      expect(migrationSQL).toContain("Function Search Path Mutable");
      expect(migrationSQL).toContain("Materialized View in API");
      expect(migrationSQL).toContain("search path injection");
    });

    test("should document all 18 functions to fix", () => {
      expectedFunctions.forEach((functionName) => {
        expect(migrationSQL).toContain(functionName);
      });
    });

    test("should use proper SQL structure with clear sections", () => {
      expect(migrationSQL).toContain(
        "-- ================================================"
      );
      expect(
        migrationSQL.split(
          "-- ================================================"
        ).length
      ).toBeGreaterThan(20);
    });
  });

  describe("Security Fixes for All Functions", () => {
    expectedFunctions.forEach((functionName, index) => {
      test(`should fix ${functionName} function with search_path protection`, () => {
        expect(migrationSQL).toContain(
          `CREATE OR REPLACE FUNCTION ${functionName}`
        );

        // Find the function definition section
        const functionIndex = migrationSQL.indexOf(
          `CREATE OR REPLACE FUNCTION ${functionName}`
        );
        expect(functionIndex).toBeGreaterThan(-1);

        // Check for security definer and search_path in the same function block
        const nextFunctionIndex = migrationSQL.indexOf(
          "CREATE OR REPLACE FUNCTION",
          functionIndex + 1
        );
        const functionBlock =
          nextFunctionIndex > -1
            ? migrationSQL.substring(functionIndex, nextFunctionIndex)
            : migrationSQL.substring(functionIndex);

        expect(functionBlock).toContain("SECURITY DEFINER");
        expect(functionBlock).toContain("SET search_path = public, extensions");
      });
    });

    test("should include all functions in security comments", () => {
      expectedFunctions.forEach((functionName) => {
        expect(migrationSQL).toContain(`COMMENT ON FUNCTION ${functionName}`);
        expect(migrationSQL).toContain(
          "SECURITY DEFINER with search_path protection"
        );
      });
    });

    test("should use consistent security pattern", () => {
      const securityDefinerCount = (
        migrationSQL.match(/SECURITY DEFINER/g) || []
      ).length;
      const searchPathCount = (
        migrationSQL.match(/SET search_path = public, extensions/g) || []
      ).length;

      // Should have SECURITY DEFINER and SET search_path for each of the 18 functions
      expect(securityDefinerCount).toBeGreaterThanOrEqual(18);
      expect(searchPathCount).toBe(18);
    });

    test("should safely drop existing functions before recreation", () => {
      // Check that migration includes programmatic function dropping
      expectedFunctions.forEach((functionName) => {
        expect(migrationSQL).toContain(`p.proname = '${functionName}'`);
      });

      // Should use programmatic approach with system catalog queries
      expect(migrationSQL).toContain("pg_proc p");
      expect(migrationSQL).toContain("pg_namespace n");
      expect(migrationSQL).toContain("pg_get_function_identity_arguments");
      expect(migrationSQL).toContain("EXECUTE format");

      // Should have 18 programmatic drop blocks (one for each function)
      const dropBlockCount = (
        migrationSQL.match(
          /Drop all existing function overloads programmatically/g
        ) || []
      ).length;
      expect(dropBlockCount).toBe(18);
    });

    test("should properly handle trigger dependencies", () => {
      // Should drop triggers first
      expect(migrationSQL).toContain("Drop Dependent Triggers First");
      expect(migrationSQL).toContain(
        "DROP TRIGGER IF EXISTS trigger_beach_review_activity"
      );
      expect(migrationSQL).toContain(
        "DROP TRIGGER IF EXISTS trigger_follow_activity"
      );
      expect(migrationSQL).toContain(
        "DROP TRIGGER IF EXISTS add_session_owner_participant"
      );
      expect(migrationSQL).toContain(
        "DROP TRIGGER IF EXISTS handle_invitation_acceptance"
      );
      expect(migrationSQL).toContain(
        "DROP TRIGGER IF EXISTS update_follow_counts_insert"
      );
      expect(migrationSQL).toContain(
        "DROP TRIGGER IF EXISTS update_user_storage_usage_insert"
      );

      // Should recreate triggers after functions
      expect(migrationSQL).toContain("Recreate Dependent Triggers");
      expect(migrationSQL).toContain(
        "CREATE TRIGGER trigger_beach_review_activity"
      );
      expect(migrationSQL).toContain("CREATE TRIGGER trigger_follow_activity");
      expect(migrationSQL).toContain(
        "CREATE TRIGGER add_session_owner_participant"
      );
      expect(migrationSQL).toContain(
        "CREATE TRIGGER handle_invitation_acceptance"
      );
      expect(migrationSQL).toContain(
        "CREATE TRIGGER update_follow_counts_insert"
      );
      expect(migrationSQL).toContain(
        "CREATE TRIGGER update_user_storage_usage_insert"
      );
    });
  });

  describe("Function-Specific Validations", () => {
    test("get_most_visited_beach should return proper columns", () => {
      expect(migrationSQL).toContain(
        "RETURNS TABLE(beach_id UUID, visit_count BIGINT, beach_name TEXT)"
      );
      expect(migrationSQL).toContain(
        "LEFT JOIN sessions s ON b.id = s.beach_id"
      );
      expect(migrationSQL).toContain("ORDER BY visit_count DESC");
    });

    test("trigger functions should handle operations properly", () => {
      expect(migrationSQL).toContain("RETURNS TRIGGER");
      expect(migrationSQL).toContain("TG_OP = 'INSERT'");
      expect(migrationSQL).toContain("TG_OP = 'DELETE'");
      expect(migrationSQL).toContain("followers_count");
      expect(migrationSQL).toContain("following_count");
    });

    test("check_foreign_key_indexes should return proper structure", () => {
      expect(migrationSQL).toContain("table_name text");
      expect(migrationSQL).toContain("constraint_name text");
      expect(migrationSQL).toContain("has_covering_index boolean");
      expect(migrationSQL).toContain("information_schema.table_constraints");
    });

    test("utility functions should have simple implementations", () => {
      expect(migrationSQL).toContain("RETURN val + amount"); // increment
      expect(migrationSQL).toContain("RETURN val - amount"); // decrement
    });

    test("cleanup functions should use proper date filtering", () => {
      expect(migrationSQL).toContain("days_to_keep INTEGER DEFAULT");
      expect(migrationSQL).toContain("INTERVAL '1 day'");
      expect(migrationSQL).toContain(
        "GET DIAGNOSTICS deleted_count = ROW_COUNT"
      );
    });

    test("activity functions should create proper activity records", () => {
      expect(migrationSQL).toContain("INSERT INTO user_activities");
      expect(migrationSQL).toContain("activity_type");
      expect(migrationSQL).toContain("entity_type");
      // Note: Some are trigger functions that don't return activity_id
      expect(migrationSQL).toContain("beach_reviewed");
    });

    test("coordinate functions should handle geographic data", () => {
      expect(migrationSQL).toContain("precision_digits INT DEFAULT 5");
      expect(migrationSQL).toContain("lat_dir TEXT");
      expect(migrationSQL).toContain("lng_dir TEXT");
      expect(migrationSQL).toContain("precision_level TEXT DEFAULT 'high'");
    });

    test("intel functions should use spatial queries", () => {
      expect(migrationSQL).toContain("ST_Distance");
      expect(migrationSQL).toContain("ST_Point");
      expect(migrationSQL).toContain("::geography");
      expect(migrationSQL).toContain("radius_meters");
    });

    test("session management functions should handle participants", () => {
      expect(migrationSQL).toContain("session_participants");
      expect(migrationSQL).toContain("status = 'planned'");
      expect(migrationSQL).toContain("status = 'accepted'");
      expect(migrationSQL).toContain("ON CONFLICT");
    });
  });

  describe("Materialized View Security Fix", () => {
    test("should address activity_feed materialized view", () => {
      expect(migrationSQL).toContain("activity_feed materialized view");
      expect(migrationSQL).toContain("pg_matviews");
      expect(migrationSQL).toContain("matviewname = 'activity_feed'");
    });

    test("should revoke access from public roles", () => {
      expect(migrationSQL).toContain("REVOKE ALL ON activity_feed FROM anon");
      expect(migrationSQL).toContain(
        "REVOKE ALL ON activity_feed FROM authenticated"
      );
      expect(migrationSQL).toContain("REVOKE ALL ON activity_feed FROM public");
    });

    test("should grant access only to service_role", () => {
      expect(migrationSQL).toContain(
        "GRANT SELECT ON activity_feed TO service_role"
      );
    });

    test("should handle non-existent view gracefully", () => {
      expect(migrationSQL).toContain("IF EXISTS");
      expect(migrationSQL).toContain("does not exist - skipping");
    });
  });

  describe("Error Handling and Safety", () => {
    test("should use conditional blocks for safety", () => {
      expect(migrationSQL).toContain("DO $$");
      expect(migrationSQL).toContain("IF EXISTS");
      expect(migrationSQL).toContain("RAISE NOTICE");
    });

    test("should handle function overloads with programmatic approach", () => {
      // Should use programmatic approach to handle multiple function signatures
      expect(migrationSQL).toContain(
        "Drop all existing function overloads programmatically"
      );
      expect(migrationSQL).toContain("FOR func_record IN");
      expect(migrationSQL).toContain(
        "pg_get_function_identity_arguments(p.oid) as args"
      );

      // Should use dynamic SQL to drop functions with exact signatures
      expect(migrationSQL).toContain(
        "EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE'"
      );
      expect(migrationSQL).toContain("func_record.args");

      // Should provide detailed logging
      expect(migrationSQL).toContain("RAISE NOTICE 'Dropped function: %(%)'");
    });

    test("should provide clear success messaging", () => {
      expect(migrationSQL).toContain(
        "✅ All Security Warnings Fixed Successfully"
      );
      expect(migrationSQL).toContain(
        "Fixed 18 functions with search_path protection"
      );
      expect(migrationSQL).toContain("Secured activity_feed materialized view");
    });

    test("should include verification instructions", () => {
      expect(migrationSQL).toContain("Verification Queries");
      expect(migrationSQL).toContain("pg_get_functiondef");
      expect(migrationSQL).toContain("PROTECTED");
      expect(migrationSQL).toContain("VULNERABLE");
    });

    test("should document remaining auth warnings", () => {
      expect(migrationSQL).toContain("Remaining Auth Security Warnings");
      expect(migrationSQL).toContain("leaked password protection");
      expect(migrationSQL).toContain("MFA options");
      expect(migrationSQL).toContain("dashboard config");
    });
  });

  describe("SQL Syntax Validation", () => {
    test("should not contain obvious syntax errors", () => {
      // Check for common SQL syntax issues
      expect(migrationSQL).not.toContain(";;"); // Double semicolons
      expect(migrationSQL.match(/BEGIN;/g)?.length).toBe(1);
      expect(migrationSQL.match(/COMMIT;/g)?.length).toBe(1);
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

    test("should have proper function declarations", () => {
      expectedFunctions.forEach((functionName) => {
        // Each function should have proper LANGUAGE declaration
        const functionRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION ${functionName}[\\s\\S]*?LANGUAGE plpgsql`,
          "g"
        );
        expect(migrationSQL).toMatch(functionRegex);
      });
    });

    test("should use proper PostgreSQL syntax", () => {
      // Check for PostgreSQL-specific syntax
      expect(migrationSQL).toContain("UUID");
      expect(migrationSQL).toContain("TIMESTAMP WITH TIME ZONE");
      expect(migrationSQL).toContain("JSONB");
      expect(migrationSQL).toContain("$$");
    });
  });

  describe("Security Best Practices", () => {
    test("should not accidentally create SECURITY DEFINER without search_path", () => {
      // Find all SECURITY DEFINER occurrences
      const securityDefinerMatches = [
        ...migrationSQL.matchAll(/SECURITY DEFINER/g),
      ];

      securityDefinerMatches.forEach((match) => {
        const position = match.index!;
        // Find the next SET search_path occurrence after this SECURITY DEFINER
        const nextSearchPath = migrationSQL.indexOf(
          "SET search_path",
          position
        );
        const nextFunction = migrationSQL.indexOf(
          "CREATE OR REPLACE FUNCTION",
          position + 1
        );

        // SET search_path should come before the next function (or be within reasonable distance)
        if (nextFunction > -1) {
          expect(nextSearchPath).toBeLessThan(nextFunction);
          expect(nextSearchPath - position).toBeLessThan(500); // Should be within 500 characters
        } else {
          expect(nextSearchPath).toBeGreaterThan(position);
        }
      });
    });

    test("should use consistent search_path value", () => {
      const searchPathMatches =
        migrationSQL.match(/SET search_path = public, extensions/g) || [];
      expect(searchPathMatches.length).toBe(18);
      searchPathMatches.forEach((match) => {
        expect(match).toBe("SET search_path = public, extensions");
      });
    });

    test("should include proper function signatures", () => {
      // Check that functions have proper parameter types
      expect(migrationSQL).toContain("UUID");
      expect(migrationSQL).toContain("INTEGER");
      expect(migrationSQL).toContain("TEXT");
      expect(migrationSQL).toContain("FLOAT");
      expect(migrationSQL).toContain("BOOLEAN");
    });

    test("should handle all security warnings mentioned in the original list", () => {
      // This should match the exact functions from the security warning list
      const securityWarningFunctions = [
        "get_most_visited_beach",
        "update_follow_counts",
        "update_beach_name",
        "check_foreign_key_indexes",
        "increment",
        "decrement",
        "cleanup_old_enhanced_forecasts",
        "cleanup_old_activities",
        "create_beach_review_activity",
        "create_follow_activity",
        "format_coordinates",
        "direction_to_compass",
        "get_nearby_intel_posts",
        "consolidate_buoy_conditions",
        "get_user_activity_feed",
        "update_user_storage_usage",
        "add_session_owner_as_participant",
        "handle_invitation_acceptance",
      ];

      expect(expectedFunctions).toEqual(securityWarningFunctions);
      expect(expectedFunctions.length).toBe(18);
    });
  });

  describe("Migration Completeness", () => {
    test("should address all security warnings from the linter", () => {
      // Should fix function search path issues
      expect(migrationSQL).toContain("Function Search Path Mutable");

      // Should fix materialized view API exposure
      expect(migrationSQL).toContain("Materialized View in API");

      // Should document auth warnings that need dashboard config
      expect(migrationSQL).toContain("leaked password protection");
      expect(migrationSQL).toContain("MFA options");
    });

    test("should provide verification tools", () => {
      expect(migrationSQL).toContain("pg_get_functiondef");
      expect(migrationSQL).toContain("information_schema");
      expect(migrationSQL).toContain("pg_matviews");
    });

    test("should include success metrics", () => {
      expect(migrationSQL).toContain("18 functions");
      expect(migrationSQL).toContain("search_path protection");
      expect(migrationSQL).toContain("service_role only");
    });
  });
});
