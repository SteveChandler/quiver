import {
  createSupabaseSessionConditionsStore,
  enrichSessionConditions,
  type EnrichBeach,
  type PendingSession,
  type SessionConditionsStore,
} from "@/lib/sessions/session-conditions-enrich";
import type { SessionConditionsRow } from "@/lib/sessions/session-conditions";
import type { MopHour } from "@/lib/services/cdip-mop/mop-client";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const NOW = new Date("2026-10-02T12:20:00Z");
const ARRIVAL = "2026-10-02T07:50:00Z";

const session = (overrides: Partial<PendingSession> = {}): PendingSession => ({
  id: "s1",
  beach_id: "b1",
  arrival_time: ARRIVAL,
  conditions_source: null,
  nearshore_source: null,
  swell_period_s: null,
  swell_direction_deg: null,
  swell_height_ft: null,
  offshore_swell_period_s: null,
  offshore_swell_direction_deg: null,
  offshore_swell_height_ft: null,
  wind_speed_mph: null,
  wind_direction: null,
  wind_direction_deg: null,
  ...overrides,
});

const forecastRow = (forecast_at: string, overrides: Partial<SessionConditionsRow> = {}): SessionConditionsRow => ({
  forecast_at,
  data_source: "NOAA_NWS",
  swell_1_period: "13s",
  swell_1_direction: "W",
  swell_1_height: "4 ft",
  swell_period_om: 14.2,
  swell_direction_om: 275,
  swell_height_om: 1.1,
  wind_speed: "5 mph",
  wind_direction: "NW",
  wind_direction_deg: 315,
  ...overrides,
});

const MOP_HOUR: MopHour = {
  pointId: "D0505",
  observedAt: "2026-10-02T08:00:00.000Z",
  hsM: 1.1970688,
  tpS: 10,
  dpDeg: 280.48,
  dmDeg: 359.7,
  swellbandTmS: 11.849,
};

function fakeStore(options: {
  sessions?: PendingSession[];
  beaches?: EnrichBeach[];
  rows?: SessionConditionsRow[];
  snapshot?: SessionConditionsRow | null;
} = {}) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const store: SessionConditionsStore = {
    listPendingSessions: jest.fn(async () => options.sessions ?? [session()]),
    loadBeaches: jest.fn(async () => new Map((options.beaches ?? [{ id: "b1", mop_point_id: "D0505", swell_window_center_deg: null, swell_window_halfwidth_deg: null }]).map((b) => [b.id, b]))),
    loadForecastRows: jest.fn(async () => options.rows ?? []),
    loadSnapshot: jest.fn(async () => options.snapshot ?? null),
    updateSession: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      updates.push({ id, patch });
      return true;
    }),
  };
  return { store, updates };
}

const mop = (hour: MopHour | null | Error = MOP_HOUR, ratio: number | null = 1.05) => ({
  fetchMopHour: jest.fn(async () => {
    if (hour instanceof Error) throw hour;
    return hour;
  }),
  fetchMopFocusRatio: jest.fn(async () => ratio),
});

describe("enrichSessionConditions", () => {
  it("fills conditions from the row at or before paddle-out, never the nearer later one", async () => {
    const { store, updates } = fakeStore({
      rows: [forecastRow("2026-10-02T05:00:00Z", { swell_1_period: "11s" }), forecastRow("2026-10-02T08:00:00Z", { swell_1_period: "15s" })],
    });
    const summary = await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop() });

    expect(store.loadForecastRows).toHaveBeenCalledWith("b1", "2026-10-02T04:50:00.000Z", ARRIVAL);
    expect(updates[0].patch).toMatchObject({
      swell_period_s: 11,
      swell_direction_deg: 270,
      swell_height_ft: 4,
      offshore_swell_period_s: 14.2,
      offshore_swell_direction_deg: 275,
      offshore_swell_height_ft: 3.6,
      wind_speed_mph: 5,
      wind_direction_deg: 315,
      wind_direction: "NW",
      conditions_forecast_at: "2026-10-02T05:00:00Z",
      conditions_source: "forecast_row",
    });
    expect(summary).toMatchObject({ selected: 1, conditionsFilled: 1, nearshoreFilled: 1, errors: 0 });
  });

  it("asks for live sessions from the last 72 h that MOP has had time to publish", async () => {
    const { store } = fakeStore({ sessions: [] });
    await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop() });
    expect(store.listPendingSessions).toHaveBeenCalledWith({
      fromIso: "2026-09-29T12:20:00.000Z",
      toIso: "2026-10-02T10:20:00.000Z",
      limit: 200,
    });
  });

  it("leaves a user's wind alone and fills the rest", async () => {
    const { store, updates } = fakeStore({
      sessions: [session({ wind_speed_mph: 12, wind_direction: "W" })],
      rows: [forecastRow("2026-10-02T05:00:00Z")],
    });
    await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop() });
    expect(updates[0].patch).not.toHaveProperty("wind_speed_mph");
    expect(updates[0].patch).not.toHaveProperty("wind_direction");
    expect(updates[0].patch).not.toHaveProperty("wind_direction_deg");
    expect(updates[0].patch).toMatchObject({ swell_period_s: 13, conditions_source: "forecast_row" });
  });

  it("marks none when no row is within 3 h and no snapshot fits", async () => {
    const { store, updates } = fakeStore({ rows: [], snapshot: forecastRow("2026-10-02T09:00:00Z") });
    const summary = await enrichSessionConditions(store, { mode: "backfill", since: new Date("2025-04-01T00:00:00Z"), now: NOW, mop: mop() });
    expect(updates[0].patch).toMatchObject({ conditions_source: "none" });
    expect(updates[0].patch).not.toHaveProperty("swell_period_s");
    expect(summary.conditionsFilled).toBe(0);
  });

  it("backfills from the session's forecast snapshot when it isn't more than 30 min after arrival", async () => {
    const { store, updates } = fakeStore({ rows: [], snapshot: forecastRow("2026-10-02T08:00:00Z", { swell_1_period: "16s" }) });
    await enrichSessionConditions(store, { mode: "backfill", since: new Date("2025-04-01T00:00:00Z"), now: NOW, mop: mop() });
    expect(updates[0].patch).toMatchObject({ swell_period_s: 16, conditions_source: "snapshot_backfill", nearshore_source: "cdip_mop_backfill" });
  });

  it("stores the MOP hour, rounded to the column scales", async () => {
    const { store, updates } = fakeStore({ rows: [forecastRow("2026-10-02T05:00:00Z")] });
    await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop() });
    expect(updates[0].patch).toMatchObject({
      nearshore_point_id: "D0505",
      nearshore_observed_at: "2026-10-02T08:00:00.000Z",
      nearshore_hs_m: 1.2,
      nearshore_tp_s: 10,
      nearshore_dp_deg: 280,
      nearshore_dm_deg: 0,
      nearshore_swellband_tm_s: 11.8,
      nearshore_focus_ratio: 1.05,
      nearshore_source: "cdip_mop_nowcast",
    });
  });

  it("marks unmapped beaches and unavailable hours", async () => {
    const unmapped = fakeStore({ beaches: [{ id: "b1", mop_point_id: null, swell_window_center_deg: null, swell_window_halfwidth_deg: null }] });
    const unmappedSummary = await enrichSessionConditions(unmapped.store, { mode: "live", now: NOW, mop: mop() });
    expect(unmapped.updates[0].patch).toMatchObject({ nearshore_source: "unmapped" });
    expect(unmappedSummary.unmapped).toBe(1);

    const missing = fakeStore();
    const missingSummary = await enrichSessionConditions(missing.store, { mode: "live", now: NOW, mop: mop(null) });
    expect(missing.updates[0].patch).toMatchObject({ nearshore_point_id: "D0505", nearshore_source: "unavailable" });
    expect(missing.updates[0].patch).not.toHaveProperty("nearshore_hs_m");
    expect(missingSummary.unavailable).toBe(1);
  });

  it("leaves nearshore for the next run when THREDDS fails, and still writes conditions", async () => {
    const { store, updates } = fakeStore({ rows: [forecastRow("2026-10-02T05:00:00Z")] });
    const summary = await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop(new Error("HTTP 503")) });
    expectConsoleWarnings([/MOP D0505 failed for session s1/]);
    expect(updates[0].patch).not.toHaveProperty("nearshore_source");
    expect(updates[0].patch).toMatchObject({ conditions_source: "forecast_row" });
    expect(summary.errors).toBe(1);
  });

  it("only touches the half that is still missing", async () => {
    const { store, updates } = fakeStore({ sessions: [session({ conditions_source: "forecast_row" })] });
    await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop() });
    expect(store.loadForecastRows).not.toHaveBeenCalled();
    expect(Object.keys(updates[0].patch).every((key) => key.startsWith("nearshore_"))).toBe(true);
  });

  it("uses the beach's swell window, as the app does", async () => {
    const { store, updates } = fakeStore({
      beaches: [{ id: "b1", mop_point_id: null, swell_window_center_deg: 270, swell_window_halfwidth_deg: 30 }],
      rows: [forecastRow("2026-10-02T05:00:00Z", { swell_1_direction: "S" })],
    });
    await enrichSessionConditions(store, { mode: "live", now: NOW, mop: mop() });
    expect(updates[0].patch).toMatchObject({ swell_period_s: 14.2, swell_direction_deg: 275 });
  });
});

describe("createSupabaseSessionConditionsStore", () => {
  type Call = [string, ...unknown[]];
  function recordingClient(result: (table: string, calls: Call[]) => { data: unknown; error: unknown }) {
    const log: Array<{ table: string; calls: Call[] }> = [];
    const from = (table: string) => {
      const calls: Call[] = [];
      log.push({ table, calls });
      const chain: Record<string, unknown> = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
                Promise.resolve(result(table, calls)).then(resolve, reject);
            }
            return (...args: unknown[]) => {
              calls.push([String(prop), ...args]);
              return chain;
            };
          },
        },
      );
      return chain;
    };
    return { client: { from }, log };
  }

  it("selects pending sessions oldest first with both sources checked", async () => {
    const { client, log } = recordingClient(() => ({ data: [], error: null }));
    const store = createSupabaseSessionConditionsStore(client as never);
    await store.listPendingSessions({ fromIso: "a", toIso: "b", limit: 200 });
    const calls = log[0].calls;
    expect(log[0].table).toBe("sessions");
    expect(calls).toContainEqual(["is", "deleted_at", null]);
    expect(calls).toContainEqual(["or", "conditions_source.is.null,nearshore_source.is.null"]);
    expect(calls).toContainEqual(["gte", "arrival_time", "a"]);
    expect(calls).toContainEqual(["lte", "arrival_time", "b"]);
    expect(calls).toContainEqual(["not", "beach_id", "is", null]);
    expect(calls).toContainEqual(["order", "arrival_time", { ascending: true }]);
    expect(calls).toContainEqual(["limit", 200]);
  });

  it("guards every written column with IS NULL so it cannot overwrite", async () => {
    const { client, log } = recordingClient(() => ({ data: [{ id: "s1" }], error: null }));
    const store = createSupabaseSessionConditionsStore(client as never);
    await expect(store.updateSession("s1", { swell_period_s: 12, conditions_source: "forecast_row" })).resolves.toBe(true);
    const calls = log[0].calls;
    expect(calls[0]).toEqual(["update", { swell_period_s: 12, conditions_source: "forecast_row" }]);
    expect(calls).toContainEqual(["eq", "id", "s1"]);
    expect(calls).toContainEqual(["is", "swell_period_s", null]);
    expect(calls).toContainEqual(["is", "conditions_source", null]);
  });

  it("reads forecast rows for the window and the session's snapshot", async () => {
    const { client, log } = recordingClient((table) =>
      table === "session_forecast_snapshots"
        ? { data: { forecast_snapshot: { forecast_at: "2026-10-02T08:00:00Z" } }, error: null }
        : { data: [], error: null },
    );
    const store = createSupabaseSessionConditionsStore(client as never);
    await store.loadForecastRows("b1", "from", "to");
    await expect(store.loadSnapshot("s1")).resolves.toEqual({ forecast_at: "2026-10-02T08:00:00Z" });
    expect(log[0].calls).toEqual(expect.arrayContaining([["eq", "beach_id", "b1"], ["gte", "forecast_at", "from"], ["lte", "forecast_at", "to"]]));
    expect(log[1].calls).toEqual(expect.arrayContaining([["eq", "session_id", "s1"]]));
  });

  it("throws on a database error so the run counts it", async () => {
    const store = createSupabaseSessionConditionsStore(recordingClient(() => ({ data: null, error: { message: "boom" } })).client as never);
    await expect(store.loadForecastRows("b1", "a", "b")).rejects.toThrow("boom");
  });
});
