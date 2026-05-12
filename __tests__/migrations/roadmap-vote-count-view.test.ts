/**
 * Migration: Create roadmap_items_with_vote_count view
 *
 * Validates the SQL migration that creates a read view joining roadmap_items
 * with an aggregated count of roadmap_votes. Key invariants: security_invoker,
 * LEFT JOIN subquery, COALESCE null-safety, and GRANT to anon + authenticated.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("roadmap_items_with_vote_count view migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("create_roadmap_items_with_vote_count_view")
    );
    if (!migrationFile)
      throw new Error(
        "Migration file not found: *create_roadmap_items_with_vote_count_view*"
      );
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Transaction wrapping", () => {
    it("is wrapped in BEGIN/COMMIT", () => {
      expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
    });
  });

  describe("View definition", () => {
    it("creates public.roadmap_items_with_vote_count view", () => {
      expect(migrationSQL).toMatch(
        /CREATE VIEW public\.roadmap_items_with_vote_count/i
      );
    });

    it("uses security_invoker = true to defer RLS to base tables", () => {
      // Critical: without this, Postgres defaults to SECURITY DEFINER (superuser),
      // which bypasses RLS on roadmap_items and roadmap_votes and triggers a
      // Supabase security lint warning.
      expect(migrationSQL).toMatch(/security_invoker\s*=\s*true/i);
    });
  });

  describe("Column selection", () => {
    it("selects id from roadmap_items", () => {
      expect(migrationSQL).toMatch(/\bi\.id\b/);
    });

    it("selects title", () => {
      expect(migrationSQL).toMatch(/\bi\.title\b/);
    });

    it("selects description", () => {
      expect(migrationSQL).toMatch(/\bi\.description\b/);
    });

    it("selects category", () => {
      expect(migrationSQL).toMatch(/\bi\.category\b/);
    });

    it("selects status", () => {
      expect(migrationSQL).toMatch(/\bi\.status\b/);
    });

    it("selects eta_label", () => {
      expect(migrationSQL).toMatch(/\bi\.eta_label\b/);
    });

    it("selects founder_reply", () => {
      expect(migrationSQL).toMatch(/\bi\.founder_reply\b/);
    });

    it("selects shipped_at", () => {
      expect(migrationSQL).toMatch(/\bi\.shipped_at\b/);
    });

    it("selects created_at", () => {
      expect(migrationSQL).toMatch(/\bi\.created_at\b/);
    });

    it("selects updated_at", () => {
      expect(migrationSQL).toMatch(/\bi\.updated_at\b/);
    });

    it("selects vote_count via COALESCE cast to integer (not bigint)", () => {
      // COALESCE ensures 0 instead of NULL for items with no votes.
      // ::integer cast prevents a bigint leaking to JS as a string.
      expect(migrationSQL).toMatch(
        /COALESCE\s*\(\s*v\.vote_count\s*,\s*0\s*\)\s*::integer\s+AS\s+vote_count/i
      );
    });
  });

  describe("JOIN to aggregated roadmap_votes", () => {
    it("LEFT JOINs to a subquery on roadmap_votes", () => {
      expect(migrationSQL).toMatch(/LEFT JOIN/i);
      expect(migrationSQL).toMatch(/FROM\s+public\.roadmap_votes/i);
    });

    it("aggregates vote_count via COUNT(*)", () => {
      expect(migrationSQL).toMatch(/COUNT\s*\(\s*\*\s*\)\s+AS\s+vote_count/i);
    });

    it("groups the subquery by item_id", () => {
      expect(migrationSQL).toMatch(/GROUP BY\s+item_id/i);
    });

    it("joins the subquery on item_id = i.id", () => {
      expect(migrationSQL).toMatch(/v\.item_id\s*=\s*i\.id/i);
    });
  });

  describe("Grants", () => {
    it("grants SELECT to anon and authenticated roles", () => {
      expect(migrationSQL).toMatch(
        /GRANT SELECT ON public\.roadmap_items_with_vote_count TO anon,\s*authenticated/i
      );
    });
  });

  describe("SQL syntax", () => {
    it("has no double semicolons", () => {
      expect(migrationSQL).not.toContain(";;");
    });

    it("has balanced parentheses", () => {
      const open = (migrationSQL.match(/\(/g) ?? []).length;
      const close = (migrationSQL.match(/\)/g) ?? []).length;
      expect(open).toBe(close);
    });
  });
});
