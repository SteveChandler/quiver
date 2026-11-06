import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20261105090000_custom_spot_anchor_terrain.sql");
const rollback = read("supabase/rollbacks/20261105090000_custom_spot_anchor_terrain_rollback.sql");

describe("custom spot anchor terrain schema", () => {
  it("is a new, transaction-wrapped table that leaves beaches alone", () => {
    expect(migration).toMatch(/^BEGIN;/m);
    expect(migration).toMatch(/^COMMIT;/m);
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.custom_spot_anchor_terrain");
    expect(migration).not.toMatch(/ALTER TABLE public\.beaches/i);
    expect(migration).not.toMatch(/UPDATE public\.beaches/i);
  });

  it("validates both factor arrays", () => {
    expect(migration).toContain("is_valid_directional_factor_array(swell_access_factors)");
    expect(migration).toContain("is_valid_directional_factor_array(wind_exposure_factors)");
  });

  it("is service role only", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.custom_spot_anchor_terrain FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT ALL ON TABLE public.custom_spot_anchor_terrain TO service_role");
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });

  it("has a rollback", () => {
    expect(rollback).toContain("DROP TABLE IF EXISTS public.custom_spot_anchor_terrain");
  });
});
