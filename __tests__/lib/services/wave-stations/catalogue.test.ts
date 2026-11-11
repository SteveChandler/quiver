/**
 * @jest-environment node
 */

import {
  buildStationSlug,
  planDuplicates,
  planRegistryUpsert,
  type DuplicateCandidate,
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

  it("stores the WMO number when the source gives one", () => {
    expect(planRegistryUpsert("ndbc", [station({ wmoId: "46225" })], [], NOW).rows[0].wmo_id).toBe("46225");
    expect(planRegistryUpsert("ndbc", [station()], [], NOW).rows[0].wmo_id).toBeNull();
  });
});

describe("planDuplicates", () => {
  const row = (overrides: Partial<DuplicateCandidate>): DuplicateCandidate => ({
    id: "ndbc:62095",
    source: "ndbc",
    name: "M6 - West Coast",
    lat: 53.04,
    lon: -15.53,
    wmo_id: "62095",
    active: true,
    duplicate_of: null,
    has_wave: true,
    ...overrides,
  });
  // Real positions: NDBC's 62095 is ~24 km from the Marine Institute's M6.
  const m6 = row({ id: "marine_ie:M6", source: "marine_ie", name: "M6 West Coast", lat: 53.07482, lon: -15.88135 });

  it("marks the NDBC relay of an Irish M-buoy as a duplicate by WMO number", () => {
    expect(planDuplicates([row({}), m6])).toEqual([{ id: "ndbc:62095", duplicate_of: "marine_ie:M6" }]);
  });

  it("matches on a distinctive shared name within 30 km when there is no WMO number", () => {
    const relay = row({ wmo_id: null });
    const primary = { ...m6, wmo_id: null };
    expect(planDuplicates([relay, primary])).toEqual([{ id: "ndbc:62095", duplicate_of: "marine_ie:M6" }]);
    // Generic words ("West Coast") alone are not enough.
    expect(planDuplicates([row({ wmo_id: null, name: "West Coast" }), { ...primary, name: "West Coast Buoy" }])).toEqual([]);
    // Too far apart for a name match.
    expect(planDuplicates([relay, { ...primary, lat: 54, lon: -15.88 }])).toEqual([]);
  });

  it("never marks the higher-priority source and clears a mark when the primary goes inactive", () => {
    const marked = row({ duplicate_of: "marine_ie:M6" });
    expect(planDuplicates([marked, m6])).toEqual([]);
    expect(planDuplicates([marked, { ...m6, active: false }])).toEqual([{ id: "ndbc:62095", duplicate_of: null }]);
  });

  it("keeps two stations of the same source apart even with the same WMO number", () => {
    expect(planDuplicates([row({}), row({ id: "ndbc:62095B" })])).toEqual([]);
  });

  describe("Copernicus (lowest priority), real ids and positions from 2026-11-11", () => {
    const sevenstonesNdbc = row({ id: "ndbc:62107", name: "Sevenstones Lightship", lat: 50.102, lon: -6.1, wmo_id: "62107", has_wave: true });
    const sevenstones = row({ id: "copernicus:6200107", source: "copernicus", name: "Sevenstones Lightship", lat: 50.102, lon: -6.1, wmo_id: "62107" });
    // NDBC relays K4 as a met-only row ~100 km from the Met Office position.
    const k4Ndbc = row({ id: "ndbc:62105", name: "K4 Buoy", lat: 55.41, lon: -11.81, wmo_id: "62105", has_wave: false });
    const k4 = row({ id: "copernicus:6200105", source: "copernicus", name: "K4", lat: 54.55, lon: -12.367, wmo_id: "62105" });

    it("hides a Copernicus station behind the NDBC row of the same buoy", () => {
      expect(planDuplicates([sevenstonesNdbc, sevenstones])).toEqual([{ id: "copernicus:6200107", duplicate_of: "ndbc:62107" }]);
    });

    it("keeps a Copernicus station with waves visible when the NDBC row has none", () => {
      expect(planDuplicates([k4Ndbc, k4])).toEqual([]);
      // Once NDBC reports waves for it, the NDBC row wins again.
      expect(planDuplicates([{ ...k4Ndbc, has_wave: true }, k4])).toEqual([{ id: "copernicus:6200105", duplicate_of: "ndbc:62105" }]);
      // A Copernicus row without waves is still hidden.
      expect(planDuplicates([k4Ndbc, { ...k4, has_wave: false }])).toEqual([{ id: "copernicus:6200105", duplicate_of: "ndbc:62105" }]);
    });

    it("loses to every direct source, never the other way round", () => {
      const m6Copernicus = row({ id: "copernicus:6200095", source: "copernicus", name: "M6", lat: 53.0748, lon: -15.8814, wmo_id: "62095" });
      expect(planDuplicates([row({}), m6, m6Copernicus])).toEqual([
        { id: "ndbc:62095", duplicate_of: "marine_ie:M6" },
        { id: "copernicus:6200095", duplicate_of: "marine_ie:M6" },
      ]);
      // FMI and SMHI ids by name within 30 km (Copernicus has no WMO number for them).
      const fmi = row({ id: "fmi:134220", source: "fmi", name: "Northern Baltic Proper", lat: 59.25, lon: 21.0, wmo_id: null });
      const fmiCopernicus = row({ id: "copernicus:NorthernBaltic", source: "copernicus", name: "Northern Baltic", lat: 59.248, lon: 21.0, wmo_id: null });
      expect(planDuplicates([fmi, fmiCopernicus])).toEqual([{ id: "copernicus:NorthernBaltic", duplicate_of: "fmi:134220" }]);
      const smhi = row({ id: "smhi:33008", source: "smhi", name: "Knolls grund", lat: 57.52, lon: 17.62, wmo_id: null });
      const smhiCopernicus = row({ id: "copernicus:Knollsgrund", source: "copernicus", name: "Knolls grund", lat: 57.51, lon: 17.61, wmo_id: null });
      expect(planDuplicates([smhi, smhiCopernicus])).toEqual([{ id: "copernicus:Knollsgrund", duplicate_of: "smhi:33008" }]);
    });

    it("does not match the 7-digit Chapel Point id with NDBC's E1 (62050)", () => {
      const e1 = row({ id: "ndbc:62050", name: "E1", lat: 50, lon: -4.4, wmo_id: "62050" });
      const chapel = row({ id: "copernicus:6201050", source: "copernicus", name: "Chapel Point wave buoy", lat: 53.2449, lon: 0.447, wmo_id: "6201050" });
      expect(planDuplicates([e1, chapel])).toEqual([]);
    });
  });
});
