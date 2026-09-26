/**
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  runSwellEventVerification,
  VERIFY_RULES,
} from "@/lib/alerts/swell-verification/verify";
import type { Database } from "@/types/database";

const NOW = new Date("2026-09-25T16:00:00.000Z");
const PEAK_AT = "2026-09-20T15:00:00.000Z";
const STATION = "edu_ucsd_cdip_100";
const HOUR_MS = 60 * 60 * 1000;

type Op = [string, unknown[]];

interface PendingRow {
  id: string;
  beach_id: string;
  forecast_arrival_at: string | null;
  forecast_peak_at: string;
  forecast_fade_at: string | null;
  forecast_peak_offshore_height_ft: number | string | null;
}

interface Observation {
  observed_at: string;
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
}

interface FakeOptions {
  pending: PendingRow[];
  stations?: Record<string, string | null | Error>;
  observations?: Record<string, Observation[]>;
  failUpdateIds?: string[];
}

function pending(overrides: Partial<PendingRow> = {}): PendingRow {
  return {
    id: "row-1",
    beach_id: "11111111-1111-4111-8111-111111111111",
    forecast_arrival_at: null,
    forecast_peak_at: PEAK_AT,
    forecast_fade_at: null,
    forecast_peak_offshore_height_ft: 4.5,
    ...overrides,
  };
}

function hoursFromPeak(hours: number): string {
  return new Date(Date.parse(PEAK_AT) + hours * HOUR_MS).toISOString();
}

/** Hourly buoy rows from peak-40h to peak+30h: flat baseline, then a swell peaking at `peakHour`. */
function swellSeries(args: { baselineM: number; peakM: number; peakHour: number }): Observation[] {
  const rows: Observation[] = [];
  for (let hour = -40; hour <= 30; hour += 1) {
    const heightM = hour === args.peakHour
      ? args.peakM
      : hour > -12
        ? (args.baselineM + args.peakM) / 2
        : args.baselineM;
    rows.push({
      observed_at: hoursFromPeak(hour),
      wave_height_m: heightM,
      wave_period_s: hour === args.peakHour ? 16 : 9,
      wave_direction_deg: hour === args.peakHour ? 270 : 250,
    });
  }
  return rows;
}

function arg(ops: Op[], name: string): unknown[] | undefined {
  return ops.find(([op]) => op === name)?.[1];
}

function fakeSupabase(options: FakeOptions) {
  const pendingQueries: Op[][] = [];
  const observationQueries: Op[][] = [];
  const updates: Array<{ payload: unknown; ops: Op[] }> = [];
  const failUpdateIds = new Set(options.failUpdateIds ?? []);

  function builder(resolve: (ops: Op[]) => unknown, sink: Op[][]) {
    const ops: Op[] = [];
    sink.push(ops);
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gt", "gte", "lt", "lte", "or", "order", "limit", "range", "update"]) {
      chain[method] = (...args: unknown[]) => {
        ops.push([method, args]);
        return chain;
      };
    }
    chain.then = (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
      Promise.resolve().then(() => resolve(ops)).then(onFulfilled, onRejected);
    return chain;
  }

  const verificationSink: Op[][] = [];
  const from = jest.fn((table: string) => {
    if (table === "swell_event_verifications") {
      return builder((ops) => {
        const update = arg(ops, "update");
        if (!update) {
          pendingQueries.push(ops);
          return { data: options.pending, error: null };
        }
        updates.push({ payload: update[0], ops });
        const id = ops.find(([op, args]) => op === "eq" && args[0] === "id")?.[1][1] as string;
        return failUpdateIds.has(id)
          ? { data: null, error: { message: "update failed" } }
          : { data: null, error: null };
      }, verificationSink);
    }
    if (table === "unified_wave_observations") {
      return builder((ops) => {
        const station = arg(ops, "eq")?.[1] as string;
        const start = Date.parse(arg(ops, "gte")?.[1] as string);
        const end = Date.parse(arg(ops, "lte")?.[1] as string);
        const [first, last] = arg(ops, "range") as [number, number];
        const rows = (options.observations?.[station] ?? [])
          .filter(({ observed_at }) => {
            const at = Date.parse(observed_at);
            return at >= start && at <= end;
          })
          .sort((left, right) => left.observed_at.localeCompare(right.observed_at))
          .slice(first, last + 1);
        return { data: rows, error: null };
      }, observationQueries);
    }
    throw new Error(`Unexpected table ${table}`);
  });
  const rpc = jest.fn(async (_name: string, params: { p_beach_id: string }) => {
    const stations = options.stations ?? {};
    const station = params.p_beach_id in stations ? stations[params.p_beach_id] : STATION;
    if (station instanceof Error) return { data: null, error: { message: station.message } };
    return { data: station, error: null };
  });

  return {
    supabase: { from, rpc } as unknown as SupabaseClient<Database>,
    from,
    rpc,
    pendingQueries,
    observationQueries,
    updates,
  };
}

async function verifyOne(row: PendingRow, observations: Observation[]) {
  const fake = fakeSupabase({ pending: [row], observations: { [STATION]: observations } });
  const summary = await runSwellEventVerification({ now: NOW, supabase: fake.supabase });
  return { fake, summary, update: fake.updates[0]?.payload as Record<string, unknown> | undefined };
}

describe("runSwellEventVerification", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("exports the initial classification thresholds", () => {
    expect(VERIFY_RULES).toEqual({
      minRiseRatio: 1.25,
      maxPeakErrorHours: 18,
      heightRatioMin: 0.6,
      heightRatioMax: 1.6,
    });
  });

  it("loads at most 200 pending rows whose event ended more than 12 hours ago, within 30 days", async () => {
    const fake = fakeSupabase({ pending: [] });

    const summary = await runSwellEventVerification({ now: NOW, supabase: fake.supabase });

    expect(summary.pending).toBe(0);
    expect(fake.from).toHaveBeenCalledWith("swell_event_verifications");
    expect(fake.pendingQueries[0]).toEqual([
      ["select", ["id, beach_id, forecast_arrival_at, forecast_peak_at, forecast_fade_at, forecast_peak_offshore_height_ft"]],
      ["eq", ["status", "pending"]],
      ["gt", ["forecast_peak_at", "2026-08-26T16:00:00.000Z"]],
      ["or", ["and(forecast_fade_at.is.null,forecast_peak_at.lt.2026-09-24T04:00:00.000Z),forecast_fade_at.lt.2026-09-25T04:00:00.000Z"]],
      ["order", ["forecast_peak_at", { ascending: true }]],
      ["limit", [200]],
    ]);
  });

  it("resolves the station with the exact RPC argument and writes a hit", async () => {
    const { fake, summary, update } = await verifyOne(
      pending(),
      swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 3 }),
    );

    expect(fake.rpc).toHaveBeenCalledWith("get_beach_observation_station", {
      p_beach_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(summary).toEqual(expect.objectContaining({
      pending: 1,
      verified: 1,
      errors: 0,
      statusCounts: { hit: 1, miss_no_show: 0, miss_timing: 0, miss_size: 0, no_observations: 0 },
    }));
    expect(update).toEqual({
      status: "hit",
      station_id: STATION,
      observed_baseline_height_ft: 1.97,
      observed_peak_height_ft: 4.92,
      observed_peak_at: hoursFromPeak(3),
      observed_peak_period_s: 16,
      observed_peak_direction_deg: 270,
      observation_count: 71,
      peak_error_hours: 3,
      height_ratio: 1.094,
      verified_at: NOW.toISOString(),
    });
    expect(fake.updates[0].ops.filter(([op]) => op === "eq")).toEqual([
      ["eq", ["id", "row-1"]],
      ["eq", ["status", "pending"]],
    ]);
  });

  it("queries observations from arrival - 24h to fade + 12h, defaulting to peak -/+ 24h", async () => {
    const withoutEdges = await verifyOne(pending(), swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 0 }));
    const withEdges = await verifyOne(
      pending({ forecast_arrival_at: hoursFromPeak(-12), forecast_fade_at: hoursFromPeak(20) }),
      swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 0 }),
    );

    expect(withoutEdges.fake.observationQueries[0]).toEqual([
      ["select", ["observed_at, wave_height_m, wave_period_s, wave_direction_deg"]],
      ["eq", ["station_id", STATION]],
      ["gte", ["observed_at", hoursFromPeak(-48)]],
      ["lte", ["observed_at", hoursFromPeak(36)]],
      ["order", ["observed_at", { ascending: true }]],
      ["range", [0, 999]],
    ]);
    expect(arg(withEdges.fake.observationQueries[0], "gte")).toEqual(["observed_at", hoursFromPeak(-36)]);
    expect(arg(withEdges.fake.observationQueries[0], "lte")).toEqual(["observed_at", hoursFromPeak(32)]);
  });

  it("classifies a peak that never rose above the baseline as miss_no_show", async () => {
    const { update } = await verifyOne(
      pending(),
      swellSeries({ baselineM: 0.6, peakM: 0.7, peakHour: 2 }),
    );

    expect(update?.status).toBe("miss_no_show");
  });

  it("classifies a peak more than 18 hours from the forecast as miss_timing", async () => {
    const { update } = await verifyOne(
      pending(),
      swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 24 }),
    );

    expect(update?.status).toBe("miss_timing");
    expect(update?.peak_error_hours).toBe(24);
  });

  it("classifies a peak far from the offshore forecast as miss_size, reading numeric strings", async () => {
    const { update } = await verifyOne(
      pending({ forecast_peak_offshore_height_ft: "2.0" }),
      swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 3 }),
    );

    expect(update?.status).toBe("miss_size");
    expect(update?.height_ratio).toBe(2.461);
  });

  it("skips the size check when the forecast offshore height is unknown", async () => {
    const { update } = await verifyOne(
      pending({ forecast_peak_offshore_height_ft: null }),
      swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 3 }),
    );

    expect(update?.status).toBe("hit");
    expect(update?.height_ratio).toBeNull();
  });

  it("writes no_observations when the beach has no station", async () => {
    const fake = fakeSupabase({
      pending: [pending()],
      stations: { "11111111-1111-4111-8111-111111111111": null },
    });

    const summary = await runSwellEventVerification({ now: NOW, supabase: fake.supabase });

    expect(summary.statusCounts.no_observations).toBe(1);
    expect(fake.observationQueries).toHaveLength(0);
    expect(fake.updates[0].payload).toEqual({
      status: "no_observations",
      station_id: null,
      observed_baseline_height_ft: null,
      observed_peak_height_ft: null,
      observed_peak_at: null,
      observed_peak_period_s: null,
      observed_peak_direction_deg: null,
      observation_count: null,
      peak_error_hours: null,
      height_ratio: null,
      verified_at: NOW.toISOString(),
    });
  });

  it("writes no_observations with the count when fewer than six usable rows exist", async () => {
    const rows = swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 0 })
      .filter(({ observed_at }) => observed_at >= hoursFromPeak(-2) && observed_at <= hoursFromPeak(2))
      .concat({ observed_at: hoursFromPeak(5), wave_height_m: null, wave_period_s: null, wave_direction_deg: null });

    const { update } = await verifyOne(pending(), rows);

    expect(update).toEqual(expect.objectContaining({
      status: "no_observations",
      station_id: STATION,
      observation_count: 5,
      observed_peak_height_ft: null,
    }));
  });

  it("falls back to the first quarter of rows for the baseline when none precede arrival", async () => {
    const rows = [0.5, 0.5, 0.9, 1.1, 1.4, 1.6, 1.2, 1.0].map((heightM, index) => ({
      observed_at: hoursFromPeak(index - 4),
      wave_height_m: heightM,
      wave_period_s: 15,
      wave_direction_deg: 265,
    }));

    const { update } = await verifyOne(pending({ forecast_arrival_at: hoursFromPeak(-6) }), rows);

    expect(update?.observed_baseline_height_ft).toBe(1.64);
    expect(update?.status).toBe("hit");
  });

  it("pages past 1000 observations", async () => {
    const rows: Observation[] = [];
    for (let minute = -46 * 60; minute <= 34 * 60; minute += 4) {
      rows.push({
        observed_at: new Date(Date.parse(PEAK_AT) + minute * 60_000).toISOString(),
        wave_height_m: minute === 60 ? 1.5 : minute < -30 * 60 ? 0.6 : 1.0,
        wave_period_s: 14,
        wave_direction_deg: 260,
      });
    }

    const { fake, update } = await verifyOne(pending(), rows);

    expect(fake.observationQueries.map((ops) => arg(ops, "range"))).toEqual([[0, 999], [1000, 1999]]);
    expect(update?.observation_count).toBe(rows.length);
    expect(update?.observed_peak_at).toBe(hoursFromPeak(1));
  });

  it("isolates per-row failures so one bad row never voids the batch", async () => {
    const fake = fakeSupabase({
      pending: [
        pending({ id: "station-error", beach_id: "22222222-2222-4222-8222-222222222222" }),
        pending({ id: "good" }),
        pending({ id: "write-error" }),
      ],
      stations: { "22222222-2222-4222-8222-222222222222": new Error("rpc timeout") },
      observations: { [STATION]: swellSeries({ baselineM: 0.6, peakM: 1.5, peakHour: 3 }) },
      failUpdateIds: ["write-error"],
    });

    const summary = await runSwellEventVerification({ now: NOW, supabase: fake.supabase });

    expect(summary).toEqual(expect.objectContaining({
      pending: 3,
      verified: 1,
      errors: 2,
      statusCounts: { hit: 1, miss_no_show: 0, miss_timing: 0, miss_size: 0, no_observations: 0 },
    }));
    expect(fake.rpc).toHaveBeenCalledTimes(3);
    expect(fake.updates.map(({ ops }) => arg(ops, "eq"))).toEqual([
      ["id", "good"],
      ["id", "write-error"],
    ]);
  });

  it("fails the run when pending rows cannot be loaded", async () => {
    const fake = fakeSupabase({ pending: [] });
    fake.from.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          gt: () => ({
            or: () => ({
              order: () => ({
                limit: async () => ({ data: null, error: { message: "relation does not exist" } }),
              }),
            }),
          }),
        }),
      }),
    }) as never);

    await expect(runSwellEventVerification({ now: NOW, supabase: fake.supabase })).rejects.toThrow(
      "Failed to load pending swell verifications: relation does not exist",
    );
  });
});
