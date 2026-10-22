/** @jest-environment node */
import {
  RAIN_RUNOFF_THRESHOLD_IN,
  applyRainfallNotice,
  clusterRainfall,
  rainGaugeClusterFor,
  rainClusterFor,
  stationRainfall,
  type AwcMetar,
  type RainfallReading,
} from "@/lib/services/water-quality/rainfall-runoff";
import { runRainfallRunoffIngest } from "@/lib/services/water-quality/rainfall-runoff-ingest";
import { withRainfallNotice } from "@/lib/services/water-quality/rainfall-runoff-read";
import { rainAdvisoryEventSchema } from "@/lib/services/water-quality/rain-advisory-events";
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

describe("rainGaugeClusterFor", () => {
  it.each([
    ["Solana Beach", 32.991, -117.272, "san_diego"],
    ["Pacific Beach", 32.797, -117.257, "san_diego"],
    ["Huntington", 33.655, -118.005, "huntington_newport"],
  ])("assigns %s to the gauges that speak for it", (_name, lat, lon, cluster) => {
    expect(rainGaugeClusterFor(lat, lon)?.id).toBe(cluster);
  });

  it("gives beaches outside SoCal no cluster", () => {
    expect(rainGaugeClusterFor(36.96, -122.02)).toBeNull();
    expect(rainGaugeClusterFor(null, null)).toBeNull();
  });
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
    expect(result).toEqual({ total_in: 0.3, hours: 72, last_rain_at: hourly("KLGB")[0].reportTime });
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
    expect(stationRainfall(metars, windowEnd)).toEqual({ total_in: 0.1, hours: 72, last_rain_at: metars[3].reportTime });
  });

  it("takes last rain only from counted routine non-trace, non-PNO reports", () => {
    const metars = hourly("KLGB", { 0: 0.005, 1: 0.12, 2: 0.3 }).map((m, i) =>
      i === 2 ? { ...m, rawOb: `${m.rawOb} PNO` } : m);
    metars.push({ ...hourly("KLGB", { 0: 0.5 })[0], metarType: "SPECI" });
    expect(stationRainfall(metars, windowEnd)).toMatchObject({ total_in: 0.12,
      last_rain_at: metars[1].reportTime });
    expect(stationRainfall(hourly("KLGB", { 0: 0.005 }), windowEnd).last_rain_at).toBeNull();
  });
});

describe("clusterRainfall", () => {
  it("uses the wetter station", () => {
    expect(clusterRainfall({ KLGB: { total_in: 0.38, hours: 72, last_rain_at: null }, KSNA: { total_in: 0.17, hours: 72, last_rain_at: null } })).toBe(0.38);
  });

  it("drops a station missing more than 6 hours", () => {
    expect(clusterRainfall({ KLGB: { total_in: 0.38, hours: 60, last_rain_at: null }, KSNA: { total_in: 0.17, hours: 70, last_rain_at: null } })).toBe(0.17);
  });

  it("returns null when no station is usable", () => {
    expect(clusterRainfall({ KLGB: { total_in: 0.38, hours: 20, last_rain_at: null } })).toBeNull();
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

  it("never overrides a County advisory or closure", () => {
    for (const county of ["advisory", "closure"] as const) {
      const row = { ...base, status: county, county_advisory_status: county };
      expect(applyRainfallNotice(row, reading(1.2), now)).toBe(row);
    }
  });

  it("speaks where the County is clear or unavailable, since it posts hours after the rain", () => {
    for (const county of ["clear", "unavailable"] as const) {
      const row = { ...base, status: "unknown", county_advisory_status: county };
      expect(applyRainfallNotice(row, reading(1.2), now).status).toBe("advisory");
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

  it.each([30, 65, 66])("requires 66 reporting hours for County station totals (KCRQ: %s)", async (hours) => {
    const result = await runRainfallRunoffIngest({
      now: windowEnd,
      fetchMetars: async (icao) => hourly(icao, icao === "KLGB" ? { 4: 0.12 } : {},
        icao === "KCRQ" ? hours : icao === "KNZY" ? 66 : icao === "KLGB" ? 30 : 72),
      writeReadings: async () => undefined,
    });
    expect(result.readings.find((row) => row.cluster_id === "san_diego")).toEqual({
      cluster_id: "san_diego", window_end: windowEnd.toISOString(), total_in: 0,
      station_totals: hours >= 66 ? { KSAN: 0, KCRQ: 0, KNZY: 0 } : { KSAN: 0, KNZY: 0 },
    });
    expect(result.readings.find((row) => row.cluster_id === "huntington_newport")?.station_totals)
      .toEqual({ KLGB: 0.12, KSNA: 0 });
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

  it("does not confirm dry when a cluster station is missing or under the hours floor", async () => {
    const missing = await runRainfallRunoffIngest({ now: windowEnd,
      fetchMetars: async (icao) => { if (icao === "KCRQ") throw new Error("offline"); return hourly(icao); },
      writeReadings: async () => undefined });
    expect(missing.signals.find((signal) => signal.region === "san_diego")).toMatchObject({ dryConfirmed: false, totalIn: 0 });
    // The same San Diego reading also drives the gauge event.
    expect(missing.signals.find((signal) => signal.region === "san_diego_gauges"))
      .toEqual({ ...missing.signals.find((signal) => signal.region === "san_diego"), region: "san_diego_gauges" });
    expectConsoleWarnings([/KCRQ unavailable/]);
    const short = await runRainfallRunoffIngest({ now: windowEnd,
      fetchMetars: async (icao) => hourly(icao, {}, icao === "KCRQ" ? 30 : 72),
      writeReadings: async () => undefined });
    expect(short.signals.find((signal) => signal.region === "san_diego")).toMatchObject({ dryConfirmed: false, totalIn: 0 });
  });

  it("lets the usable stations confirm dry outside San Diego, but any fetched rain blocks it", async () => {
    const gappy = await runRainfallRunoffIngest({ now: windowEnd,
      fetchMetars: async (icao) => hourly(icao, {}, icao === "KNFG" ? 30 : 72),
      writeReadings: async () => undefined });
    expect(gappy.signals.find((signal) => signal.region === "laguna_san_clemente")).toMatchObject({ dryConfirmed: true });
    const wetGap = await runRainfallRunoffIngest({ now: windowEnd,
      fetchMetars: async (icao) => hourly(icao, icao === "KNFG" ? { 2: 0.05 } : {}, icao === "KNFG" ? 30 : 72),
      writeReadings: async () => undefined });
    expect(wetGap.signals.find((signal) => signal.region === "laguna_san_clemente")).toMatchObject({ dryConfirmed: false });
  });
});

describe("withRainfallNotice", () => {
  function client(readings: unknown[], error: unknown = null, events: unknown[] | null = null) {
    return { from: jest.fn((table: string) => {
      interface Query { select: jest.Mock; eq: jest.Mock; gte: jest.Mock; order: jest.Mock; then: (resolve: (v: unknown) => unknown) => Promise<unknown> }
      const query: Query = {
        select: jest.fn(() => query), eq: jest.fn(() => query), gte: jest.fn(() => query), order: jest.fn(() => query),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(table === "rain_advisory_events"
          ? { data: events, error: events === null ? { code: "42P01" } : null }
          : { data: readings, error }).then(resolve),
      };
      return query;
    }) };
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
    const rows = [{ beach_id: "b1", status: "good", status_reason: null as string | null }];
    const out = await withRainfallNotice(rows, [huntington], client([], { message: "down" }) as never, now);
    expect(out).toEqual(rows);
    expectConsoleWarnings([/readings unavailable/]);
  });

  it("uses active stored events, and suppresses wet readings when the event table has none", async () => {
    const stored = rainAdvisoryEventSchema.parse({ id: "99999999-9999-4999-8999-999999999999",
      region: "huntington_newport", source: "metar_runoff", status: "active",
      started_at: "2026-10-12T10:00:00Z", last_rain_at: "2026-10-12T12:00:00Z",
      expires_at: "2026-10-15T12:00:00Z", ended_at: null, end_reason: null,
      sources: { metar: { stations: ["KLGB", "KSNA"], total_in: 0.38, window_end: windowEnd.toISOString() } },
      created_at: "2026-10-12T10:00:00Z", updated_at: "2026-10-12T12:00:00Z" });
    const rows = [{ beach_id: "b1", status: "good", status_reason: null as string | null }];
    const active = await withRainfallNotice(rows, [huntington], client([reading(0.38)], null, [stored]) as never, now);
    expect(active[0]).toMatchObject({ status: "advisory", rain_runoff: {
      started_at: stored.started_at, last_rain_at: stored.last_rain_at, expires_at: stored.expires_at } });
    expect(active[0].status_reason).not.toMatch(/0\.38|last 72 hours/);
    expect(await withRainfallNotice(rows, [huntington], client([reading(0.38)], null, []) as never, now)).toEqual(rows);
    const pastExpiry = { ...stored, started_at: "2026-10-09T19:00:00Z",
      last_rain_at: "2026-10-09T18:00:00Z", expires_at: "2026-10-12T18:00:00Z" };
    expect((await withRainfallNotice(rows, [huntington], client([], null, [pastExpiry]) as never, now))[0].status)
      .toBe("advisory");
  });

  it("skips the read when no beach is in a rain cluster", async () => {
    const c = client([reading(1)]);
    await withRainfallNotice([{ beach_id: "b3", status: "good" }], [{ id: "b3", lat: 36.96, lon: -122.02 }], c as never, now);
    expect(c.from).not.toHaveBeenCalled();
  });

  it("gives a San Diego beach the notice from its own gauge event until the County speaks", async () => {
    const gauges = rainAdvisoryEventSchema.parse({ id: "88888888-8888-4888-8888-888888888888",
      region: "san_diego_gauges", source: "metar_runoff", status: "active",
      started_at: "2026-10-12T12:00:00Z", last_rain_at: "2026-10-12T11:00:00Z",
      expires_at: "2026-10-15T11:00:00Z", ended_at: null, end_reason: null,
      sources: { metar: { stations: ["KSAN"], total_in: 0.23, window_end: "2026-10-12T12:00:00Z" } },
      created_at: "2026-10-12T12:00:00Z", updated_at: "2026-10-12T12:00:00Z" });
    const rows = [{ beach_id: "b2", status: "good" }];
    expect((await withRainfallNotice(rows, [pacific], client([], null, [gauges]) as never, now))[0])
      .toMatchObject({ status: "advisory", rain_runoff: { expires_at: gauges.expires_at } });
    const county = [{ beach_id: "b2", status: "advisory", county_advisory_status: "advisory" }];
    expect(await withRainfallNotice(county, [pacific], client([], null, [gauges]) as never, now)).toEqual(county);
    // The County projection marks a covered beach with no notice "clear" (status unknown), and a stale feed "unavailable".
    for (const countyStatus of ["clear", "unavailable"]) {
      const silent = [{ beach_id: "b2", status: "unknown", county_advisory_status: countyStatus }];
      expect((await withRainfallNotice(silent, [pacific], client([], null, [gauges]) as never, now))[0])
        .toMatchObject({ status: "advisory", rain_runoff: { expires_at: gauges.expires_at } });
    }
  });
});

