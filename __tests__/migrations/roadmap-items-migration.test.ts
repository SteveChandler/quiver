/**
 * Migration: Create roadmap_items table
 *
 * Validates the SQL migration that creates roadmap_items with status/category enums,
 * public-read RLS policy, and relevant indexes.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("roadmap_items migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("create_roadmap_items")
    );
    if (!migrationFile) throw new Error("Migration file not found: *create_roadmap_items*");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Transaction wrapping", () => {
    it("is wrapped in BEGIN/COMMIT", () => {
      expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
    });
  });

  describe("Enum types", () => {
    it("creates roadmap_status enum", () => {
      expect(migrationSQL).toMatch(/CREATE TYPE public\.roadmap_status AS ENUM/i);
    });

    it("roadmap_status has the expected values", () => {
      expect(migrationSQL).toContain("under_consideration");
      expect(migrationSQL).toContain("in_progress");
      expect(migrationSQL).toContain("shipped");
      expect(migrationSQL).toContain("declined");
    });

    it("creates roadmap_category enum", () => {
      expect(migrationSQL).toMatch(/CREATE TYPE public\.roadmap_category AS ENUM/i);
    });

    it("roadmap_category has the expected values", () => {
      expect(migrationSQL).toContain("forecasts");
      expect(migrationSQL).toContain("logging");
      expect(migrationSQL).toContain("community");
      expect(migrationSQL).toContain("notifications");
      expect(migrationSQL).toContain("subscription");
      expect(migrationSQL).toContain("other");
    });
  });

  describe("Table definition", () => {
    it("creates roadmap_items table", () => {
      expect(migrationSQL).toMatch(/CREATE TABLE public\.roadmap_items/i);
    });

    it("has a uuid primary key", () => {
      expect(migrationSQL).toMatch(/id\s+uuid\s+PRIMARY KEY/i);
    });

    it("has title with length constraint", () => {
      expect(migrationSQL).toMatch(/title\s+text\s+NOT NULL/i);
      expect(migrationSQL).toMatch(/char_length\(title\)/i);
    });

    it("has description with length constraint", () => {
      expect(migrationSQL).toMatch(/description\s+text\s+NOT NULL/i);
      expect(migrationSQL).toMatch(/char_length\(description\)/i);
    });

    it("has category column of type roadmap_category", () => {
      expect(migrationSQL).toMatch(/category\s+public\.roadmap_category\s+NOT NULL/i);
    });

    it("has status column defaulting to under_consideration", () => {
      expect(migrationSQL).toMatch(/status\s+public\.roadmap_status\s+NOT NULL\s+DEFAULT\s+'under_consideration'/i);
    });

    it("has created_at and updated_at timestamps", () => {
      expect(migrationSQL).toMatch(/created_at\s+timestamptz\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
      expect(migrationSQL).toMatch(/updated_at\s+timestamptz\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
    });
  });

  describe("Indexes", () => {
    it("creates index on status", () => {
      expect(migrationSQL).toMatch(/CREATE INDEX.*roadmap_items_status_idx.*ON public\.roadmap_items.*\(status\)/i);
    });

    it("creates partial index on shipped_at for shipped rows", () => {
      expect(migrationSQL).toMatch(/CREATE INDEX.*roadmap_items_shipped_at_idx/i);
      expect(migrationSQL).toMatch(/WHERE status = 'shipped'/i);
    });
  });

  describe("Row Level Security", () => {
    it("enables RLS on roadmap_items", () => {
      expect(migrationSQL).toMatch(/ALTER TABLE public\.roadmap_items ENABLE ROW LEVEL SECURITY/i);
    });

    it("creates a public-read SELECT policy", () => {
      expect(migrationSQL).toMatch(/CREATE POLICY.*roadmap_items_public_read/i);
      expect(migrationSQL).toMatch(/FOR SELECT/i);
      expect(migrationSQL).toMatch(/USING\s*\(true\)/i);
    });
  });

  describe("Triggers", () => {
    it("wires set_updated_at BEFORE UPDATE trigger", () => {
      expect(migrationSQL).toMatch(/CREATE TRIGGER\s+set_roadmap_items_updated_at/i);
      expect(migrationSQL).toMatch(/BEFORE UPDATE ON public\.roadmap_items/i);
      expect(migrationSQL).toMatch(/EXECUTE FUNCTION public\.set_updated_at\(\)/i);
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
