import { createSupabaseSessionConditionsStore, enrichSessionConditions, type PendingSession, type SessionConditionsStore } from "@/lib/sessions/session-conditions-enrich";
import type { HindcastHour } from "@/lib/services/open-meteo-hindcast";

const now = new Date("2026-10-02T12:20:00Z");
const hour: HindcastHour = { at: "2026-10-02T07:00:00.000Z", waveHeightM: 1.5, swellHeightM: 1.2, swellPeriodS: 14, swellDirectionDeg: 275, windSpeedMph: 8, windDirectionDeg: 315 };
const session = (id: string, conditions_source: string | null = null): PendingSession => ({
  id, beach_id: "b1", arrival_time: "2026-10-02T07:50:00Z", conditions_source, nearshore_source: "unmapped",
  swell_period_s: null, swell_direction_deg: null, swell_height_ft: null,
  offshore_swell_period_s: null, offshore_swell_direction_deg: null, offshore_swell_height_ft: null,
  wind_speed_mph: null, wind_direction: null, wind_direction_deg: null,
});

function storeFor(sessions: PendingSession[]): SessionConditionsStore {
  return {
    listPendingSessions: jest.fn(async () => sessions),
    loadBeaches: jest.fn(async () => new Map([["b1", { id: "b1", lat: 32.7, lon: -117.2, mop_point_id: null, swell_window_center_deg: 275, swell_window_halfwidth_deg: 30 }]])),
    loadForecastRows: jest.fn(async () => []),
    loadSnapshot: jest.fn(async () => null),
    updateSession: jest.fn(async () => true),
  };
}

describe("hindcast conditions enrichment", () => {
  it("fills swell and wind from the arrival hour", async () => {
    const store = storeFor([session("s1")]);
    const fetchDay = jest.fn(async () => [hour]);
    const summary = await enrichSessionConditions(store, { mode: "live", now, hindcast: { fetchDay } });
    expect(fetchDay).toHaveBeenCalledWith(32.7, -117.2, "2026-10-02");
    expect(store.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({
      swell_period_s: 14, swell_direction_deg: 275, swell_height_ft: 3.9,
      offshore_swell_period_s: 14, offshore_swell_direction_deg: 275, offshore_swell_height_ft: 3.9,
      wind_speed_mph: 8, wind_direction_deg: 315, conditions_forecast_at: hour.at,
      conditions_source: "hindcast_open_meteo",
    }));
    expect(summary.conditionsFilled).toBe(1);
  });

  it.each([null, [{ ...hour, waveHeightM: null, swellHeightM: null, swellPeriodS: null, swellDirectionDeg: null, windSpeedMph: null, windDirectionDeg: null }]])("leaves a failed or empty hindcast unfilled and retryable", async (result) => {
    const store = storeFor([session("s1")]);
    const fetchDay = jest.fn(async () => result);
    const summary = await enrichSessionConditions(store, { mode: "live", now, hindcast: { fetchDay } });
    expect(store.updateSession).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ updated: 0, conditionsFilled: 0 });
  });

  it("fetches a beach-day only once across concurrent sessions", async () => {
    const store = storeFor([session("s1"), session("s2")]);
    const fetchDay = jest.fn(async () => [hour]);
    await enrichSessionConditions(store, { mode: "live", now, hindcast: { fetchDay } });
    expect(fetchDay).toHaveBeenCalledTimes(1);
    expect(store.updateSession).toHaveBeenCalledTimes(2);
  });

  it("retries a none session only when backfill retryNone is set", async () => {
    const store = storeFor([session("s1", "none")]);
    const fetchDay = jest.fn(async () => [hour]);
    await enrichSessionConditions(store, { mode: "backfill", now, hindcast: { fetchDay } });
    expect(fetchDay).not.toHaveBeenCalled();
    await enrichSessionConditions(store, { mode: "backfill", now, hindcast: { fetchDay }, retryNone: true });
    expect(store.listPendingSessions).toHaveBeenLastCalledWith(expect.objectContaining({ retryNone: true }));
    expect(store.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ conditions_source: "hindcast_open_meteo" }), { retryNone: true });
  });
});

describe("backfill retryNone store guards", () => {
  function recordingClient(): { client: never; calls: Array<[string, ...unknown[]]> } {
    const calls: Array<[string, ...unknown[]]> = [];
    const chain: Record<string, unknown> = new Proxy({}, { get(_target, property) {
      if (property === "then") return (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
      return (...args: unknown[]) => { calls.push([String(property), ...args]); return chain; };
    } });
    return { client: { from: () => chain } as never, calls };
  }

  it("selects none only for retry backfill", async () => {
    const plain = recordingClient();
    await createSupabaseSessionConditionsStore(plain.client).listPendingSessions({ kind: "backfill", arrivalFromIso: "a", arrivalToIso: "b", limit: 1 });
    expect(plain.calls).toContainEqual(["or", "conditions_source.is.null,nearshore_source.is.null"]);
    const retry = recordingClient();
    await createSupabaseSessionConditionsStore(retry.client).listPendingSessions({ kind: "backfill", arrivalFromIso: "a", arrivalToIso: "b", limit: 1, retryNone: true });
    expect(retry.calls).toContainEqual(["or", "conditions_source.is.null,conditions_source.eq.none,nearshore_source.is.null"]);
  });

  it("guards a none replacement while keeping all data columns null-only", async () => {
    const { client, calls } = recordingClient();
    await createSupabaseSessionConditionsStore(client).updateSession("s1", { swell_period_s: 14, conditions_source: "hindcast_open_meteo" }, { retryNone: true });
    expect(calls).toContainEqual(["eq", "conditions_source", "none"]);
    expect(calls).toContainEqual(["is", "swell_period_s", null]);
  });
});
