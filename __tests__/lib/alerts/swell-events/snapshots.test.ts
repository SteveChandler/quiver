import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import {
  SWELL_EVENT_DETECTOR_VERSION,
  loadRecentSwellSnapshots,
  loadSwellCrossingHistory,
  resolveEventKeys,
  toSwellEventSnapshotRow,
  upsertSwellEventSnapshots,
  type BeachSwellEvent,
  type SwellEventSnapshot,
} from "@/lib/alerts/swell-events";

const BEACH = "11111111-1111-4111-8111-111111111111";
const OTHER_BEACH = "22222222-2222-4222-8222-222222222222";

function event(overrides: Partial<BeachSwellEvent> = {}): BeachSwellEvent {
  return {
    beachId: BEACH,
    eventKey: `${BEACH}:W:2026-09-28`,
    directionDeg: 270,
    directionBand: "W",
    directionLabel: "W",
    periodS: 16,
    peakOffshoreHeightFt: 4.2,
    peakFaceHeightFt: 5.6,
    baselineFaceHeightFt: 1,
    peakEnergy: 282.24,
    baselineEnergy: 10,
    energyRatio: 28.2,
    exposure: 1,
    arrivalAt: "2026-09-28T07:00:00.000Z",
    peakAt: "2026-09-28T19:00:00.000Z",
    fadeAt: "2026-09-29T07:00:00.000Z",
    peakLocalDate: "2026-09-28",
    ...overrides,
  };
}

function snapshot(overrides: Partial<SwellEventSnapshot> = {}): SwellEventSnapshot {
  return {
    beachId: BEACH,
    eventKey: `${BEACH}:W:2026-09-27`,
    detectorVersion: SWELL_EVENT_DETECTOR_VERSION,
    runDate: "2026-09-24",
    detectedAt: "2026-09-24T14:30:00.000Z",
    directionDeg: 268,
    directionBand: "W",
    periodS: 15,
    peakOffshoreHeightFt: 3.8,
    peakFaceHeightFt: 5,
    exposure: 1,
    energyRatio: 20,
    arrivalAt: "2026-09-27T07:00:00.000Z",
    peakAt: "2026-09-27T23:00:00.000Z",
    fadeAt: null,
    crossingDirectionDeg: null,
    crossingPeriodS: null,
    crossingOffshoreHeightFt: null,
    ...overrides,
  };
}

describe("resolveEventKeys", () => {
  it("reuses an earlier run's key for the same swell after its peak drifts across midnight", () => {
    const [resolved] = resolveEventKeys([event()], [snapshot()]);
    expect(resolved.eventKey).toBe(`${BEACH}:W:2026-09-27`);
    expect(resolved.peakAt).toBe("2026-09-28T19:00:00.000Z");
  });

  it("keeps the natural key when direction, timing, period or beach differ", () => {
    const natural = event().eventKey;
    expect(resolveEventKeys([event()], [snapshot({ directionDeg: 200, directionBand: "S" })])[0].eventKey).toBe(natural);
    expect(resolveEventKeys([event()], [snapshot({ peakAt: "2026-09-27T06:00:00.000Z" })])[0].eventKey).toBe(natural);
    expect(resolveEventKeys([event()], [snapshot({ periodS: 12 })])[0].eventKey).toBe(natural);
    expect(resolveEventKeys([event()], [snapshot({ beachId: OTHER_BEACH })])[0].eventKey).toBe(natural);
  });

  it("reuses the key when the 16-point label flips across a band edge (S↔SW)", () => {
    // 200° labels SSW in band S; 205° labels SSW in band SW. Same swell, same key.
    const previous = snapshot({ eventKey: `${BEACH}:S:2026-09-28`, directionDeg: 200, directionBand: "S", periodS: 16 });
    const flipped = event({ eventKey: `${BEACH}:SW:2026-09-28`, directionDeg: 205, directionBand: "SW", directionLabel: "SSW" });
    expect(resolveEventKeys([flipped], [previous])[0].eventKey).toBe(`${BEACH}:S:2026-09-28`);
  });

  it("gives one snapshot key to the closest detection only, and never duplicates a key", () => {
    const early = event({
      eventKey: `${BEACH}:W:2026-09-27`,
      peakAt: "2026-09-27T16:00:00.000Z",
      peakLocalDate: "2026-09-27",
    });
    const late = event({
      eventKey: `${BEACH}:W:2026-09-28`,
      peakAt: "2026-09-28T19:00:00.000Z",
    });
    const reused = snapshot({ eventKey: `${BEACH}:W:2026-09-28`, peakAt: "2026-09-28T02:00:00.000Z" });

    const resolved = resolveEventKeys([early, late], [reused]);

    // early is 10 h from the snapshot, late 17 h: early takes the key,
    // late's natural key now collides and is suffixed.
    expect(resolved.map((item) => item.eventKey)).toEqual([
      `${BEACH}:W:2026-09-28`,
      `${BEACH}:W:2026-09-28:2`,
    ]);
  });

  it("matches against each key's newest snapshot", () => {
    const older = snapshot({ detectedAt: "2026-09-22T14:30:00.000Z", peakAt: "2026-09-28T19:00:00.000Z", periodS: 16 });
    const newer = snapshot({ detectedAt: "2026-09-24T14:30:00.000Z", peakAt: "2026-09-30T19:00:00.000Z" });
    expect(resolveEventKeys([event()], [older, newer])[0].eventKey).toBe(event().eventKey);
  });
});

describe("snapshot store", () => {
  function queryClient(result: { data: unknown[] | null; error: { message: string } | null }) {
    const calls: Array<[string, ...unknown[]]> = [];
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "in", "eq", "gte", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      };
    }
    builder.range = async (...args: unknown[]) => {
      calls.push(["range", ...args]);
      // One page of data, then the empty page that ends the read.
      return args[0] === 0 ? result : { data: [], error: null };
    };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return builder;
      },
    } as unknown as SupabaseClient<Database>;
    return { client, calls };
  }

  it("loads recent snapshots for the current detector and drops malformed rows", async () => {
    const { client, calls } = queryClient({
      data: [
        {
          beach_id: BEACH, event_key: `${BEACH}:W:2026-09-27`, detector_version: SWELL_EVENT_DETECTOR_VERSION,
          run_date: "2026-09-24", detected_at: "2026-09-24T14:30:00+00:00", direction_deg: 268,
          direction_band: "W", period_s: "15", peak_offshore_height_ft: 3.8, peak_face_height_ft: 5,
          exposure: 1, energy_ratio: 20, arrival_at: "2026-09-27T07:00:00+00:00",
          peak_at: "2026-09-27T23:00:00+00:00", fade_at: null,
        },
        { beach_id: BEACH, event_key: null },
      ],
      error: null,
    });

    const since = new Date("2026-09-21T15:00:00.000Z");
    const snapshots = await loadRecentSwellSnapshots(client, [BEACH, BEACH], since);

    expect(snapshots).toEqual([snapshot()]);
    expect(calls).toEqual(expect.arrayContaining([
      ["from", "swell_event_forecast_snapshots"],
      ["in", "beach_id", [BEACH]],
      ["eq", "detector_version", SWELL_EVENT_DETECTOR_VERSION],
      ["gte", "detected_at", since.toISOString()],
    ]));
  });

  it("throws on a query error so callers can omit swells rather than guess", async () => {
    const { client } = queryClient({ data: null, error: { message: "relation does not exist" } });
    await expect(loadRecentSwellSnapshots(client, [BEACH], new Date())).rejects.toThrow("relation does not exist");
  });

  it("upserts today's rows on (beach_id, event_key, run_date)", async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    const client = { from: jest.fn(() => ({ upsert })) } as unknown as SupabaseClient<Database>;
    const row = toSwellEventSnapshotRow(event(), new Date("2026-09-25T14:30:00.000Z"));

    await expect(upsertSwellEventSnapshots(client, [row])).resolves.toBe(1);
    expect(upsert).toHaveBeenCalledWith([row], { onConflict: "beach_id,event_key,run_date" });
    expect(row).toMatchObject({
      run_date: "2026-09-25",
      detected_at: "2026-09-25T14:30:00.000Z",
      detector_version: SWELL_EVENT_DETECTOR_VERSION,
      peak_at: "2026-09-28T19:00:00.000Z",
    });
    await expect(upsertSwellEventSnapshots(client, [])).resolves.toBe(0);
    expect(row).toMatchObject({ crossing_direction_deg: null, crossing_period_s: null, crossing_offshore_height_ft: null });
  });

  it("records a crossing on the snapshot row", () => {
    const row = toSwellEventSnapshotRow(event(), new Date("2026-09-25T14:30:00.000Z"), {
      directionDeg: 80, directionLabel: "E", periodS: 8, peakOffshoreHeightFt: 3, angleDeg: 90,
      overlapStartAt: "2026-09-28T07:00:00.000Z", overlapEndAt: "2026-09-29T04:00:00.000Z",
    });
    expect(row).toMatchObject({ crossing_direction_deg: 80, crossing_period_s: 8, crossing_offshore_height_ft: 3 });
  });

  it("reads crossing history from one aggregate RPC", async () => {
    const rpc = jest.fn(async () => ({
      data: {
        history_days: 15,
        crossings: [
          { beach_id: BEACH, event_key: `${BEACH}:S:2026-09-10`, peak_date: "2026-09-10" },
          { beach_id: BEACH, event_key: null, peak_date: "2026-09-11" },
        ],
      },
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseClient<Database>;

    await expect(loadSwellCrossingHistory(client, [BEACH, BEACH, OTHER_BEACH], new Date("2026-08-26T15:00:00.000Z")))
      .resolves.toEqual({
        historyDays: 15,
        crossings: [{ beachId: BEACH, eventKey: `${BEACH}:S:2026-09-10`, peakDate: "2026-09-10" }],
      });
    expect(rpc).toHaveBeenCalledWith("swell_event_crossing_history", {
      p_beach_ids: [BEACH, OTHER_BEACH],
      p_since: "2026-08-26T15:00:00.000Z",
    });

    const failing = { rpc: jest.fn(async () => ({ data: null, error: { message: "function does not exist" } })) };
    await expect(loadSwellCrossingHistory(failing as unknown as SupabaseClient<Database>, [BEACH], new Date()))
      .rejects.toThrow("function does not exist");
  });
});
