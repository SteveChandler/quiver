import { readFileSync } from "fs";
import { join } from "path";

import { getStationForLocation } from "@/lib/services/noaa-coops/station-resolver";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260902093602_add_humboldt_surf_beaches.sql",
  ),
  "utf8",
);

describe("Humboldt surf beach catalog", () => {
  it("imports six spots while withholding College Cove and Clam Beach from promotion", () => {
    const catalog = migration.slice(
      migration.indexOf("INSERT INTO _humboldt_beaches VALUES"),
      migration.indexOf("INSERT INTO public.beaches"),
    );
    const ids = catalog.match(/[0-9a-f]{8}-[0-9a-f-]{27}/g) ?? [];

    expect(new Set(ids).size).toBe(6);
    expect(migration).toContain("'America/Los_Angeles'");
    expect(migration).toContain("recommendation_ready_count <> 4");
    expect(migration).toContain("seo_count <> 4");
    expect(migration).toContain(
      "Promotion disabled because the official access trail is closed for erosion.",
    );
    expect(migration).toContain(
      "Promotion disabled pending local validation of skill suitability and tide behavior.",
    );
    expect(migration).toContain("Stay off the North Jetty");
    expect(migration).toContain("SELECT id, 'open_meteo'");
    expect(migration).toContain("best_months, 'EKA', 'CAZ103'");
    expect(migration).toContain("official_regional_beach_hazards");
    expect(migration).toContain(
      "recommendation_eligible boolean NOT NULL DEFAULT true",
    );
    expect(migration.match(/AND b\.recommendation_eligible/g)).toHaveLength(4);
  });

  it("stores complete coordinate-derived terrain fingerprints without bathymetric gain claims", () => {
    const terrain = migration.slice(
      migration.indexOf("WITH terrain_factors"),
      migration.indexOf(
        "UPDATE public.beaches AS b",
        migration.indexOf("WITH terrain_factors"),
      ),
    );
    const rows = [
      ...terrain.matchAll(
        /'([0-9a-f-]{36})'::uuid, ARRAY\[([^\]]+)\]::real\[\], ARRAY\[([^\]]+)\]::real\[\]/g,
      ),
    ];

    expect(rows).toHaveLength(6);
    for (const row of rows) {
      const swell = row[2].split(",").map(Number);
      const wind = row[3].split(",").map(Number);
      expect(swell).toHaveLength(72);
      expect(wind).toHaveLength(72);
      expect(
        [...swell, ...wind].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ),
      ).toBe(true);
    }
    expect(migration).toContain("'bathymetric_amplification_claim', false");
    expect(migration).toContain(
      "b00b79ecf6aaa5edce8ee435af2d4a5e1921a81997182f403fda9741963e7f6a",
    );
    expect(migration).not.toMatch(/(?:swell|wind)_window[^\n]*360/i);
  });

  it("attaches six approved heroes, using a labeled generated fallback only for Houda Point", () => {
    expect(migration).toContain("File:Moonstone Beach.png");
    expect(migration).toContain("File:Trinidad-ca-state-beach.jpg");
    expect(migration).toContain(
      "File:Samoa Dunes Recreation Area (40328814310).jpg",
    );
    expect(migration).toContain(
      "File:College Cove at Trinidad State Beach, California, US.jpg",
    );
    expect(migration).toContain("File:Clambeach.jpg");
    expect(migration).toContain("houda-point-camel-rock-v1.webp");
    expect(migration).toContain("'ai_generated', 'houda-point-camel-rock-v1'");
    expect(migration).toContain(
      "https://www.quiversurf.app/images/beaches/humboldt/houda-point-camel-rock-v1.webp",
    );
    expect(migration).toContain(
      "Illustrative only; not the exact break or current conditions.",
    );
    expect(migration).toContain("photo_count <> 6");
  });

  it.each([
    ["Moonstone Beach / Little River", 41.0259, -124.117, "9419059"],
    ["Houda Point / Camel Rock", 41.0483, -124.131, "9419059"],
    ["Trinidad State Beach", 41.05816, -124.15049, "9419059"],
    ["Samoa Dunes Surf Area", 40.7668424692, -124.23107, "9418767"],
    ["College Cove", 41.067, -124.1517, "9419059"],
    ["Clam Beach", 40.9985, -124.119, "9419059"],
  ])("resolves %s to its local CO-OPS station", (name, lat, lon, station) => {
    expect(
      getStationForLocation(name as string, lat as number, lon as number),
    ).toBe(station);
  });
});
