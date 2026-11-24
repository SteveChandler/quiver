/** @jest-environment node */
import { readFileSync } from "fs";
import path from "path";

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { buildStationTitle, stationCode } from "@/lib/seo/buoy-meta";
import { planRegistryUpsert } from "@/lib/services/wave-stations/catalogue";
import {
  DATASET_PREFIX,
  fetchCopernicusStationFiles,
  latestDays,
  listingUrl,
  scanRegistry,
} from "@/lib/services/wave-stations/copernicus/adapter";
import { readNetcdf, type NcFile, type NcVariable } from "@/lib/services/wave-stations/copernicus/netcdf";
import {
  CMEMS_VARIABLES,
  COPERNICUS_CREDIT,
  countryFor,
  newestFilePerPlatform,
  normalizeWmoId,
  parseCmemsObservations,
  parseCmemsStation,
  parseListingPage,
  parseMooringKey,
  repairMojibake,
  stationName,
} from "@/lib/services/wave-stations/copernicus/parsers";
import type { SourceStation } from "@/lib/services/wave-stations/types";

const FIXTURES = path.join(__dirname, "fixtures/copernicus");
const DAY = "20261111";

function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(FIXTURES, `${name}_${DAY}.nc`)));
}

async function fixture(name: string): Promise<NcFile> {
  return readNetcdf(fixtureBytes(name), CMEMS_VARIABLES);
}

const WESTHINDER = "NO_TS_MO_WesthinderBuoy"; // Flemish coast agency (BE): VHM0, VTZA, TEMP
const K4 = "NO_TS_MO_6200105"; // Met Office K4 (GB): every variable, wmo 6200105
const CHAPEL_POINT = "NO_TS_MO_6201050"; // NNRCMP (GB): VHM0, VTPK, VTM02, VPED; wmo 6201050
const ESTACA = "IR_TS_MO_6200082"; // Puertos del Estado (ES): DEPH -3/0/3 m, TEMP only at 3 m
const ICELAND = "AR_TS_MO_Landeyjahafnardufl"; // Iceland: VAVH only, ~15 h late (left out)
const HELSINKI = "BO_TS_MO_HelsinkiBuoy"; // FMI (direct source): 2-D DEPH
const EUROPLATFORM = "NO_TS_MO_Europlatform"; // Rijkswaterstaat: temperature only

describe("readNetcdf (h5wasm)", () => {
  it("reads global and variable attributes and [TIME, DEPTH] arrays from a real file", async () => {
    const file = await fixture(K4);
    expect(file.attrs.platform_code).toBe("6200105");
    expect(file.attrs.platform_name).toBe("K4");
    expect(file.attrs.institution).toBe("Met Office- Exeter");
    expect(file.attrs.institution_edmo_code).toBe("29");
    expect(file.variables.TIME.attrs.units).toBe("days since 1950-01-01T00:00:00Z");
    expect(file.variables.VHM0.attrs).toMatchObject({ units: "m", standard_name: "sea_surface_wave_significant_height" });
    expect(file.variables.VHM0.shape).toEqual([13, 2]);
    expect(file.variables.VHM0.attrs._FillValue).toBeCloseTo(9.96921e36, -32);
    expect(file.variables.VHM0_QC.values.length).toBe(26);
    expect(Object.keys(file.variables)).not.toContain("VCMX");
  });

  it("reads shuffle + deflate compressed variables (Helsinki) and a 2-D DEPH", async () => {
    const file = await fixture(HELSINKI);
    expect(file.variables.DEPH.shape).toEqual([23, 2]);
    expect(Array.from(file.variables.DEPH.values).slice(0, 2)).toEqual([0, 0.5]);
    expect(Array.from(file.variables.TEMP.values).filter((v) => v < 1e30).length).toBeGreaterThan(10);
  });

  it("throws on bytes that are not HDF5 without calling HDF5, and keeps working after", async () => {
    await expect(readNetcdf(new TextEncoder().encode("<Error>NoSuchKey</Error>"), ["TIME"])).rejects.toThrow(/not a NetCDF-4/);
    expect((await fixture(WESTHINDER)).attrs.platform_code).toBe("WesthinderBuoy");
  });

  it("throws on a truncated file", async () => {
    await expect(readNetcdf(fixtureBytes(K4).subarray(0, 20_000), ["TIME"])).rejects.toThrow();
    // HDF5 prints its error stack through the console it captured at load time.
    expectConsoleErrors([/HDF5-DIAG|#\d{3}:|major:|minor:/]);
  });
});

describe("parseCmemsObservations (real files)", () => {
  it("K4: Hm0 over H1/3, Tp, Tm02 over Tz, direction at the peak over mean direction, surface temp, met", async () => {
    const rows = parseCmemsObservations(await fixture(K4), "6200105");
    expect(rows).toHaveLength(13);
    expect(rows[rows.length - 1]).toEqual({
      sourceStationId: "6200105",
      observedAt: "2026-11-11T12:00:00.000Z",
      values: {
        wave_height_m: 2.4, // VHM0; VAVH was 2.2
        dominant_period_s: 11.6,
        average_period_s: 6.1, // VTM02; VTZA was 6.2
        mean_wave_direction_deg: 186, // VPED; VMDR was 84
        water_temp_c: 12.06, // TEMP at DEPH 1 m
        wind_speed_ms: 9.8,
        wind_gust_ms: 13.8,
        wind_direction_deg: 44,
        pressure_hpa: 1013.2,
        air_temp_c: 9.2,
      },
    });
  });

  it("Westhinder: no peak period or direction in the file; Tz is the average period", async () => {
    const rows = parseCmemsObservations(await fixture(WESTHINDER), "WesthinderBuoy");
    expect(rows).toHaveLength(27);
    expect(rows[rows.length - 1]).toEqual({
      sourceStationId: "WesthinderBuoy",
      observedAt: "2026-11-11T13:00:00.000Z",
      values: { wave_height_m: 0.77, average_period_s: 4.01, water_temp_c: 14 },
    });
  });

  it("Chapel Point: the reading sits in depth column 0 and TEMP in column 1 (0.45 m)", async () => {
    const rows = parseCmemsObservations(await fixture(CHAPEL_POINT), "6201050");
    expect(rows).toHaveLength(23);
    expect(rows[rows.length - 1].observedAt).toBe("2026-11-11T11:30:00.000Z");
    expect(rows[rows.length - 1].values).toEqual({
      wave_height_m: 0.82,
      dominant_period_s: 4.76,
      average_period_s: 3.88,
      mean_wave_direction_deg: 41,
      water_temp_c: 10.4,
    });
  });

  it("Estaca de Bares: TEMP measured at 3 m is not sea-surface temperature; wind sits at -3 m (above the sea)", async () => {
    const rows = parseCmemsObservations(await fixture(ESTACA), "6200082");
    expect(rows).toHaveLength(14);
    const last = rows[rows.length - 1];
    expect(last.observedAt).toBe("2026-11-11T13:00:00.000Z");
    expect(last.values).toMatchObject({
      wave_height_m: 2.7,
      dominant_period_s: 11.91,
      average_period_s: 8.91,
      mean_wave_direction_deg: 270,
      wind_speed_ms: 4.9,
      wind_direction_deg: 3,
      pressure_hpa: 997.9,
    });
    expect(last.values.water_temp_c).toBeUndefined();
  });

  it("uses VAVH when it is the file's significant height, and decodes seconds in TIME", async () => {
    expect(parseCmemsObservations(await fixture(ICELAND), "Landeyjahafnardufl")).toEqual([
      {
        sourceStationId: "Landeyjahafnardufl",
        observedAt: "2026-11-11T00:09:59.000Z",
        values: { wave_height_m: 1.87, average_period_s: 6.9 },
      },
    ]);
  });

  it("returns no rows for a file without wave readings", async () => {
    expect(parseCmemsObservations(await fixture(EUROPLATFORM), "Europlatform")).toEqual([]);
    // Helsinki's buoy sent temperature only today.
    expect(parseCmemsObservations(await fixture(HELSINKI), "HelsinkiBuoy")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Synthetic files for QC, fill and convention edge cases
// ---------------------------------------------------------------------------

const FILL = 9.96921e36;
const DAYS_2026_11_11 = 28073; // days since 1950-01-01 at 2026-11-11T00:00Z

function variable(values: number[], shape: number[], attrs: NcVariable["attrs"]): NcVariable {
  return { values, shape, attrs: { _FillValue: FILL, ...attrs } };
}

function syntheticFile(variables: Record<string, NcVariable>, times = [0, 1 / 24, 2 / 24, 3 / 24]): NcFile {
  return {
    attrs: {
      platform_code: "TEST",
      institution: "Rijkswaterstaat Water- Traffic and Environment",
      institution_edmo_code: "1526",
      source_platform_category_code: "41",
      geospatial_lat_min: "52",
      geospatial_lat_max: "52.002",
      geospatial_lon_min: "4",
      geospatial_lon_max: "4",
    },
    variables: {
      TIME: variable(times.map((t) => DAYS_2026_11_11 + t), [times.length], { units: "days since 1950-01-01T00:00:00Z" }),
      DEPH: variable([0, 0.5], [2], { units: "m" }),
      ...variables,
    },
  };
}

const HM0 = { units: "m", standard_name: "sea_surface_wave_significant_height" };

describe("parseCmemsObservations (QC, fills, conventions)", () => {
  it("keeps QC 1 and 2 only, skips fills, and finds the value in any depth column", () => {
    const file = syntheticFile({
      // [TIME, DEPTH]: value in column 1 at t0, column 0 at t1, QC 4 (bad) at t2, fill at t3.
      VHM0: variable([FILL, 1.1, 1.2, FILL, 1.3, FILL, FILL, FILL], [4, 2], HM0),
      VHM0_QC: variable([-127, 1, 2, -127, 4, -127, 9, 9], [4, 2], {}),
    });
    const rows = parseCmemsObservations(file, "TEST");
    expect(rows.map((row) => [row.observedAt, row.values.wave_height_m])).toEqual([
      ["2026-11-11T00:00:00.000Z", 1.1],
      ["2026-11-11T01:00:00.000Z", 1.2],
    ]);
  });

  it("drops a time whose TIME_QC is not good", () => {
    const file = syntheticFile({
      VHM0: variable([1, 1.1], [2, 1], HM0),
      TIME_QC: variable([1, 4], [2], {}),
    }, [0, 1 / 24]);
    expect(parseCmemsObservations(file, "TEST").map((row) => row.observedAt)).toEqual(["2026-11-11T00:00:00.000Z"]);
  });

  it("does not use a height without the significant-height standard_name, or with other units", () => {
    expect(parseCmemsObservations(syntheticFile({ VAVH: variable([1, 1, 1, 1], [4, 1], { units: "m", standard_name: "sea_surface_wave_mean_height" }) }), "TEST")).toEqual([]);
    expect(parseCmemsObservations(syntheticFile({ VHM0: variable([1, 1, 1, 1], [4, 1], { ...HM0, units: "cm" }) }), "TEST")).toEqual([]);
  });

  it("falls back to VAVH only when VHM0 has no good value in the file", () => {
    const file = syntheticFile({
      VHM0: variable([FILL, FILL, FILL, FILL], [4, 1], HM0),
      VAVH: variable([0.9, 1.0, 1.1, 1.2], [4, 1], HM0),
    });
    expect(parseCmemsObservations(file, "TEST").map((row) => row.values.wave_height_m)).toEqual([0.9, 1, 1.1, 1.2]);
  });

  it("drops fields with unexpected units or a TO direction, and out-of-range values", () => {
    const file = syntheticFile({
      VHM0: variable([1, 1, 1, 1], [4, 1], HM0),
      TEMP: variable([285, 285, 285, 285], [4, 1], { units: "K", standard_name: "sea_water_temperature" }),
      WDIR: variable([10, 10, 10, 10], [4, 1], { units: "degree", standard_name: "wind_to_direction" }),
      VTPK: variable([80, 9, 9, 9], [4, 1], { units: "s" }),
    });
    const rows = parseCmemsObservations(file, "TEST");
    expect(rows[0].values).toEqual({ wave_height_m: 1 });
    expect(rows[1].values).toEqual({ wave_height_m: 1, dominant_period_s: 9 });
  });

  it("takes surface temperature from the shallowest valid level at most 2 m deep", () => {
    const file = syntheticFile({
      VHM0: variable([1], [1, 3], HM0),
      DEPH: variable([2.5, 1.5, 0.4], [3], { units: "m" }),
      TEMP: variable([10, 11, 12], [1, 3], { units: "degrees_C" }),
      TEMP_QC: variable([1, 1, 3], [1, 3], {}),
    }, [0]);
    // 0.4 m is flagged bad (3), 2.5 m is too deep: the 1.5 m sensor is used.
    expect(parseCmemsObservations(file, "TEST")[0].values.water_temp_c).toBe(11);
  });

  it("refuses a file whose TIME is not days since 1950", () => {
    const file = syntheticFile({ VHM0: variable([1], [1, 1], HM0) }, [0]);
    file.variables.TIME.attrs.units = "seconds since 1970-01-01T00:00:00Z";
    expect(() => parseCmemsObservations(file, "TEST")).toThrow(/TIME units/);
  });
});

describe("parseCmemsStation", () => {
  it("maps a listed provider's buoy to a catalogue station with the Copernicus credit", async () => {
    const result = parseCmemsStation(await fixture(WESTHINDER), "WesthinderBuoy");
    expect(result).toEqual({
      ok: true,
      station: {
        sourceStationId: "WesthinderBuoy",
        name: "Westhinder Buoy",
        lat: 51.3811,
        lon: 2.4358,
        stationType: "buoy",
        owner: "Agency for Maritime Services and Coast- Department Coast",
        program: "Copernicus Marine In Situ",
        countryCode: "BE",
        region: null,
        cdipStationId: null,
        wmoId: null,
        slugId: "",
        hasWave: true,
        hasSwellSplit: false,
        hasMet: false,
        license: "copernicus-marine",
        attribution:
          "E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00036. Data from Agency for Maritime Services and Coast- Department Coast",
      },
    });
    expect(COPERNICUS_CREDIT).toBe("E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00036");
  });

  it("normalises the WMO number only for the AB00NNN form (K4 = 62105; Chapel Point keeps 6201050)", async () => {
    const k4 = parseCmemsStation(await fixture(K4), "6200105");
    const chapel = parseCmemsStation(await fixture(CHAPEL_POINT), "6201050");
    const estaca = parseCmemsStation(await fixture(ESTACA), "6200082");
    expect(k4.ok && k4.station).toMatchObject({ name: "K4", wmoId: "62105", countryCode: "GB", hasMet: true, owner: "Met Office- Exeter" });
    expect(chapel.ok && chapel.station).toMatchObject({
      name: "Chapel Point wave buoy",
      wmoId: "6201050",
      countryCode: "GB",
      owner: "Environment Agency Geomatics; National Network of Regional Coastal Monitoring Programmes (NNRCMP)",
    });
    // Position is the middle of the file's range (44.123-44.1333).
    expect(estaca.ok && estaca.station).toMatchObject({ wmoId: "62082", countryCode: "ES", lat: 44.12815 });
  });

  it("leaves out direct sources, unlisted providers and files without a wave variable", async () => {
    expect(parseCmemsStation(await fixture(HELSINKI), "HelsinkiBuoy")).toEqual({ ok: false, reason: "provider-not-listed", institution: "FMI" });
    expect(parseCmemsStation(await fixture(ICELAND), "Landeyjahafnardufl")).toEqual({
      ok: false,
      reason: "provider-not-listed",
      institution: "Icelandic Road and Coastal Administration",
    });
    expect(parseCmemsStation(await fixture(EUROPLATFORM), "Europlatform")).toMatchObject({ ok: false, reason: "no-wave-variable" });
  });

  it("leaves out the direct sources' own buoys by EDMO code (NDBC, Scripps, AODN, Marine Institute, SMHI)", () => {
    for (const [institution, edmo] of [
      ["National Oceanic and Atmospheric Administration- National Data Buoy Center", "1463"],
      ["Scripps Institution of Oceanography", "1390"],
      ["Australian Ocean Data Network", "4068"],
      ["Marine Institute;Met Eireann", "396 373"],
      ["SMHI", "545"],
    ]) {
      const file = syntheticFile({ VHM0: variable([1], [1, 1], HM0) }, [0]);
      file.attrs.institution = institution;
      file.attrs.institution_edmo_code = edmo;
      expect(parseCmemsStation(file, "X")).toMatchObject({ ok: false, reason: "provider-not-listed" });
    }
  });

  it("leaves out land stations", () => {
    const file = syntheticFile({ VHM0: variable([1], [1, 1], HM0) }, [0]);
    file.attrs.source_platform_category_code = "14";
    expect(parseCmemsStation(file, "X")).toMatchObject({ ok: false, reason: "not-fixed-platform" });
  });
});

describe("slugs and titles for platform codes", () => {
  const plan = (station: SourceStation) => planRegistryUpsert("copernicus", [station], [], Date.parse("2026-11-11T15:00:00Z")).rows[0];
  const base = (sourceStationId: string, name: string, slugId: string): SourceStation => ({
    sourceStationId, name, slugId, lat: 51, lon: 3, stationType: "buoy", owner: null, program: null, countryCode: "BE",
    region: null, cdipStationId: null, hasWave: true, hasSwellSplit: false, hasMet: false, license: "copernicus-marine", attribution: "x",
  });

  it("uses the name alone when the code is the name run together, and keeps short codes", async () => {
    const westhinder = parseCmemsStation(await fixture(WESTHINDER), "WesthinderBuoy");
    const k4 = parseCmemsStation(await fixture(K4), "6200105");
    if (!westhinder.ok || !k4.ok) throw new Error("fixture stations expected");
    expect(plan(westhinder.station).slug).toBe("westhinder-buoy");
    expect(plan(k4.station).slug).toBe("k4-6200105");
    expect(plan(base("A2Buoy", "A2 Buoy", "")).slug).toBe("a2-buoy");
    expect(plan(base("K13a", "K13a", "K13a")).slug).toBe("k13a");
    expect(plan(base("EXCE0008", "Mayotte", "")).slug).toBe("mayotte");
  });

  it("shows only real ids in titles", () => {
    const row = (sourceStationId: string, name: string) => ({ source: "copernicus" as const, source_station_id: sourceStationId, name });
    expect(stationCode(row("A2Buoy", "A2 Buoy"))).toBeNull();
    expect(stationCode(row("IL3-SouthHunter", "South Hunter"))).toBeNull();
    expect(stationCode(row("6200105", "K4"))).toBe("6200105");
    expect(stationCode(row("K13a", "K13a"))).toBe("K13A");
    expect(buildStationTitle(row("A2Buoy", "A2 Buoy"))).toBe("A2 Buoy: Live Swell & Waves");
    expect(buildStationTitle(row("6200105", "K4"))).toBe("K4 Buoy 6200105: Live Swell & Waves");
    expect(buildStationTitle(row("WesthinderBuoy", "Westhinder Buoy"))).toBe("Westhinder Buoy: Live Swell & Waves");
    // NDBC C-MAN codes with four letters are still ids.
    expect(stationCode({ source: "ndbc", source_station_id: "LJPC1" })).toBe("LJPC1");
  });
});

describe("text and place helpers", () => {
  it("normalizeWmoId", () => {
    expect(normalizeWmoId("6200095")).toBe("62095");
    expect(normalizeWmoId("6200105")).toBe("62105");
    expect(normalizeWmoId("6201050")).toBe("6201050");
    expect(normalizeWmoId("41008")).toBe("41008");
    expect(normalizeWmoId(" ")).toBeNull();
    expect(normalizeWmoId("")).toBeNull();
    expect(normalizeWmoId("EXCE0008")).toBeNull();
  });

  it("repairMojibake undoes one Latin-1 / Windows-1252 decode and leaves real text alone", () => {
    expect(repairMojibake("Bothnian Bay / PerÃ¤meri aaltopoiju")).toBe("Bothnian Bay / Perämeri aaltopoiju");
    expect(repairMojibake("AVRAMAR ESPAÃ‘A ACUICULTURA S.L.")).toBe("AVRAMAR ESPAÑA ACUICULTURA S.L.");
    expect(repairMojibake("São Jorge")).toBe("São Jorge");
    expect(repairMojibake("Ã la carte")).toBe("Ã la carte");
  });

  it("stationName", () => {
    expect(stationName("SouthHunter", "IL3-SouthHunter")).toBe("South Hunter");
    expect(stationName(" ", "HERAKLION")).toBe("Heraklion");
    expect(stationName(null, "AWG")).toBe("AWG");
    expect(stationName(null, "HoekVanHolland")).toBe("Hoek Van Holland");
    expect(stationName("Gullfaks-C", "Gullfaks-C")).toBe("Gullfaks-C");
    expect(stationName("Fanoebugt Datawell DWR-MkII/MkIII buoy", "Fanoebugt")).toBe("Fanoebugt Datawell DWR-MkII/MkIII buoy");
    expect(stationName("Westhinder - Buoy", "WesthinderBuoy")).toBe("Westhinder Buoy");
    expect(stationName("Buoy Porto Colom", "PORTO-COLOM")).toBe("Porto Colom Buoy");
  });

  it("countryFor places overseas and cross-border buoys in their territory", () => {
    expect(countryFor("FR", 43.71358, 7.42617)).toBe("MC"); // Monaco
    expect(countryFor("FR", 14.5481, -61.0969)).toBe("MQ"); // Fort de France
    expect(countryFor("FR", 16.51667, -61.41667)).toBe("GP"); // La grande vigie
    expect(countryFor("FR", 4.98333, -52.03333)).toBe("GF"); // Ile de Cayenne
    expect(countryFor("FR", 46.7, -56.18333)).toBe("PM");
    expect(countryFor("FR", -12.54955, 45.06677)).toBe("YT"); // Mayotte
    expect(countryFor("FR", 47.285, -3.285)).toBe("FR"); // Belle-Ile
    expect(countryFor("IE", 54.8787, -5.7554)).toBe("GB"); // IL3 South Hunter, off Co. Down
    expect(countryFor("IE", 52.2393, -6.2786)).toBe("IE"); // IL4 Splaugh
    expect(countryFor("GB", 54.8787, -5.7554)).toBe("GB");
  });
});

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

function listingXml(entries: Array<{ path: string; lastModified: string; size?: number }>, nextToken?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>mdl-native-01</Name>`
    + `<IsTruncated>${nextToken ? "true" : "false"}</IsTruncated>`
    + entries
      .map((e) => `<Contents><Key>${DATASET_PREFIX}${e.path}</Key><LastModified>${e.lastModified}</LastModified><ETag>&quot;x&quot;</ETag><Size>${e.size ?? 1000}</Size><StorageClass>STANDARD</StorageClass></Contents>`)
      .join("")
    + (nextToken ? `<NextContinuationToken>${nextToken}</NextContinuationToken>` : "")
    + `</ListBucketResult>`;
}

describe("listing", () => {
  it("keeps mooring time series only (no tide gauges, profiles or radar)", () => {
    const page = parseListingPage(listingXml([
      { path: `latest/${DAY}/NO_TS_MO_6201050_${DAY}.nc`, lastModified: "2026-11-11T13:57:14.000Z" },
      { path: `latest/${DAY}/NO_TS_TG_Bath_${DAY}.nc`, lastModified: "2026-11-11T13:57:14.000Z" },
      { path: `latest/${DAY}/AR_PR_CT_58JH_${DAY}.nc`, lastModified: "2026-11-11T12:53:23.000Z" },
      { path: `latest-radar-total/${DAY}/x.nc`, lastModified: "2026-11-11T12:53:23.000Z" },
      { path: `latest/${DAY}/IR_TS_MO_IL3-SouthHunter_${DAY}.nc`, lastModified: "2026-11-11T13:00:00.000Z", size: 5 },
    ], "token&amp;1"));
    expect(page.nextToken).toBe("token&1");
    const moorings = page.entries.map((entry) => parseMooringKey(entry, DATASET_PREFIX)).filter(Boolean);
    expect(moorings).toEqual([
      { path: `latest/${DAY}/NO_TS_MO_6201050_${DAY}.nc`, region: "NO", platformCode: "6201050", day: DAY, lastModified: "2026-11-11T13:57:14.000Z", size: 1000 },
      { path: `latest/${DAY}/IR_TS_MO_IL3-SouthHunter_${DAY}.nc`, region: "IR", platformCode: "IL3-SouthHunter", day: DAY, lastModified: "2026-11-11T13:00:00.000Z", size: 5 },
    ]);
  });

  it("rejects a non-listing body and a truncated page without a token", () => {
    expect(() => parseListingPage("<Error><Code>AccessDenied</Code></Error>")).toThrow(/not a ListBucketResult/);
    expect(() => parseListingPage(listingXml([]).replace("<IsTruncated>false", "<IsTruncated>true"))).toThrow(/continuation token/);
  });

  it("newestFilePerPlatform prefers the later day, then the later rewrite", () => {
    const file = (day: string, lastModified: string) => ({ path: day, region: "NO", platformCode: "A", day, lastModified, size: 1 });
    const newest = newestFilePerPlatform([
      file("20261110", "2026-11-11T00:30:00.000Z"),
      file("20261111", "2026-11-11T01:00:00.000Z"),
      file("20261109", "2026-11-10T00:30:00.000Z"),
    ]);
    expect(newest.get("A")?.day).toBe("20261111");
  });

  it("latestDays adds yesterday before 06:00 UTC (readings land up to ~6 h late)", () => {
    expect(latestDays(Date.parse("2026-11-11T05:59:00Z"))).toEqual(["20261111", "20261110"]);
    expect(latestDays(Date.parse("2026-11-11T06:00:00Z"))).toEqual(["20261111"]);
  });
});

// ---------------------------------------------------------------------------
// Adapter against a fake bucket
// ---------------------------------------------------------------------------

type FakeBucket = Map<string, { body: Uint8Array; lastModified: string }>;

function installFakeBucket(bucket: FakeBucket, failures: Set<string> = new Set()): { requests: string[] } {
  const requests: string[] = [];
  jest.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const parsed = new URL(url);
    if (parsed.searchParams.get("list-type") === "2") {
      const prefix = parsed.searchParams.get("prefix") ?? "";
      const entries = [...bucket.entries()]
        .filter(([key]) => `${DATASET_PREFIX}${key}`.startsWith(prefix))
        .map(([key, value]) => ({ path: key, lastModified: value.lastModified, size: value.body.length }));
      return new Response(listingXml(entries), { status: 200 });
    }
    const key = decodeURIComponent(parsed.pathname).replace(`/mdl-native-01/${DATASET_PREFIX}`, "");
    if (failures.has(key)) return new Response("busy", { status: 503 });
    const file = bucket.get(key);
    if (!file) return new Response("<Error>NoSuchKey</Error>", { status: 404 });
    return new Response(new Blob([new Uint8Array(file.body)]), { status: 200 });
  });
  return { requests };
}

describe("copernicus adapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("listing URLs page with a continuation token", () => {
    const url = new URL(listingUrl(DAY, "abc/def"));
    expect(url.origin).toBe("https://s3.waw3-1.cloudferro.com");
    expect(url.searchParams.get("prefix")).toBe(`${DATASET_PREFIX}latest/${DAY}/`);
    expect(url.searchParams.get("continuation-token")).toBe("abc/def");
  });

  it("registry: reads each platform's newest file, keeps listed providers, counts what it skipped", async () => {
    const bucket: FakeBucket = new Map();
    for (const name of [WESTHINDER, K4, CHAPEL_POINT, ICELAND, HELSINKI, EUROPLATFORM]) {
      bucket.set(`latest/${DAY}/${name}_${DAY}.nc`, { body: fixtureBytes(name), lastModified: "2026-11-11T14:00:00.000Z" });
    }
    // An older day's file of the same platform is not read.
    bucket.set(`latest/20261109/${WESTHINDER}_20261109.nc`, { body: new Uint8Array([1, 2, 3]), lastModified: "2026-11-09T23:00:00.000Z" });
    const { requests } = installFakeBucket(bucket);

    const scan = await scanRegistry(Date.parse("2026-11-11T15:00:00Z"));
    expect(scan.stations.map((station) => [station.sourceStationId, station.countryCode, station.hasWave])).toEqual([
      ["6200105", "GB", true],
      ["6201050", "GB", true],
      ["WesthinderBuoy", "BE", true],
    ]);
    expect(scan.platformsListed).toBe(6);
    expect(scan.skipped).toEqual({ "no-wave-variable": 1, "provider-not-listed": 2, "not-fixed-platform": 0, "bad-position": 0 });
    expect(scan.skippedProviders).toEqual({ FMI: 1, "Icelandic Road and Coastal Administration": 1 });
    // 7 day listings + 6 files.
    expect(requests.filter((url) => url.includes("list-type=2"))).toHaveLength(7);
    expect(requests.filter((url) => url.endsWith(".nc"))).toHaveLength(6);
  });

  it("registry: a file that keeps failing fails the source instead of returning a partial list", async () => {
    const bucket: FakeBucket = new Map();
    bucket.set(`latest/${DAY}/${WESTHINDER}_${DAY}.nc`, { body: fixtureBytes(WESTHINDER), lastModified: "2026-11-11T14:00:00.000Z" });
    bucket.set(`latest/${DAY}/${K4}_${DAY}.nc`, { body: fixtureBytes(K4), lastModified: "2026-11-11T14:00:00.000Z" });
    const { requests } = installFakeBucket(bucket, new Set([`latest/${DAY}/${K4}_${DAY}.nc`]));
    await expect(scanRegistry(Date.parse("2026-11-11T15:00:00Z"))).rejects.toThrow(/HTTP 503/);
    // Three tries (two retries) for the failing file.
    expect(requests.filter((url) => url.includes("6200105"))).toHaveLength(3);
  });

  it("registry: a file that downloads but cannot be read is skipped and counted", async () => {
    const bucket: FakeBucket = new Map();
    bucket.set(`latest/${DAY}/${WESTHINDER}_${DAY}.nc`, { body: fixtureBytes(WESTHINDER), lastModified: "2026-11-11T14:00:00.000Z" });
    bucket.set(`latest/${DAY}/NO_TS_MO_Broken_${DAY}.nc`, { body: new TextEncoder().encode("not hdf5"), lastModified: "2026-11-11T14:00:00.000Z" });
    installFakeBucket(bucket);
    const scan = await scanRegistry(Date.parse("2026-11-11T15:00:00Z"));
    expect(scan.stations.map((station) => station.sourceStationId)).toEqual(["WesthinderBuoy"]);
    expect(scan.unreadable).toEqual([`latest/${DAY}/NO_TS_MO_Broken_${DAY}.nc: not a NetCDF-4 / HDF5 file`]);
  });

  it("latest: downloads a station's file only when the listing shows it changed", async () => {
    const bucket: FakeBucket = new Map();
    bucket.set(`latest/${DAY}/${WESTHINDER}_${DAY}.nc`, { body: fixtureBytes(WESTHINDER), lastModified: "2026-11-11T13:20:00.000Z" });
    const { requests } = installFakeBucket(bucket);
    const nowMs = Date.parse("2026-11-11T14:04:00Z");

    const first = await fetchCopernicusStationFiles("WesthinderBuoy", { ifModifiedSince: null, nowMs });
    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    expect(first.lastModified).toBe("2026-11-11T13:20:00.000Z");
    expect(first.observations).toHaveLength(27);

    const unchanged = await fetchCopernicusStationFiles("WesthinderBuoy", { ifModifiedSince: first.lastModified, nowMs });
    expect(unchanged).toEqual({ status: "not_modified" });
    // An HTTP-date from an older state compares by time, not text.
    expect(await fetchCopernicusStationFiles("WesthinderBuoy", { ifModifiedSince: "Wed, 11 Nov 2026 13:20:00 GMT", nowMs })).toEqual({ status: "not_modified" });
    expect(await fetchCopernicusStationFiles("Nowhere", { ifModifiedSince: null, nowMs })).toEqual({ status: "not_found" });

    // One listing for the whole run (cached), one file download.
    expect(requests.filter((url) => url.includes("list-type=2"))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith(".nc"))).toHaveLength(1);
  });

  it("latest: before 06:00 UTC also reads yesterday's file when it changed", async () => {
    const bucket: FakeBucket = new Map();
    bucket.set(`latest/20261110/${WESTHINDER}_20261110.nc`, { body: fixtureBytes(WESTHINDER), lastModified: "2026-11-11T00:40:00.000Z" });
    const { requests } = installFakeBucket(bucket);
    const result = await fetchCopernicusStationFiles("WesthinderBuoy", {
      ifModifiedSince: "2026-11-10T23:40:00.000Z",
      nowMs: Date.parse("2026-11-11T01:04:00Z"),
    });
    expect(result.status).toBe("ok");
    expect(requests.filter((url) => url.includes("list-type=2")).map((url) => new URL(url).searchParams.get("prefix"))).toEqual([
      `${DATASET_PREFIX}latest/20261111/`,
      `${DATASET_PREFIX}latest/20261110/`,
    ]);
  });
});
