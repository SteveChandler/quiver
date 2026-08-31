import { readFileSync } from "fs";
import { join } from "path";

import { getStationForLocation } from "@/lib/services/noaa-coops/station-resolver";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260830120000_add_virginia_surf_beaches.sql"),
  "utf8"
);
const repairMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260830192230_reapply_virginia_surf_beaches.sql"),
  "utf8"
);

describe("Virginia surf beach catalog", () => {
  it("imports ten public spots with production eligibility and forecast data", () => {
    const catalog = migration.slice(
      migration.indexOf("INSERT INTO _virginia_beaches VALUES"),
      migration.indexOf("INSERT INTO public.beaches")
    );
    const ids = catalog.match(/[0-9a-f]{8}-[0-9a-f-]{27}/g) ?? [];

    expect(new Set(ids).size).toBe(10);
    expect(migration).toContain("'America/New_York'");
    expect(migration).toContain("editorial_reviewed_at,\n  seo_indexable");
    expect(migration).toContain("'publisher', CASE");
    expect(migration).toContain("'retrievedAt', '2026-08-30'");
    expect(migration).toContain("-0.5, 2.5, 'low_to_mid', '8630413'");
    expect(migration).toContain("SELECT id, 'open_meteo'");
    expect(migration).toContain("assignment.beach_id, 'wikimedia'");
    expect(migration).not.toContain("Fisherman Island");
  });

  it("stores a complete coordinate-derived terrain fingerprint for every spot", () => {
    const terrain = migration.slice(
      migration.indexOf("WITH terrain_factors"),
      migration.indexOf("UPDATE public.beaches AS b", migration.indexOf("WITH terrain_factors"))
    );
    const rows = [...terrain.matchAll(/'([0-9a-f-]{36})'::uuid, ARRAY\[([^\]]+)\]::real\[\], ARRAY\[([^\]]+)\]::real\[\]/g)];

    expect(rows).toHaveLength(10);
    for (const row of rows) {
      const swell = row[2].split(",").map(Number);
      const wind = row[3].split(",").map(Number);
      expect(swell).toHaveLength(72);
      expect(wind).toHaveLength(72);
      expect([...swell, ...wind].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    }
    expect(new Set(rows.map((row) => row[1])).size).toBe(10);
    expect(new Set(terrain.match(/[0-9a-f]{64}/g) ?? []).size).toBe(10);
    expect(migration).toContain("c8d4e197287448c53dd42b1024ee878722e6908f71c4930a560946f727706af5");
    expect(migration).toContain("terrain_status = 'ok'");
    expect(migration).toContain("terrain_enabled = true");
    expect(migration).not.toMatch(/(?:swell|wind)_window[^\n]*360/i);
    expect(migration).not.toMatch(/'very_high'|'high', \d/);
  });

  it("reapplies the catalog and attaches six spot-matched Surfline feeds", () => {
    const assignments = repairMigration.slice(
      repairMigration.indexOf("WITH camera_assignments"),
      repairMigration.indexOf("DO $$")
    );

    expect(repairMigration).toContain(
      "The original 20260830120000 version is tracked on production without its data effects."
    );
    expect(repairMigration).toContain("'1st Street Jetty (Virginia Beach)'");
    expect(assignments.match(/playlist\.m3u8/g)).toHaveLength(6);
    expect(assignments).toContain("ec-northendva/playlist.m3u8");
    expect(assignments).toContain("ec-15thstpiervb/playlist.m3u8");
    expect(assignments).toContain("ec-vbfirstfixed/playlist.m3u8");
    expect(assignments).toContain("ec-croatanjetties/playlist.m3u8");
    expect(assignments.match(/ec-croatanpendleton\/playlist\.m3u8/g)).toHaveLength(2);
    expect(assignments).not.toContain("ec-sandbridge/playlist.m3u8");
    expect(repairMigration).toContain("camera_count <> 6");
  });

  it.each([
    ["Assateague Beach (Virginia)", 37.8882, -75.3393, "8630413"],
    ["Virginia Beach Pier", 36.84422, -75.97128, "8639208"],
    ["1st Street Jetty", 36.83135, -75.9677, "8639208"],
    ["Sandbridge Beach", 36.74626, -75.94224, "8639428"],
    ["Little Island Fishing Pier", 36.6941363, -75.92274, "8639428"],
  ])("resolves %s to its ocean-side CO-OPS station", (name, lat, lon, station) => {
    expect(getStationForLocation(name as string, lat as number, lon as number)).toBe(station);
  });
});
