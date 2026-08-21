import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("custom spot favorites migration", () => {
  let migrationSQL: string;
  let freeTierMigrationSQL: string;

  beforeAll(() => {
    const migrationDir = join(__dirname, "../../supabase/migrations");
    const files = readdirSync(migrationDir);
    const migrationFile = files.find((f: string) =>
      f.includes("custom_spot_favorites")
    );
    if (!migrationFile) throw new Error("Migration file not found: *custom_spot_favorites*");
    migrationSQL = readFileSync(join(migrationDir, migrationFile), "utf-8");
    freeTierMigrationSQL = readFileSync(
      join(migrationDir, "20260821150000_make_custom_spots_free_tier.sql"),
      "utf-8",
    );
  });

  it("is wrapped in BEGIN/COMMIT", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("adds custom_spot_id to favorite_beaches and allows beach_id to be null", () => {
    expect(migrationSQL).toMatch(/ADD COLUMN IF NOT EXISTS custom_spot_id uuid REFERENCES public\.custom_spots\(id\) ON DELETE CASCADE/i);
    expect(migrationSQL).toMatch(/ALTER COLUMN beach_id DROP NOT NULL/i);
  });

  it("requires exactly one favorite target", () => {
    expect(migrationSQL).toContain("favorite_beaches_exactly_one_target");
    expect(migrationSQL).toMatch(/CHECK \(\(beach_id IS NOT NULL\) <> \(custom_spot_id IS NOT NULL\)\)/i);
  });

  it("keeps alerts beach-only", () => {
    expect(migrationSQL).toContain("favorite_beaches_custom_alerts_disabled");
    expect(migrationSQL).toMatch(/CHECK \(custom_spot_id IS NULL OR alerts_enabled = false\)/i);
  });

  it("creates uniqueness for beach and custom spot favorites", () => {
    expect(migrationSQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS favorite_beaches_unique_beach/i);
    expect(migrationSQL).toMatch(/WHERE beach_id IS NOT NULL/i);
    expect(migrationSQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS favorite_beaches_unique_custom_spot/i);
    expect(migrationSQL).toMatch(/WHERE custom_spot_id IS NOT NULL/i);
  });

  it("adds a mixed-target toggle RPC and preserves the beach wrapper", () => {
    expect(migrationSQL).toMatch(/CREATE OR REPLACE FUNCTION public\.toggle_favorite_spot_guarded/i);
    expect(migrationSQL).toContain("favorite_quota_exceeded");
    expect(migrationSQL).toContain("free_favorites_limit");
    expect(migrationSQL).toMatch(/CREATE OR REPLACE FUNCTION public\.toggle_favorite_beach_guarded\(p_beach_id uuid\)/i);
    expect(migrationSQL).toMatch(/toggle_favorite_spot_guarded\(p_beach_id, NULL::uuid\)/i);
  });

  it("creates custom spots atomically with their favorite row", () => {
    expect(migrationSQL).toMatch(/CREATE OR REPLACE FUNCTION public\.create_custom_spot_guarded/i);
    expect(migrationSQL).toContain("custom_spot_out_of_coverage");
    expect(migrationSQL).toMatch(/INSERT INTO public\.custom_spots/i);
    expect(migrationSQL).toMatch(/INSERT INTO public\.favorite_beaches/i);
  });

  it("qualifies favorite rows inside the create RPC to avoid output column ambiguity", () => {
    expect(migrationSQL).toMatch(/FROM public\.favorite_beaches fb\s+WHERE fb\.user_id = current_user_id/i);
    expect(migrationSQL).toMatch(/SELECT COALESCE\(max\(fb\.rank\), 0\) \+ 1 INTO next_rank/i);
  });

  it("removes custom favorite rows on soft delete", () => {
    expect(migrationSQL).toMatch(/CREATE OR REPLACE FUNCTION public\.remove_custom_spot_favorite_on_soft_delete/i);
    expect(migrationSQL).toMatch(/AFTER UPDATE OF deleted_at ON public\.custom_spots/i);
    expect(migrationSQL).toMatch(/DELETE FROM public\.favorite_beaches\s+WHERE custom_spot_id = NEW\.id/i);
  });

  it("makes custom spots free without removing ownership or favorite linkage", () => {
    const createFunction = freeTierMigrationSQL.match(
      /CREATE OR REPLACE FUNCTION public\.create_custom_spot_guarded[\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(freeTierMigrationSQL).toMatch(/^BEGIN;/m);
    expect(freeTierMigrationSQL).toMatch(/^COMMIT;/m);
    expect(createFunction).toMatch(/INSERT INTO public\.custom_spots/i);
    expect(createFunction).toMatch(/INSERT INTO public\.favorite_beaches/i);
    expect(createFunction).not.toContain("favorite_quota_exceeded");
    expect(createFunction).not.toContain("free_favorites_limit");
  });

  it("counts only curated beaches for the free favorites quota", () => {
    expect(freeTierMigrationSQL).toMatch(
      /FROM public\.favorite_beaches fb\s+WHERE fb\.user_id = current_user_id\s+AND fb\.beach_id IS NOT NULL/i,
    );
    expect(freeTierMigrationSQL).toMatch(/IF p_custom_spot_id IS NULL THEN[\s\S]*favorite_quota_exceeded/i);
  });
});
