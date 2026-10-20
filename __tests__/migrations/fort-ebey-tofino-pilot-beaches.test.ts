import { readFileSync } from "fs";
import { join } from "path";

import { COOPS_STATIONS } from "@/lib/services/noaa-coops/constants/station-mappings";
import { COOPS_STATION_COORDINATES } from "@/lib/services/noaa-coops/constants/station-coordinates";
import { getStationForLocation } from "@/lib/services/noaa-coops/station-resolver";
import { hasNoaaTideCoverage } from "@/lib/services/tides/tide-provider";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261020170000_add_fort_ebey_and_tofino_pilot_beaches.sql"),
  "utf8",
);

const catalog = migration.slice(
  migration.indexOf("INSERT INTO _pilot_beaches VALUES"),
  migration.indexOf("DO $$"),
);

const rows = [...catalog.matchAll(
  /\('([0-9a-f-]{36})', '([^']+)', '([^']+)', '([^']+)', '([A-Z]{2})', '(USA|Canada)', '([^']+)', '([^']+)', (-?\d+\.\d+), (-?\d+\.\d+), /g,
)].map((m) => ({
  id: m[1], name: m[2], slug: m[3], city: m[4], state: m[5], country: m[6],
  region: m[7], timezone: m[8], lat: Number(m[9]), lon: Number(m[10]),
}));

const FORT_EBEY = { lat: 48.2235, lon: -122.769 };
const PORT_TOWNSEND = "9444900";

describe("Fort Ebey and Tofino pilot beach catalog", () => {
  it("imports five catalog-only rows: one in Washington, four in British Columbia", () => {
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.id)).size).toBe(5);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(5);

    const canada = rows.filter((r) => r.country === "Canada");
    expect(canada).toHaveLength(4);
    for (const row of canada) {
      expect(row.state).toBe("BC");
      expect(row.timezone).toBe("America/Vancouver");
      expect(row.lat).toBeGreaterThan(49);
      expect(row.lon).toBeLessThan(-125.7);
    }

    const [ebey] = rows.filter((r) => r.country === "USA");
    expect(ebey).toMatchObject({ slug: "fort-ebey-coupeville-wa", state: "WA", timezone: "America/Los_Angeles" });
    expect(ebey.lat).toBeCloseTo(FORT_EBEY.lat, 3);
    expect(ebey.lon).toBeCloseTo(FORT_EBEY.lon, 3);

    // Same column shape as the 2026-09-03 catalog-gap import: not indexable,
    // not recommendation eligible, no terrain, open_meteo forecast source.
    expect(migration).toContain("editorial_sources,editorial_reviewed_at,\n  seo_indexable,recommendation_eligible,is_private,terrain_enabled");
    expect(migration).toContain("'2026-10-20T00:00:00Z',\n  false,false,false,false");
    expect(migration).toContain("SELECT id,'open_meteo' FROM _pilot_beaches");
    expect(migration).toContain("IF n <> 5 OR source_n <> 5 OR canada_n <> 4");
    expect(migration).not.toMatch(/swell_window|wind_offshore|preferred_tide|cdip_station|nws_forecast_zone/);
    expect(migration.trim().startsWith("--")).toBe(true);
    expect(migration).toMatch(/\nBEGIN;\n/);
    expect(migration.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("binds Fort Ebey to Port Townsend, not the open-coast Westport gauge", () => {
    expect(COOPS_STATIONS["fort-ebey"]).toBe(PORT_TOWNSEND);
    expect(COOPS_STATION_COORDINATES[PORT_TOWNSEND]).toEqual({ lat: 48.1112, lon: -122.7597 });
    expect(getStationForLocation("Fort Ebey", FORT_EBEY.lat, FORT_EBEY.lon)).toBe(PORT_TOWNSEND);
    expect(getStationForLocation("fort-ebey-coupeville-wa", FORT_EBEY.lat, FORT_EBEY.lon)).toBe(PORT_TOWNSEND);
  });

  it("never names a Canadian beach in the NOAA station map and keeps them off NOAA tides", () => {
    const keys = Object.keys(COOPS_STATIONS);
    expect(keys.some((key) => key.includes("chesterman") || key.includes("cox-bay") || key.includes("tofino"))).toBe(false);
    for (const row of rows.filter((r) => r.country === "Canada")) {
      expect(hasNoaaTideCoverage(row)).toBe(false);
    }

    // Long Beach (Pacific Rim) still name-matches the Washington "long-beach"
    // key inside the resolver; the 200 km guard rejects Toke Point, but the
    // region fallback then hands back Westport. Callers gate on country first.
    const longBeach = rows.find((r) => r.slug === "long-beach-pacific-rim-tofino-bc");
    expect(longBeach?.name).toBe("Long Beach (Pacific Rim)");
    expect(getStationForLocation(longBeach!.name, longBeach!.lat, longBeach!.lon)).not.toBe("9440910");
    expect(hasNoaaTideCoverage(longBeach!)).toBe(false);
  });
});
