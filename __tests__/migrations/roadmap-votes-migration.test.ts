/**
 * Migration: Create roadmap_votes table
 *
 * Validates the SQL migration that creates roadmap_votes with a composite PK,
 * FK constraints to roadmap_items and auth.users, indexes, RLS, and three
 * policies (public-read, own-insert, own-delete).
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("roadmap_votes migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("create_roadmap_votes")
    );
    if (!migrationFile) throw new Error("Migration file not found: *create_roadmap_votes*");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Transaction wrapping", () => {
    it("is wrapped in BEGIN/COMMIT", () => {
      expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
    });
  });

  describe("Table definition", () => {
    it("creates roadmap_votes table", () => {
      expect(migrationSQL).toMatch(/CREATE TABLE public\.roadmap_votes/i);
    });

    it("has item_id column as uuid NOT NULL", () => {
      expect(migrationSQL).toMatch(/item_id\s+uuid\s+NOT NULL/i);
    });

    it("has user_id column as uuid NOT NULL", () => {
      expect(migrationSQL).toMatch(/user_id\s+uuid\s+NOT NULL/i);
    });

    it("has created_at timestamptz NOT NULL defaulting to now()", () => {
      expect(migrationSQL).toMatch(/created_at\s+timestamptz\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
    });

    it("has composite PRIMARY KEY (item_id, user_id)", () => {
      expect(migrationSQL).toMatch(/PRIMARY KEY\s*\(\s*item_id\s*,\s*user_id\s*\)/i);
    });
  });

  describe("Foreign keys", () => {
    it("item_id references public.roadmap_items(id) ON DELETE CASCADE", () => {
      expect(migrationSQL).toMatch(/item_id\s+uuid\s+NOT NULL\s+REFERENCES\s+public\.roadmap_items\s*\(id\)\s+ON DELETE CASCADE/i);
    });

    it("user_id references auth.users(id) ON DELETE CASCADE", () => {
      expect(migrationSQL).toMatch(/user_id\s+uuid\s+NOT NULL\s+REFERENCES\s+auth\.users\s*\(id\)\s+ON DELETE CASCADE/i);
    });
  });

  describe("Indexes", () => {
    it("creates roadmap_votes_user_id_idx on user_id", () => {
      expect(migrationSQL).toMatch(/CREATE INDEX\s+roadmap_votes_user_id_idx\s+ON public\.roadmap_votes\s*\(user_id\)/i);
    });
  });

  describe("Row Level Security", () => {
    it("enables RLS on roadmap_votes", () => {
      expect(migrationSQL).toMatch(/ALTER TABLE public\.roadmap_votes ENABLE ROW LEVEL SECURITY/i);
    });

    it("creates roadmap_votes_public_read SELECT policy with USING (true)", () => {
      expect(migrationSQL).toMatch(/CREATE POLICY\s+roadmap_votes_public_read/i);
      expect(migrationSQL).toMatch(/roadmap_votes_public_read[\s\S]*?FOR SELECT/i);
      expect(migrationSQL).toMatch(/roadmap_votes_public_read[\s\S]*?USING\s*\(\s*true\s*\)/i);
    });

    it("creates roadmap_votes_own_insert INSERT policy with WITH CHECK (auth.uid() = user_id)", () => {
      expect(migrationSQL).toMatch(/CREATE POLICY\s+roadmap_votes_own_insert/i);
      expect(migrationSQL).toMatch(/roadmap_votes_own_insert[\s\S]*?FOR INSERT/i);
      expect(migrationSQL).toMatch(/roadmap_votes_own_insert[\s\S]*?WITH CHECK\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
    });

    it("creates roadmap_votes_own_delete DELETE policy with USING (auth.uid() = user_id)", () => {
      expect(migrationSQL).toMatch(/CREATE POLICY\s+roadmap_votes_own_delete/i);
      expect(migrationSQL).toMatch(/roadmap_votes_own_delete[\s\S]*?FOR DELETE/i);
      expect(migrationSQL).toMatch(/roadmap_votes_own_delete[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
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
