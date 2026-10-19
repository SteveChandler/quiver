/**
 * @jest-environment node
 */
import {
  runSwellEventSnapshotCron,
  type SnapshotBeach,
  type SwellEventSnapshotRunDependencies,
} from "@/lib/cron/swell-event-snapshot-runner";
import {
  SWELL_EVENT_DETECTOR_VERSION,
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  type SwellEventForecastRow,
  type SwellEventSnapshot,
  type SwellEventSnapshotRow,
} from "@/lib/alerts/swell-events";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { FLAT, NOW, dayRows, type PartitionSpec } from "@/__tests__/helpers/swell-events";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { parseSwellEventKey } from "@/lib/share/swell-share";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));

const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };
const IDS = [1, 2, 3].map((n) => `bbbbbbbb-0000-4000-8000-00000000000${n}`);

function beach(id: string, index: number): SnapshotBeach {
  return {
    id, name: `Beach ${index}`, slug: `beach-${index}`, timezone: "America/Los_Angeles",
    swell_window_center_deg: 270, swell_window_halfwidth_deg: 30, swell_access_factors: null,
    terrain_enabled: false, shoaling_factors: null, deepwater_decay_factor: null,
    lat: 32.7 + index * 0.05, lon: -117.25,
  };
}

function toSnapshot(row: SwellEventSnapshotRow): SwellEventSnapshot {
  return {
    beachId: row.beach_id, eventKey: row.event_key, detectorVersion: row.detector_version, runDate: row.run_date,
    detectedAt: row.detected_at, directionDeg: row.direction_deg, directionBand: row.direction_band, periodS: row.period_s,
    peakOffshoreHeightFt: row.peak_offshore_height_ft, peakFaceHeightFt: row.peak_face_height_ft, exposure: row.exposure,
    energyRatio: row.energy_ratio, arrivalAt: row.arrival_at, peakAt: row.peak_at, fadeAt: row.fade_at,
    crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
  };
}

function swellWeek(): SwellEventForecastRow[] {
  return Array.from({ length: 8 }, (_, day) => dayRows(day, day === 3 ? PEAK : FLAT, { noonBumpFt: day === 3 ? 0.2 : 0 })).flat();
}

function harness(beaches: SnapshotBeach[]): { deps: SwellEventSnapshotRunDependencies; store: SwellEventSnapshotRow[] } {
  const store: SwellEventSnapshotRow[] = [];
  const deps: SwellEventSnapshotRunDependencies = {
    loadBeaches: async () => beaches,
    loadLatestForecastUpdates: async (ids) => new Map(ids.map((id) => [id, { updatedAt: "2026-09-25T12:00:00.000Z", dataSource: "NOAA_NWS" }])),
    loadForecasts: async (ids) => new Map(ids.map((id) => [id, swellWeek()])),
    loadSnapshots: async (ids, since) => store.filter((row) => ids.includes(row.beach_id)
      && Date.parse(row.detected_at) >= since.getTime()
      && row.detector_version === SWELL_EVENT_DETECTOR_VERSION).map(toSnapshot),
    loadPulseSnapshots: async (ids, since) => store.filter((row) => ids.includes(row.beach_id)
      && Date.parse(row.detected_at) >= since.getTime()
      && row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION).map(toSnapshot),
    writeSnapshots: async (rows) => {
      for (const row of rows) {
        const existing = store.findIndex((item) => item.beach_id === row.beach_id
          && item.event_key === row.event_key && item.run_date === row.run_date);
        if (existing >= 0) store.splice(existing, 1, row);
        else store.push(row);
      }
      return rows.length;
    },
    isStale: () => false,
  };
  return { deps, store };
}

describe("runSwellEventSnapshotCron pulse snapshots", () => {
  it("writes pulse rows under their own version and key marker when three beaches agree", async () => {
    const { deps, store } = harness(IDS.map(beach));
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    const pulseRows = store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
    expect(pulseRows).toHaveLength(3);
    expect(pulseRows.every((row) => row.event_key.endsWith(":p"))).toBe(true);
    expect(store.filter((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toHaveLength(3);
    expect(summary).toMatchObject({ pulsesDetected: 3, pulseSnapshotsWritten: 3 });
  });

  it("writes no pulse rows when only two beaches agree", async () => {
    const { deps, store } = harness(IDS.slice(0, 2).map(beach));
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)).toEqual([]);
    expect(summary).toMatchObject({ pulsesDetected: 2, pulseSnapshotsWritten: 0, snapshotsWritten: 2 });
  });

  it("writes nothing for pulses when the pulse snapshot loader is absent", async () => {
    const { deps, store } = harness(IDS.map(beach));
    delete deps.loadPulseSnapshots;
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(store).toHaveLength(3);
    expect(store.every((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toBe(true);
    expect(summary).toMatchObject({ pulsesDetected: 0, pulseSnapshotsWritten: 0, snapshotsWritten: 3 });
  });

  it("persists both colliding components and reuses their distinct keys on repeat runs", async () => {
    const { deps, store } = harness(IDS.map(beach));
    let peakDay = 3;
    deps.loadForecasts = async (ids) => new Map(ids.map((id) => [id,
      Array.from({ length: 8 }, (_, day) => dayRows(day,
        { heightFt: day === peakDay ? 4 : 1, periodS: 12, direction: 270 },
        { noonBumpFt: day === peakDay ? 0.2 : 0,
          secondary: { heightFt: day === peakDay ? 4 : 1, periodS: 17, direction: 270 } },
      )).flat(),
    ]));

    const first = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    const firstRows = store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
    expect(first).toMatchObject({ pulsesDetected: 6, pulseSnapshotsWritten: 6 });
    expect(firstRows).toHaveLength(6);
    for (const id of IDS) {
      const rows = firstRows.filter((row) => row.beach_id === id);
      expect(rows.map((row) => row.event_key).sort()).toEqual([
        `${id}:W:2026-09-28:p`, `${id}:W:2026-09-28:p:2`,
      ]);
      expect(rows.map((row) => row.period_s).sort((a, b) => a - b)).toEqual([12, 17]);
      for (const row of rows) {
        expect(parseSwellEventKey(row.event_key)).toEqual({ eventKey: row.event_key, beachId: id });
      }
    }

    await runSwellEventSnapshotCron({ now: new Date(NOW.getTime() + 3_600_000), dependencies: deps });
    expect(store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)).toHaveLength(6);
    peakDay = 4;
    await runSwellEventSnapshotCron({ now: new Date(NOW.getTime() + 86_400_000), dependencies: deps });
    const nextRows = store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION
      && row.run_date === "2026-09-26");
    expect(nextRows).toHaveLength(6);
    expect(nextRows.map((row) => [row.beach_id, row.period_s, row.event_key]).sort())
      .toEqual(firstRows.map((row) => [row.beach_id, row.period_s, row.event_key]).sort());
    expect(nextRows.every((row) => row.peak_at.startsWith("2026-09-29"))).toBe(true);
  });

  it("agrees across beach chunks after all forecast batches finish", async () => {
    const farIds = Array.from({ length: 8 }, (_, index) => `cccccccc-0000-4000-8000-${String(index).padStart(12, "0")}`);
    const beaches = [beach(IDS[0], 0), ...farIds.map((id) => ({ ...beach(id, 0), lat: null, lon: null })),
      beach(IDS[1], 1), beach(IDS[2], 2)];
    const { deps, store } = harness(beaches);
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    const rows = store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
    expect(rows.map((row) => row.beach_id).sort()).toEqual(IDS);
    expect(summary).toMatchObject({ pulsesDetected: 11, pulseSnapshotsWritten: 3, snapshotsWritten: 11 });
  });

  it("does not count stale, missing, or synthetic forecasts toward pulse agreement", async () => {
    for (const reason of ["stale", "missing", "synthetic"]) {
      const { deps, store } = harness(IDS.map(beach));
      if (reason === "stale") {
        deps.loadLatestForecastUpdates = async (ids) => new Map(ids.map((id) => [id, {
          updatedAt: id === IDS[2] ? "2026-09-20T12:00:00.000Z" : "2026-09-25T12:00:00.000Z", dataSource: "NOAA_NWS",
        }]));
        deps.isStale = (at) => at.startsWith("2026-09-20");
      } else {
        deps.loadForecasts = async (ids) => new Map(ids.map((id) => [id, id !== IDS[2] ? swellWeek()
          : reason === "missing" ? [] : swellWeek().map((row) => ({ ...row, data_source: "FALLBACK" })),
        ]));
      }
      const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
      expect(summary).toMatchObject({ pulsesDetected: 2, pulseSnapshotsWritten: 0, snapshotsWritten: 2 });
      expect(store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)).toEqual([]);
    }
  });

  it("preserves notable snapshots when pulse history cannot be loaded", async () => {
    const { deps, store } = harness(IDS.map(beach));
    deps.loadPulseSnapshots = async () => { throw new Error("pulse history unavailable"); };
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(summary).toMatchObject({ chunksFailed: 1, snapshotsWritten: 3, pulsesDetected: 0, pulseSnapshotsWritten: 0 });
    expect(store).toHaveLength(3);
    expect(store.every((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toBe(true);
    expectConsoleWarnings([/pulse history failed/]);
  });

  it("reports a pulse write failure and preserves completed notable writes", async () => {
    const { deps, store } = harness(IDS.map(beach));
    const write = deps.writeSnapshots;
    deps.writeSnapshots = async (rows) => {
      if (rows.some((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)) {
        throw new Error("pulse write unavailable");
      }
      return write(rows);
    };
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(summary).toMatchObject({ chunksFailed: 1, snapshotsWritten: 3, pulsesDetected: 3, pulseSnapshotsWritten: 0 });
    expect(store).toHaveLength(3);
    expect(store.every((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toBe(true);
    expectConsoleWarnings([/pulse write failed/]);
  });

  it("resolves outcomes after writing and reports the count", async () => {
    const { deps, store } = harness(IDS.map(beach));
    const resolveOutcomes = jest.fn(async (_now: Date): Promise<number> => {
      expect(store.filter((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toHaveLength(3);
      expect(store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)).toHaveLength(3);
      return 4;
    });
    deps.resolveOutcomes = resolveOutcomes;
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(resolveOutcomes).toHaveBeenCalledTimes(1);
    expect(resolveOutcomes).toHaveBeenCalledWith(NOW);
    expect(summary.outcomesResolved).toBe(4);
  });

  it("never fails the run when outcome resolution throws", async () => {
    const { deps } = harness(IDS.map(beach));
    deps.resolveOutcomes = async (): Promise<number> => { throw new Error("rpc down"); };
    await expect(runSwellEventSnapshotCron({ now: NOW, dependencies: deps }))
      .resolves.toMatchObject({ outcomesResolved: 0, snapshotsWritten: 3, pulseSnapshotsWritten: 3 });
    expectConsoleWarnings([/outcome resolution failed/]);
  });

  it("reports zero resolved outcomes when the optional resolver is absent", async () => {
    const { deps } = harness(IDS.map(beach));
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(summary.outcomesResolved).toBe(0);
  });
});

describe("runSwellEventSnapshotCron outcome RPC", () => {
  function clientWithRpc(result: { data: unknown; error: { message: string } | null }): jest.Mock {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "not", "order"]) builder[method] = () => builder;
    builder.range = async () => ({ data: [], error: null });
    const rpc = jest.fn(async () => result);
    jest.mocked(createSupabaseServiceRoleClient).mockReturnValueOnce({
      from: () => builder,
      rpc,
    } as unknown as SupabaseClient<Database>);
    return rpc;
  }

  it("passes the run instant to the default resolver and returns the row count", async () => {
    const rpc = clientWithRpc({ data: 4, error: null });
    const summary = await runSwellEventSnapshotCron({ now: NOW });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("resolve_swell_event_outcomes", { p_now: NOW.toISOString(), p_pulse_detector_version: SWELL_OUTLOOK_PULSE_DETECTOR_VERSION });
    expect(summary.outcomesResolved).toBe(4);
  });

  it("returns zero when the default resolver returns no numeric count", async () => {
    const rpc = clientWithRpc({ data: null, error: null });
    const summary = await runSwellEventSnapshotCron({ now: NOW });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(summary.outcomesResolved).toBe(0);
  });

  it("reports a default resolver error while completing the run", async () => {
    const warn = jest.spyOn(console, "warn");
    const rpc = clientWithRpc({ data: null, error: { message: "function unavailable" } });
    const summary = await runSwellEventSnapshotCron({ now: NOW });
    expect(rpc).toHaveBeenCalledWith("resolve_swell_event_outcomes", { p_now: NOW.toISOString(), p_pulse_detector_version: SWELL_OUTLOOK_PULSE_DETECTOR_VERSION });
    expect(summary.outcomesResolved).toBe(0);
    expectConsoleWarnings([/outcome resolution failed/]);
    expect(warn).toHaveBeenCalledWith("[swell-event-snapshots] outcome resolution failed", {
      error: "Failed to resolve swell event outcomes: function unavailable",
    });
    warn.mockRestore();
  });
});
