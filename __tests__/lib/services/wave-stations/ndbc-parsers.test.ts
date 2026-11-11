/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cleanStationName,
  compassToDegrees,
  deriveNdbcLocation,
  parseActiveStationsXml,
  parseCdipStationId,
  parseLatestObs,
  parseRealtime2SpecListing,
  parseSpecFile,
  parseStandardFile,
} from "@/lib/services/wave-stations/ndbc/parsers";
import { CDIP_STATIONS } from "@/lib/constants/cdip-stations";

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, "../../../fixtures/ndbc-wave-stations", name), "utf8");

describe("parseActiveStationsXml", () => {
  const stations = parseActiveStationsXml(fixture("activestations.xml"));
  const byId = new Map(stations.map((station) => [station.id, station]));

  it("reads every station row and uppercases ids", () => {
    expect(stations).toHaveLength(14);
    expect(byId.get("AAMC1")?.program).toBe("NOS/CO-OPS");
  });

  it("decodes XML entities in names", () => {
    expect(byId.get("62149")?.rawName).toBe('West Sole "A" AWS');
  });

  it("treats a missing met attribute (TAO) as no met", () => {
    expect(byId.get("32303")?.hasMet).toBe(false);
    expect(byId.get("46225")?.hasMet).toBe(true);
  });

  it("keeps empty names as empty for the caller to replace", () => {
    expect(byId.get("22101")?.rawName).toBe("");
    expect(cleanStationName("", "22101")).toBe("Station 22101");
  });
});

describe("station names, CDIP ids and location", () => {
  it("strips the CDIP suffix and reads it as a 3-digit id", () => {
    expect(cleanStationName("Torrey Pines Outer, CA (100)", "46225")).toBe("Torrey Pines Outer, CA");
    expect(cleanStationName("Wilmington Harbor, NC - (200)", "41108")).toBe("Wilmington Harbor, NC");
    expect(parseCdipStationId("Torrey Pines Outer, CA (100)")).toBe("100");
    expect(parseCdipStationId("Oceanside Offshore, CA (045)")).toBe("045");
    expect(parseCdipStationId("Point Loma South, CA  (191)")).toBe("191");
    expect(parseCdipStationId("Capers Nearshore Waves (CAP2WAVE)")).toBeNull();
    expect(parseCdipStationId("Halibut Bank")).toBeNull();
  });

  // Names copied from the live activestations.xml (2026-11-11) for every twin in the constants file.
  const LIVE_TWIN_NAMES: Record<string, string> = {
    "46225": "Torrey Pines Outer, CA (100)",
    "46235": "Imperial Beach Nearshore, CA (155)",
    "46232": "Point Loma South, CA  (191)",
    "46254": "SCRIPPS Nearshore, CA (201)",
    "46266": "Del Mar Nearshore, CA (153)",
    "46258": "Mission Bay West, CA (220)",
    "46224": "Oceanside Offshore, CA (045)",
    "46251": "Santa Cruz Basin, CA (203)",
    "46268": "Topanga Nearshore, CA (103)",
    "46222": "San Pedro, CA (092)",
    "46219": "San Nicolas Island, CA (067)",
    "46218": "Harvest, CA (071)",
    "46237": "San Francisco Bar, CA  (142)",
    "46239": "Point Sur, CA (157)",
  };

  it("agrees with every NDBC twin in lib/constants/cdip-stations.ts", () => {
    const twins = Object.values(CDIP_STATIONS).filter((config) => config.ndbcTwinId);
    expect(twins.length).toBeGreaterThanOrEqual(14);
    for (const twin of twins) {
      const name = LIVE_TWIN_NAMES[twin.ndbcTwinId!];
      expect([twin.ndbcTwinId, parseCdipStationId(name)]).toEqual([
        twin.ndbcTwinId,
        twin.id.padStart(3, "0"),
      ]);
    }
  });

  it.each([
    ["Torrey Pines Outer, CA (100)", "SCRIPPS", "IOOS Partners", "US", "CA"],
    ["Neah Bay - 6 NM North of Cape Flattery, WA (Traffic Separation Lighted Buoy)", "NDBC", "NDBC Meteorological/Ocean", "US", "WA"],
    ["Rincon, Puerto Rico (181)", "CarICoos", "IOOS Partners", "US", "PR"],
    ["Kalo, Majuro, Marshall Islands (163)", "PacIOOS", "IOOS Partners", "MH", null],
    [" Yucatan Basin - 120 NM ESE of Cozumel, MX", "NDBC", "NDBC Meteorological/Ocean", "MX", null],
    ["Halibut Bank", "Environment and Climate Change Canada", "International Partners", "CA", null],
    ["", "Korean Meteorological Administration", "International Partners", "KR", null],
    ["West Sole \"A\" AWS", "Private Industry Oil Platform", "International Partners", null, null],
    // A partner station whose name ends in a state-like code stays with its owner's country.
    ["Pointe-au-Pere, QC, CA", "Environment and Climate Change Canada", "International Partners", "CA", null],
    ["Brest Approaches, FR, AL", "Meteo France", "International Partners", "FR", null],
    ["Unknown Partner Buoy, WA", "Some Other Agency", "International Partners", null, null],
    ["NORTHERN HAWAII ONE - 245NM NE of Honolulu HI", "NDBC", "NDBC Meteorological/Ocean", "US", null],
    ["5N 95W", "NDBC", "TAO", null, null],
  ])("derives location for %s", (name, owner, program, countryCode, region) => {
    expect(deriveNdbcLocation(name, owner, program)).toEqual({ countryCode, region });
  });
});

describe("compassToDegrees", () => {
  it("maps 16-point compass strings to 22.5 degree steps", () => {
    expect(compassToDegrees("N")).toBe(0);
    expect(compassToDegrees("NNE")).toBe(22.5);
    expect(compassToDegrees("WSW")).toBe(247.5);
    expect(compassToDegrees("NNW")).toBe(337.5);
    expect(compassToDegrees("w")).toBe(270);
  });

  it("passes numbers through and rejects junk", () => {
    expect(compassToDegrees("253")).toBe(253);
    expect(compassToDegrees("999")).toBeNull();
    expect(compassToDegrees("MM")).toBeNull();
    expect(compassToDegrees(undefined)).toBeNull();
  });
});

describe("parseLatestObs", () => {
  const observations = parseLatestObs(fixture("latest_obs.txt"));
  const byId = new Map(observations.map((obs) => [obs.sourceStationId, obs]));

  it("parses timestamps as UTC", () => {
    expect(byId.get("46225")?.observedAt).toBe("2026-11-11T02:56:00.000Z");
  });

  it("maps MM to null and keeps metric units as given", () => {
    expect(byId.get("46225")?.values).toEqual({
      wind_direction_deg: null,
      wind_speed_ms: null,
      wind_gust_ms: null,
      wave_height_m: 1.3,
      dominant_period_s: 14,
      average_period_s: 8.4,
      mean_wave_direction_deg: 253,
      pressure_hpa: null,
      air_temp_c: null,
      water_temp_c: 24.2,
    });
  });

  it("keeps met-only rows (46086 reports waves later in the hour)", () => {
    const met = byId.get("46086");
    expect(met?.values.wave_height_m).toBeNull();
    expect(met?.values.wind_speed_ms).toBe(5);
    expect(met?.values.pressure_hpa).toBe(1017.4);
  });

  it("keeps rows that have any value and drops none with data", () => {
    expect(byId.get("14049")?.values.water_temp_c).toBe(27.5);
    expect(observations).toHaveLength(7);
  });

  it("fails loudly when a unit changes instead of storing wrong values", () => {
    const text = fixture("latest_obs.txt").replace(" m/s   m/s", " kts   m/s");
    expect(() => parseLatestObs(text)).toThrow(/WSPD unit is "kts"/);
  });

  it("treats NDBC fill values as missing", () => {
    const text = fixture("latest_obs.txt").replace(
      "46225    32.933 -117.391 2026 11 11 02 56  MM    MM    MM  1.3  14  8.4 253",
      "46225    32.933 -117.391 2026 11 11 02 56 999  99.0    MM 99.0  99  8.4 999",
    );
    const values = parseLatestObs(text).find((obs) => obs.sourceStationId === "46225")?.values;
    expect(values?.wind_direction_deg).toBeNull();
    expect(values?.wind_speed_ms).toBeNull();
    expect(values?.wave_height_m).toBeNull();
    expect(values?.dominant_period_s).toBeNull();
    expect(values?.mean_wave_direction_deg).toBeNull();
    expect(values?.average_period_s).toBe(8.4);
  });
});

describe("parseSpecFile", () => {
  it("parses swell split with compass directions", () => {
    const [first] = parseSpecFile(fixture("46225.spec"), "46225");
    expect(first).toEqual({
      sourceStationId: "46225",
      observedAt: "2026-11-11T02:56:00.000Z",
      values: {
        wave_height_m: 1.3,
        swell_height_m: 1.0,
        swell_period_s: 14.3,
        wind_wave_height_m: 0.9,
        wind_wave_period_s: 9.1,
        swell_direction_deg: 247.5,
        wind_wave_direction_deg: 292.5,
        average_period_s: 8.4,
        mean_wave_direction_deg: 253,
        steepness: "swell",
      },
    });
  });

  it("maps MM directions and N/A steepness to null", () => {
    const rows = parseSpecFile(fixture("46086.spec"), "46086");
    expect(rows).toHaveLength(3);
    expect(rows[0].values.wind_wave_direction_deg).toBeNull();
    expect(rows[0].values.swell_direction_deg).toBe(292.5);
    expect(rows[2].values).toMatchObject({
      wave_height_m: 1.3,
      swell_height_m: null,
      swell_direction_deg: null,
      steepness: null,
      average_period_s: 9.2,
    });
  });
});

describe("parseStandardFile", () => {
  it("parses a wave station's .txt rows with met fields kept", () => {
    const rows = parseStandardFile(fixture("46146.txt"), "46146");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      sourceStationId: "46146",
      observedAt: "2026-11-11T03:00:00.000Z",
      values: {
        wind_direction_deg: 90,
        wind_speed_ms: 12,
        wind_gust_ms: 14,
        wave_height_m: 1.0,
        dominant_period_s: 4,
        average_period_s: null,
        mean_wave_direction_deg: null,
        pressure_hpa: 1012.1,
        air_temp_c: 12.5,
        water_temp_c: 10.3,
      },
    });
  });

  it("drops met-only rows (MM waves) and keeps the hourly wave rows", () => {
    const rows = parseStandardFile(fixture("46086.txt"), "46086");
    expect(rows.map((row) => row.observedAt)).toEqual([
      "2026-11-10T01:50:00.000Z",
      "2026-11-10T01:20:00.000Z",
    ]);
    expect(rows[0].values).toMatchObject({
      wave_height_m: 2.3,
      dominant_period_s: 15,
      average_period_s: 11.4,
      mean_wave_direction_deg: 282,
      water_temp_c: null,
    });
  });

  it("fails loudly when a unit changes", () => {
    const text = fixture("46146.txt").replace("degT m/s  m/s", "degT kts  m/s");
    expect(() => parseStandardFile(text, "46146")).toThrow(/WSPD unit is "kts"/);
  });
});

describe("parseRealtime2SpecListing", () => {
  it("returns only stations with a .spec file", () => {
    expect([...parseRealtime2SpecListing(fixture("realtime2-listing.html"))].sort()).toEqual([
      "46086",
      "46225",
      "LJPC1",
    ]);
  });
});
