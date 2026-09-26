/**
 * @jest-environment node
 */

import {
  runSwellEventSnapshotCron,
  type SnapshotBeach,
  type SwellEventSnapshotRunDependencies,
} from "@/lib/cron/swell-event-snapshot-runner";
import type {
  SwellEventForecastRow,
  SwellEventSnapshot,
  SwellEventSnapshotRow,
} from "@/lib/alerts/swell-events";
import {
  BEACH_ID,
  FLAT,
  NOW,
  dayRows,
  localDate,
  type PartitionSpec,
} from "@/__tests__/helpers/swell-events";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };

function beach(id: string, overrides: Partial<SnapshotBeach> = {}): SnapshotBeach {
  return {
    id,
    name: `Beach ${id.slice(-2)}`,
    slug: `beach-${id.slice(-2)}`,
    timezone: "America/Los_Angeles",
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 30,
    swell_access_factors: null,
    terrain_enabled: false,
    shoaling_factors: null,
    deepwater_decay_factor: null,
    ...overrides,
  };
}

function toSnapshot(row: SwellEventSnapshotRow): SwellEventSnapshot {
  return {
    beachId: row.beach_id,
    eventKey: row.event_key,
    detectorVersion: row.detector_version,
    runDate: row.run_date,
    detectedAt: row.detected_at,
    directionDeg: row.direction_deg,
    directionBand: row.direction_band,
    periodS: row.period_s,
    peakOffshoreHeightFt: row.peak_offshore_height_ft,
    peakFaceHeightFt: row.peak_face_height_ft,
    exposure: row.exposure,
    energyRatio: row.energy_ratio,
    arrivalAt: row.arrival_at,
    peakAt: row.peak_at,
    fadeAt: row.fade_at,
    crossingDirectionDeg: row.crossing_direction_deg,
    crossingPeriodS: row.crossing_period_s,
    crossingOffshoreHeightFt: row.crossing_offshore_height_ft,
  };
}

function harness(beaches: SnapshotBeach[], forecastsFor: (beachId: string) => SwellEventForecastRow[]) {
  const store: SwellEventSnapshotRow[] = [];
  const deps: SwellEventSnapshotRunDependencies = {
    loadBeaches: jest.fn(async () => beaches),
    loadLatestForecastUpdates: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [
      id, { updatedAt: "2026-09-25T12:00:00.000Z", dataSource: "NOAA_NWS" },
    ]))),
    loadForecasts: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, forecastsFor(id)]))),
    loadSnapshots: jest.fn(async (ids: string[], since: Date) => store
      .filter((row) => ids.includes(row.beach_id) && Date.parse(row.detected_at) >= since.getTime())
      .map(toSnapshot)),
    writeSnapshots: jest.fn(async (rows: SwellEventSnapshotRow[]) => {
      for (const row of rows) {
        const existing = store.findIndex((item) => (
          item.beach_id === row.beach_id && item.event_key === row.event_key && item.run_date === row.run_date
        ));
        if (existing >= 0) store.splice(existing, 1, row);
        else store.push(row);
      }
      return rows.length;
    }),
    isStale: () => false,
  };
  return { deps, store };
}

/** One swell whose peak is `peakDay` days after 2026-09-25, local noon. */
function swellWeek(peakDay: number): SwellEventForecastRow[] {
  return Array.from({ length: 8 }, (_, day) => dayRows(
    day,
    day === peakDay ? PEAK : FLAT,
    { noonBumpFt: day === peakDay ? 0.2 : 0 },
  )).flat();
}

describe("runSwellEventSnapshotCron", () => {
  it("writes today's snapshots and reuses the event key on the next run", async () => {
    let peakDay = 3;
    const { deps, store } = harness([beach(BEACH_ID)], () => swellWeek(peakDay));

    const first = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(first).toMatchObject({ runDate: "2026-09-25", beachesEvaluated: 1, eventsDetected: 1, snapshotsWritten: 1 });
    expect(store[0].event_key).toBe(`${BEACH_ID}:W:${localDate(3)}`);

    // Next day the model moves the peak ~24 h later: same swell, same key.
    peakDay = 4;
    const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const second = await runSwellEventSnapshotCron({ now: nextDay, dependencies: deps });

    expect(second.snapshotsWritten).toBe(1);
    expect(store.map((row) => [row.run_date, row.event_key, row.peak_at.slice(0, 10)])).toEqual([
      ["2026-09-25", `${BEACH_ID}:W:${localDate(3)}`, localDate(3)],
      ["2026-09-26", `${BEACH_ID}:W:${localDate(3)}`, localDate(4)],
    ]);
  });

  it("records a crossing swell on the snapshot", async () => {
    // Window 90°–210°: a S groundswell with an 8 s E wind swell 90° across it (E sits in the taper).
    const crossed = beach(BEACH_ID, { swell_window_center_deg: 150, swell_window_halfwidth_deg: 60 });
    const sse: PartitionSpec = { heightFt: 4, periodS: 16, direction: 170 };
    const east: PartitionSpec = { heightFt: 5, periodS: 8, direction: 80 };
    const background: PartitionSpec = { ...FLAT, direction: 170 };
    const { deps, store } = harness([crossed], () => Array.from({ length: 7 }, (_, day) => dayRows(
      day,
      day === 3 ? sse : background,
      { noonBumpFt: day === 3 ? 0.2 : 0, secondary: day === 3 ? east : null },
    )).flat());

    await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });

    expect(store).toHaveLength(1);
    expect(store[0]).toMatchObject({
      direction_band: "S",
      crossing_direction_deg: 80,
      crossing_period_s: 8,
      crossing_offshore_height_ft: 5,
    });
  });

  it("re-running on the same day updates the row instead of adding one", async () => {
    const { deps, store } = harness([beach(BEACH_ID)], () => swellWeek(3));
    await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    await runSwellEventSnapshotCron({ now: new Date(NOW.getTime() + 60 * 60 * 1000), dependencies: deps });
    expect(store).toHaveLength(1);
  });

  it("skips stale and forecast-less beaches", async () => {
    const stale = "00000000-0000-4000-8000-000000000002";
    const missing = "00000000-0000-4000-8000-000000000003";
    const { deps } = harness([beach(BEACH_ID), beach(stale), beach(missing)], () => swellWeek(3));
    deps.loadLatestForecastUpdates = jest.fn(async () => new Map([
      [BEACH_ID, { updatedAt: "2026-09-25T12:00:00.000Z", dataSource: "NOAA_NWS" }],
      [stale, { updatedAt: "2026-09-20T12:00:00.000Z", dataSource: "NOAA_NWS" }],
    ]));
    deps.isStale = (updatedAt) => updatedAt.startsWith("2026-09-20");

    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });

    expect(summary).toMatchObject({
      beachesWithWindow: 3, beachesSkippedStale: 1, beachesWithoutForecasts: 1, beachesEvaluated: 1, snapshotsWritten: 1,
    });
    expect(deps.loadForecasts).toHaveBeenCalledWith([BEACH_ID], expect.any(Date), expect.any(Date));
  });

  it("isolates a failing beach and a failing chunk", async () => {
    const ids = Array.from({ length: 11 }, (_, index) => `00000000-0000-4000-8000-0000000000${String(index + 10)}`);
    const beaches = ids.map((id) => beach(id));
    const broken = { ...beaches[1] };
    Object.defineProperty(broken, "swell_access_factors", { get() { throw new Error("corrupt beach"); } });
    beaches[1] = broken;
    const { deps } = harness(beaches, () => swellWeek(3));
    const loadForecasts = deps.loadForecasts;
    // The second chunk (the 11th beach) fails to load; the first chunk still lands.
    deps.loadForecasts = jest.fn(async (chunk: string[], from: Date, to: Date) => {
      if (chunk.includes(ids[10])) throw new Error("timeout");
      return loadForecasts(chunk, from, to);
    });

    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });

    expect(summary).toMatchObject({ chunksFailed: 1, beachesFailed: 1, beachesEvaluated: 9, snapshotsWritten: 9 });
    expectConsoleWarnings([/beach failed/, /chunk failed/]);
  });

  it("runs at most four beach batches at once", async () => {
    const ids = Array.from({ length: 95 }, (_, index) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`);
    const { deps } = harness(ids.map((id) => beach(id)), () => swellWeek(3));
    const loadForecasts = deps.loadForecasts;
    let inFlight = 0;
    let peak = 0;
    deps.loadForecasts = jest.fn(async (chunk: string[], from: Date, to: Date) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return loadForecasts(chunk, from, to);
    });

    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });

    expect(deps.loadForecasts).toHaveBeenCalledTimes(10);
    expect(peak).toBe(4);
    expect(summary).toMatchObject({ beachesEvaluated: 95, chunksFailed: 0 });
  });

  it("does not write fresh keys when earlier snapshots cannot be read", async () => {
    const { deps } = harness([beach(BEACH_ID)], () => swellWeek(3));
    deps.loadSnapshots = jest.fn(async () => { throw new Error("relation does not exist"); });

    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });

    expect(summary).toMatchObject({ chunksFailed: 1, snapshotsWritten: 0 });
    expect(deps.writeSnapshots).not.toHaveBeenCalled();
    expectConsoleWarnings([/chunk failed/]);
  });
});
