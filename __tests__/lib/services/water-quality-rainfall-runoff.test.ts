/** @jest-environment node */
import {
  RAIN_RUNOFF_THRESHOLD_IN,
  applyRainfallNotice,
  clusterRainfall,
  rainClusterFor,
  stationRainfall,
  type AwcMetar,
  type RainfallReading,
} from "@/lib/services/water-quality/rainfall-runoff";
import { runRainfallRunoffIngest } from "@/lib/services/water-quality/rainfall-runoff-ingest";
import { withRainfallNotice } from "@/lib/services/water-quality/rainfall-runoff-read";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const windowEnd = new Date("2026-10-12T18:00:00Z");
const now = new Date("2026-10-12T19:00:00Z");

function hourly(icaoId: string, precipByHour: Record<number, number | null> = {}, hours = 72): AwcMetar[] {
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(windowEnd.getTime() - i * 3600_000 - 9 * 60_000);
    return { icaoId, metarType: "METAR", reportTime: t.toISOString(), precip: precipByHour[i] ?? null, rawOb: `METAR ${icaoId} AO2` };
  });
}

const reading = (total: number, end = windowEnd): RainfallReading => ({
  cluster_id: "huntington_newport", window_end: end.toISOString(), total_in: total,
  station_totals: { KLGB: total, KSNA: 0.1 },
});

describe("rainClusterFor", () => {
  it.each([
    ["Santa Monica", 34.01, -118.496, "malibu_santa_monica"],
    ["Huntington", 33.655, -118.005, "huntington_newport"],
    ["Ventura", 34.275, -119.29, "ventura_oxnard"],
    ["San Clemente", 33.42, -117.62, "laguna_san_clemente"],
  ])("assigns %s to its cluster", (_name, lat, lon, cluster) => {
    expect(rainClusterFor(lat, lon)?.id).toBe(cluster);
  });

  it.each([
    ["Pacific Beach", 32.797, -117.257],
    ["Carlsbad", 33.16, -117.35],
    ["Santa Cruz", 36.96, -122.02],
  ])("gives %s no rain cluster (County feed or outside SoCal)", (_name, lat, lon) => {
    expect(rainClusterFor(lat, lon)).toBeNull();
  });

  it("returns null without coordinates", () => {
    expect(rainClusterFor(null, null)).toBeNull();
  });
});

describe("stationRainfall", () => {
  it("sums routine reports inside the 72 h window", () => {
    const result = stationRainfall(hourly("KLGB", { 0: 0.05, 10: 0.23, 71: 0.02 }), windowEnd);
    expect(result).toEqual({ total_in: 0.3, hours: 72 });
  });

  it("ignores SPECI reports, which repeat the running hourly total", () => {
    const metars = [...hourly("KLGB", { 5: 0.2 }), {
      icaoId: "KLGB", metarType: "SPECI", reportTime: "2026-10-12T13:30:00Z", precip: 0.15, rawOb: "SPECI KLGB AO2 P0015",
    }];
    expect(stationRainfall(metars, windowEnd).total_in).toBe(0.2);
  });

  it("counts a trace (AWC encodes it as 0.005 in) as zero", () => {
    const traces = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, 0.005]));
    expect(stationRainfall(hourly("KLGB", { ...traces, 30: 0.23 }), windowEnd).total_in).toBe(0.23);
  });

  it("drops reports outside the window", () => {
    const metars = [...hourly("KLGB"), { icaoId: "KLGB", metarType: "METAR", reportTime: "2026-10-09T10:00:00Z", precip: 1, rawOb: "" }];
    expect(stationRainfall(metars, windowEnd).total_in).toBe(0);
  });

  it("does not count hours whose rain gauge is out (PNO)", () => {
    const metars = hourly("KLGB").map((m, i) => (i < 10 ? { ...m, rawOb: `${m.rawOb} PNO` } : m));
    expect(stationRainfall(metars, windowEnd).hours).toBe(62);
  });

  it("counts a corrected report for the same hour once", () => {
    const metars = [...hourly("KLGB", { 3: 0.1 }), { ...hourly("KLGB", { 3: 0.1 })[3], rawOb: "METAR KLGB COR AO2" }];
    expect(stationRainfall(metars, windowEnd)).toEqual({ total_in: 0.1, hours: 72 });
  });
});

describe("clusterRainfall", () => {
  it("uses the wetter station", () => {
    expect(clusterRainfall({ KLGB: { total_in: 0.38, hours: 72 }, KSNA: { total_in: 0.17, hours: 72 } })).toBe(0.38);
  });

  it("drops a station missing more than 6 hours", () => {
    expect(clusterRainfall({ KLGB: { total_in: 0.38, hours: 60 }, KSNA: { total_in: 0.17, hours: 70 } })).toBe(0.17);
  });

  it("returns null when no station is usable", () => {
    expect(clusterRainfall({ KLGB: { total_in: 0.38, hours: 20 } })).toBeNull();
  });
});

describe("applyRainfallNotice", () => {
  const base = { beach_id: "b1", status: "good", status_reason: null as string | null };

  it("posts an advisory at the threshold with rain-specific wording", () => {
    const out = applyRainfallNotice(base, reading(RAIN_RUNOFF_THRESHOLD_IN), now);
    expect(out.status).toBe("advisory");
    expect(out.status_reason).toMatch(/storm drains/);
    expect(out.status_reason).toMatch(/river mouths/);
    expect(out.status_reason).toContain("Avoid those areas until 72 hours after the rain stops.");
    expect(out.rain_runoff).toEqual({ total_in: 0.2, window_end: windowEnd.toISOString(), stations: ["KLGB", "KSNA"] });
  });

  it("leaves the row alone below the threshold", () => {
    expect(applyRainfallNotice(base, reading(0.19), now)).toBe(base);
  });

  it("never overrides a sampled advisory or closure", () => {
    for (const status of ["advisory", "closure"]) {
      const row = { ...base, status, status_reason: "Enterococcus 220" };
      expect(applyRainfallNotice(row, reading(1.2), now)).toBe(row);
    }
  });

  it("never overrides any County status, including clear", () => {
    for (const county of ["clear", "advisory", "closure", "unavailable"] as const) {
      const row = { ...base, status: "unknown", county_advisory_status: county };
      expect(applyRainfallNotice(row, reading(1.2), now)).toBe(row);
    }
  });

  it("ignores a reading older than 7 hours", () => {
    const stale = new Date(now.getTime() - 8 * 3600_000);
    expect(applyRainfallNotice(base, reading(1.2, stale), now)).toBe(base);
  });

  it("never produces a good status", () => {
    for (const total of [0, 0.1, 0.2, 3]) {
      for (const status of ["good", "unknown", "advisory", "closure"]) {
        const out = applyRainfallNotice({ ...base, status: status === "good" ? "unknown" : status }, reading(total), now);
        expect(out.status).not.toBe("good");
      }
    }
  });
});

describe("runRainfallRunoffIngest", () => {
  it("records one 72 h total per cluster from the wetter station", async () => {
    const rows: unknown[] = [];
    const result = await runRainfallRunoffIngest({
      now: windowEnd,
      fetchMetars: async (icao) => hourly(icao, icao === "KLGB" ? { 4: 0.38 } : icao === "KSNA" ? { 4: 0.17 } : {}),
      writeReadings: async (readings) => { rows.push(...readings); },
    });
    expect(result.written).toBe(rows.length);
    expect(rows).toContainEqual(expect.objectContaining({
      cluster_id: "huntington_newport", total_in: 0.38, window_end: windowEnd.toISOString(),
    }));
  });

  it("writes San Diego rainfall from KSAN, KCRQ and KNZY for County advisory expiry", async () => {
    const fetched: string[] = [];
    const rows: RainfallReading[] = [];
    await runRainfallRunoffIngest({
      now: windowEnd,
      fetchMetars: async (icao) => {
        fetched.push(icao);
        return hourly(icao, icao === "KCRQ" ? { 4: 0.23 } : {});
      },
      writeReadings: async (readings) => { rows.push(...readings); },
    });
    expect(fetched.filter((icao) => ["KSAN", "KCRQ", "KNZY"].includes(icao))).toEqual(["KSAN", "KCRQ", "KNZY"]);
    expect(rows).toContainEqual({ cluster_id: "san_diego", window_end: windowEnd.toISOString(), total_in: 0.23,
      station_totals: { KSAN: 0, KCRQ: 0.23, KNZY: 0 } });
  });

  it("retries a station once after a failed request", async () => {
    const calls = new Map<string, number>();
    const rows: Array<{ cluster_id: string; total_in: number }> = [];
    await runRainfallRunoffIngest({
      now: windowEnd,
      fetchMetars: async (icao) => {
        calls.set(icao, (calls.get(icao) ?? 0) + 1);
        if (icao === "KSNA" && calls.get(icao) === 1) throw new Error("timeout");
        return hourly(icao, icao === "KSNA" ? { 2: 0.4 } : {});
      },
      writeReadings: async (readings) => { rows.push(...readings); },
    });
    expect(rows).toContainEqual(expect.objectContaining({ cluster_id: "laguna_san_clemente", total_in: 0.4 }));
  });

  it("skips a cluster whose stations all failed rather than writing zero", async () => {
    const rows: Array<{ cluster_id: string }> = [];
    const result = await runRainfallRunoffIngest({
      now: windowEnd,
      fetchMetars: async (icao) => { if (icao === "KSBA") throw new Error("timeout"); return hourly(icao); },
      writeReadings: async (readings) => { rows.push(...readings); },
    });
    expect(rows.map((r) => r.cluster_id)).not.toContain("santa_barbara");
    expect(result.skipped).toContain("santa_barbara");
    expectConsoleWarnings([/KSBA unavailable/]);
  });
});

describe("withRainfallNotice", () => {
  function client(readings: unknown[], error: unknown = null) {
    interface Query { select: jest.Mock; gte: jest.Mock; order: jest.Mock; then: (resolve: (v: unknown) => unknown) => Promise<unknown> }
    const query: Query = {
      select: jest.fn(() => query), gte: jest.fn(() => query), order: jest.fn(() => query),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: readings, error }).then(resolve),
    };
    return { from: jest.fn(() => query) };
  }
  const huntington = { id: "b1", lat: 33.655, lon: -118.005 };
  const pacific = { id: "b2", lat: 32.797, lon: -117.257 };

  it("applies the latest reading for each beach's cluster", async () => {
    const older = reading(0.05, new Date(windowEnd.getTime() - 3 * 3600_000));
    const rows = [{ beach_id: "b1", status: "good" }, { beach_id: "b2", status: "good" }];
    const out = await withRainfallNotice(rows, [huntington, pacific], client([reading(0.38), older]) as never, now);
    expect(out[0].status).toBe("advisory");
    expect(out[1]).toBe(rows[1]);
  });

  it("returns rows unchanged when the read fails", async () => {
    const rows = [{ beach_id: "b1", status: "good" }];
    const out = await withRainfallNotice(rows, [huntington], client([], { message: "down" }) as never, now);
    expect(out).toEqual(rows);
    expectConsoleWarnings([/readings unavailable/]);
  });

  it("skips the read when no beach is in a rain cluster", async () => {
    const c = client([{ ...reading(1), cluster_id: "san_diego" }]);
    await withRainfallNotice([{ beach_id: "b2", status: "good" }], [pacific], c as never, now);
    expect(c.from).not.toHaveBeenCalled();
  });
});
