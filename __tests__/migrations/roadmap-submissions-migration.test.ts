/**
 * Migration: Create roadmap_item_submissions table
 *
 * Validates the SQL migration that creates roadmap_item_submissions with
 * the roadmap_submission_decision enum, submitter-scoped RLS policies,
 * FK constraints (CASCADE on submitter, SET NULL on merged_into_item_id),
 * partial index on pending decisions, and updated_at trigger.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("roadmap_item_submissions migration", () => {
  let migrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("create_roadmap_item_submissions")
    );
    if (!migrationFile)
      throw new Error(
        "Migration file not found: *create_roadmap_item_submissions*"
      );
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
  });

  describe("Transaction wrapping", () => {
    it("is wrapped in BEGIN/COMMIT", () => {
      expect(migrationSQL).toMatch(/^BEGIN;/m);
      expect(migrationSQL).toMatch(/^COMMIT;/m);
    });
  });

  describe("Enum type: roadmap_submission_decision", () => {
    it("creates roadmap_submission_decision enum", () => {
      expect(migrationSQL).toMatch(
        /CREATE TYPE public\.roadmap_submission_decision AS ENUM/i
      );
    });

    it("enum has 'pending' value", () => {
      expect(migrationSQL).toContain("'pending'");
    });

    it("enum has 'approved' value", () => {
      expect(migrationSQL).toContain("'approved'");
    });

    it("enum has 'declined' value", () => {
      expect(migrationSQL).toContain("'declined'");
    });

    it("enum has 'merged_into' value", () => {
      expect(migrationSQL).toContain("'merged_into'");
    });
  });

  describe("Table definition", () => {
    it("creates roadmap_item_submissions table", () => {
      expect(migrationSQL).toMatch(
        /CREATE TABLE public\.roadmap_item_submissions/i
      );
    });

    it("has id as uuid PRIMARY KEY with gen_random_uuid() default", () => {
      expect(migrationSQL).toMatch(
        /id\s+uuid\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/i
      );
    });

    it("has title text NOT NULL with char_length CHECK (1 to 60)", () => {
      expect(migrationSQL).toMatch(/title\s+text\s+NOT NULL/i);
      expect(migrationSQL).toMatch(
        /char_length\(title\)\s+BETWEEN\s+1\s+AND\s+60/i
      );
    });

    it("has description text NOT NULL with char_length CHECK (1 to 500)", () => {
      expect(migrationSQL).toMatch(/description\s+text\s+NOT NULL/i);
      expect(migrationSQL).toMatch(
        /char_length\(description\)\s+BETWEEN\s+1\s+AND\s+500/i
      );
    });

    it("has category of type public.roadmap_category NOT NULL", () => {
      expect(migrationSQL).toMatch(
        /category\s+public\.roadmap_category\s+NOT NULL/i
      );
    });

    it("has submitter_user_id uuid NOT NULL", () => {
      expect(migrationSQL).toMatch(/submitter_user_id\s+uuid\s+NOT NULL/i);
    });

    it("has decision of type public.roadmap_submission_decision NOT NULL defaulting to 'pending'", () => {
      expect(migrationSQL).toMatch(
        /decision\s+public\.roadmap_submission_decision\s+NOT NULL\s+DEFAULT\s+'pending'/i
      );
    });

    it("has merged_into_item_id as nullable uuid", () => {
      // nullable — no NOT NULL after the type
      expect(migrationSQL).toMatch(/merged_into_item_id\s+uuid/i);
      // must NOT have NOT NULL immediately following the column type
      expect(migrationSQL).not.toMatch(/merged_into_item_id\s+uuid\s+NOT NULL/i);
    });

    it("has founder_reply as nullable text with CHECK <= 1000", () => {
      expect(migrationSQL).toMatch(/founder_reply\s+text/i);
      expect(migrationSQL).toMatch(
        /founder_reply IS NULL OR char_length\(founder_reply\)\s*<=\s*1000/i
      );
    });

    it("has created_at timestamptz NOT NULL defaulting to now()", () => {
      expect(migrationSQL).toMatch(
        /created_at\s+timestamptz\s+NOT NULL\s+DEFAULT\s+now\(\)/i
      );
    });

    it("has updated_at timestamptz NOT NULL defaulting to now()", () => {
      expect(migrationSQL).toMatch(
        /updated_at\s+timestamptz\s+NOT NULL\s+DEFAULT\s+now\(\)/i
      );
    });
  });

  describe("Foreign keys", () => {
    it("submitter_user_id references auth.users(id) ON DELETE CASCADE", () => {
      expect(migrationSQL).toMatch(
        /submitter_user_id\s+uuid\s+NOT NULL\s+REFERENCES\s+auth\.users\s*\(id\)\s+ON DELETE CASCADE/i
      );
    });

    it("merged_into_item_id references public.roadmap_items(id) ON DELETE SET NULL", () => {
      expect(migrationSQL).toMatch(
        /merged_into_item_id\s+uuid\s+REFERENCES\s+public\.roadmap_items\s*\(id\)\s+ON DELETE SET NULL/i
      );
    });
  });

  describe("Indexes", () => {
    it("creates roadmap_item_submissions_submitter_idx on submitter_user_id", () => {
      expect(migrationSQL).toMatch(
        /CREATE INDEX\s+roadmap_item_submissions_submitter_idx\s+ON public\.roadmap_item_submissions\s*\(\s*submitter_user_id\s*\)/i
      );
    });

    it("creates partial roadmap_item_submissions_decision_idx WHERE decision = 'pending'", () => {
      expect(migrationSQL).toMatch(
        /CREATE INDEX\s+roadmap_item_submissions_decision_idx\s+ON public\.roadmap_item_submissions\s*\(\s*decision\s*\)/i
      );
      expect(migrationSQL).toMatch(/WHERE decision = 'pending'/i);
    });
  });

  describe("Row Level Security", () => {
    it("enables RLS on roadmap_item_submissions", () => {
      expect(migrationSQL).toMatch(
        /ALTER TABLE public\.roadmap_item_submissions ENABLE ROW LEVEL SECURITY/i
      );
    });

    it("creates roadmap_submissions_own_read SELECT policy with USING (auth.uid() = submitter_user_id)", () => {
      expect(migrationSQL).toMatch(
        /CREATE POLICY\s+roadmap_submissions_own_read/i
      );
      expect(migrationSQL).toMatch(
        /roadmap_submissions_own_read[\s\S]*?FOR SELECT/i
      );
      expect(migrationSQL).toMatch(
        /roadmap_submissions_own_read[\s\S]*?USING\s*\(\s*auth\.uid\(\)\s*=\s*submitter_user_id\s*\)/i
      );
    });

    it("creates roadmap_submissions_own_insert INSERT policy with WITH CHECK (auth.uid() = submitter_user_id)", () => {
      expect(migrationSQL).toMatch(
        /CREATE POLICY\s+roadmap_submissions_own_insert/i
      );
      expect(migrationSQL).toMatch(
        /roadmap_submissions_own_insert[\s\S]*?FOR INSERT/i
      );
      expect(migrationSQL).toMatch(
        /roadmap_submissions_own_insert[\s\S]*?WITH CHECK\s*\(\s*auth\.uid\(\)\s*=\s*submitter_user_id\s*\)/i
      );
    });
  });

  describe("Triggers", () => {
    it("wires set_updated_at BEFORE UPDATE trigger", () => {
      expect(migrationSQL).toMatch(
        /CREATE TRIGGER\s+set_roadmap_item_submissions_updated_at/i
      );
      expect(migrationSQL).toMatch(
        /BEFORE UPDATE ON public\.roadmap_item_submissions/i
      );
      expect(migrationSQL).toMatch(
        /EXECUTE FUNCTION public\.set_updated_at\(\)/i
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
