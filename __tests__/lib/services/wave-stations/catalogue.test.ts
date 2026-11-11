/**
 * @jest-environment node
 */

import {
  buildStationSlug,
  planRegistryUpsert,
  type ExistingStation,
} from "@/lib/services/wave-stations/catalogue";
import type { SourceStation } from "@/lib/services/wave-stations/types";

const NOW = Date.parse("2026-11-11T04:00:00Z");

function station(overrides: Partial<SourceStation> = {}): SourceStation {
  return {
    sourceStationId: "46225",
    name: "Torrey Pines Outer, CA",
    lat: 32.933,
    lon: -117.391,
    stationType: "buoy",
    owner: "SCRIPPS",
    program: "IOOS Partners",
    countryCode: "US",
    region: "CA",
    cdipStationId: "100",
    hasWave: true,
    hasSwellSplit: true,
    hasMet: true,
    license: "public-domain-us-gov",
    attribution: "NOAA National Data Buoy Center (NDBC); station operated by SCRIPPS",
    ...overrides,
  };
}

describe("buildStationSlug", () => {
  it("joins the readable name and the station id", () => {
    expect(buildStationSlug("Torrey Pines Outer, CA", "46225")).toBe("torrey-pines-outer-ca-46225");
    expect(buildStationSlug('West Sole "A" AWS', "62149")).toBe("west-sole-a-aws-62149");
    expect(buildStationSlug("Station 22101", "22101")).toBe("station-22101");
    expect(buildStationSlug("", "22101")).toBe("buoy-22101");
    expect(buildStationSlug("9414750 - Alameda, CA", "AAMC1")).toBe("9414750-alameda-ca-aamc1");
  });

  it("drops the distance and bearing clause from the slug but keeps the state", () => {
    expect(buildStationSlug("San Clemente Basin - 27NM SE of San Clemente Is, CA", "46086")).toBe("san-clemente-basin-ca-46086");
    expect(buildStationSlug("Northern Hawaii One - 245NM NE of Honolulu HI", "51000")).toBe("northern-hawaii-one-51000");
    expect(buildStationSlug("Nantucket 54 NM Southeast of Nantucket", "44008")).toBe("nantucket-44008");
    expect(buildStationSlug("East Superior -70 NM NE Marquette, MI", "45004")).toBe("east-superior-mi-45004");
    expect(buildStationSlug("Tillamook, OR - 85 NM WNW of Tillamook, OR", "46089")).toBe("tillamook-or-46089");
    expect(
      buildStationSlug("Neah Bay - 6 NM North of Cape Flattery, WA (Traffic Separation Lighted Buoy)", "46087"),
    ).toBe("neah-bay-wa-46087");
    expect(buildStationSlug("Mid Gulf - 180 nm South of Southwest Pass, LA", "42001")).toBe("mid-gulf-la-42001");
  });

  it("is deterministic and truncates long names on a word boundary", () => {
    const name = "NORTH MICHIGAN- Halfway between North Manitou and Washington Islands.";
    const slug = buildStationSlug(name, "45002");
    expect(slug).toBe(buildStationSlug(name, "45002"));
    expect(slug).toBe("north-michigan-halfway-between-north-manitou-and-washington-45002");
    expect(slug.length).toBeLessThanOrEqual(80);
  });
});

describe("planRegistryUpsert", () => {
  it("keeps a stored slug when the station is renamed", () => {
    const existing: ExistingStation[] = [
      { id: "ndbc:46225", slug: "torrey-pines-outer-ca-46225", active: true, last_wave_observed_at: null },
    ];
    const plan = planRegistryUpsert("ndbc", [station({ name: "Torrey Pines Outer Buoy, CA" })], existing, NOW);
    expect(plan.rows[0].slug).toBe("torrey-pines-outer-ca-46225");
    expect(plan.rows[0].name).toBe("Torrey Pines Outer Buoy, CA");
  });

  it("assigns new slugs and avoids a collision with another station", () => {
    const existing: ExistingStation[] = [
      { id: "other:1", slug: "torrey-pines-outer-ca-46225", active: true, last_wave_observed_at: null },
    ];
    const plan = planRegistryUpsert("ndbc", [station()], existing, NOW);
    expect(plan.rows[0]).toMatchObject({
      id: "ndbc:46225",
      slug: "torrey-pines-outer-ca-46225-ndbc",
      cdip_station_id: "100",
      active: true,
    });
    expect(plan.deactivateIds).toEqual([]);
  });

  it("keeps has_wave while a wave reading is under 30 days old", () => {
    const recent: ExistingStation[] = [
      { id: "ndbc:46225", slug: "s", active: true, last_wave_observed_at: "2026-11-01T00:00:00Z" },
    ];
    const old: ExistingStation[] = [
      { id: "ndbc:46225", slug: "s", active: true, last_wave_observed_at: "2026-09-01T00:00:00Z" },
    ];
    const hint = station({ hasWave: false, hasSwellSplit: false });
    expect(planRegistryUpsert("ndbc", [hint], recent, NOW).rows[0].has_wave).toBe(true);
    expect(planRegistryUpsert("ndbc", [hint], old, NOW).rows[0].has_wave).toBe(false);
  });

  it("deactivates stored stations of the same source that left the list", () => {
    const existing: ExistingStation[] = [
      { id: "ndbc:46225", slug: "a", active: true, last_wave_observed_at: null },
      { id: "ndbc:46999", slug: "b", active: true, last_wave_observed_at: null },
      { id: "ndbc:46998", slug: "c", active: false, last_wave_observed_at: null },
      { id: "other:46999", slug: "d", active: true, last_wave_observed_at: null },
    ];
    expect(planRegistryUpsert("ndbc", [station()], existing, NOW).deactivateIds).toEqual(["ndbc:46999"]);
  });

  it("drops duplicate station ids from the source list", () => {
    expect(planRegistryUpsert("ndbc", [station(), station()], [], NOW).rows).toHaveLength(1);
  });
});
