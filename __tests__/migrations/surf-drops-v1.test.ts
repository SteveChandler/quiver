import fs from "node:fs";
import path from "node:path";

function readSurfDropsMigration(): string {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migration = fs
    .readdirSync(migrationsDir)
    .find((name) => /^\d{14}_surf_drops_v1\.sql$/.test(name));

  if (!migration) {
    throw new Error("Surf Drops V1 migration not found");
  }

  return fs.readFileSync(path.join(migrationsDir, migration), "utf8");
}

describe("Surf Drops V1 migration", () => {
  let sql: string;

  beforeAll(() => {
    sql = readSurfDropsMigration();
  });

  it("is additive, wrapped, and uses user_id instead of profile_id/creator_id for the new drop owner column", () => {
    expect(sql).toMatch(/^\s*BEGIN;/i);
    expect(sql).toMatch(/COMMIT;\s*$/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.surf_drops/i);
    expect(sql).toMatch(/user_id\s+uuid\s+not null\s+references auth\.users\(id\)/i);
    expect(sql).not.toMatch(/\bprofile_id\b/i);
    expect(sql).not.toMatch(/\bcreator_id\s+uuid\b/i);
  });

  it("creates all V1 tables, privacy indexes, RLS policies, and grants", () => {
    expect(sql).toMatch(/CREATE TYPE public\.surf_drop_audience AS ENUM/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.surf_drop_participants/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.surf_drop_link_grants/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.amenities/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.qr_business_venues/i);
    expect(sql).toMatch(/ALTER TABLE public\.surf_drops ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/CREATE POLICY surf_drops_select_visible/i);
    expect(sql).toMatch(/CREATE POLICY surf_drop_link_grants_insert_service_role/i);
    expect(sql).toMatch(/GRANT SELECT ON TABLE public\.amenities TO anon, authenticated/i);
    expect(sql).toMatch(/activated_at IS NOT NULL OR admin_visible = true/i);
  });

  it("adds mutual-follow, slug, updated_at, and QR activation helpers", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_mutual_follow\(a uuid, b uuid\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.generate_surf_drop_slug\(\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.set_surf_drops_updated_at\(\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.activate_qr_business_venue_on_scan\(\)/i);
  });

  it("enforces location, time, note, and QR threshold constraints", () => {
    expect(sql).toMatch(/surf_drops_time_window/i);
    expect(sql).toMatch(/surf_drops_max_ahead/i);
    expect(sql).toMatch(/surf_drops_note_length/i);
    expect(sql).toMatch(/surf_drops_location/i);
    expect(sql).toMatch(/qr_business_venues_activation_threshold_check/i);
  });
});
