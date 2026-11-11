/** @jest-environment node */
import { GET } from "@/app/api/cron/wave-stations-sync/route";
import { withCronOutcome } from "@/lib/cron/outcome";
import { syncLatestObservations, syncRegistry } from "@/lib/services/wave-stations/sync";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  validateCronRequest: jest.fn(() => true),
}));
jest.mock("@/lib/cron/observability", () => ({ withObservedCron: jest.fn((_route, handler) => handler) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({})) }));
jest.mock("@/lib/services/wave-stations/adapters", () => {
  const make = (source: string, latestEveryMinutes: number) => ({
    source,
    latestEveryMinutes,
    fetchStations: jest.fn(),
    fetchLatestObservations: jest.fn(),
  });
  return { SOURCE_ADAPTERS: [make("ndbc", 15), make("marine_ie", 60), make("aodn", 30)] };
});
jest.mock("@/lib/services/wave-stations/sync", () => ({
  syncRegistry: jest.fn(),
  syncLatestObservations: jest.fn(),
  syncSwellSplit: jest.fn(),
  syncStandardHistory: jest.fn(),
}));

type Options = { getProduced: (value: unknown) => number; failureReason: (value: unknown) => string | null };

describe("/api/cron/wave-stations-sync", () => {
  beforeEach(() => jest.clearAllMocks());

  it("runs every due source in the latest phase; a failing source is reported, not fatal", async () => {
    jest.useFakeTimers({ now: Date.parse("2026-11-11T05:04:00Z"), doNotFake: ["nextTick", "setImmediate"] });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (syncLatestObservations as jest.Mock).mockImplementation(async (_db, adapter) => {
      if (adapter.source === "marine_ie") throw new Error("HTTP 503");
      return { rowsSent: adapter.source === "ndbc" ? 40 : 12 };
    });
    const response = await GET(new Request("http://localhost/api/cron/wave-stations-sync?phase=latest"));
    jest.useRealTimers();
    error.mockRestore();

    expect(response.status).toBe(200);
    // :04 is the :00 quarter, so the hourly and 30-minute sources are due too.
    expect((syncLatestObservations as jest.Mock).mock.calls.map((call) => [call[1].source, call[3]])).toEqual([
      ["ndbc", { prune: true }],
      ["marine_ie", { prune: false }],
      ["aodn", { prune: false }],
    ]);
    const [options] = (withCronOutcome as jest.Mock).mock.calls[0] as [Options];
    const body = await response.json();
    expect(options.getProduced(body.data.sources)).toBe(52);
    expect(options.failureReason(body.data.sources)).toBe("marine_ie: HTTP 503");
  });

  it("skips sources that are not due in this quarter", async () => {
    jest.useFakeTimers({ now: Date.parse("2026-11-11T05:19:00Z"), doNotFake: ["nextTick", "setImmediate"] });
    (syncLatestObservations as jest.Mock).mockResolvedValue({ rowsSent: 1 });
    await GET(new Request("http://localhost/api/cron/wave-stations-sync?phase=latest"));
    jest.useRealTimers();
    expect((syncLatestObservations as jest.Mock).mock.calls.map((call) => call[1].source)).toEqual(["ndbc"]);
  });

  it("runs the registry for every source in order and keeps going past a failure", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (syncRegistry as jest.Mock).mockImplementation(async (_db, adapter) => {
      if (adapter.source === "aodn") throw new Error("timeout");
      return { upserted: adapter.source === "ndbc" ? 1357 : 4 };
    });
    const response = await GET(new Request("http://localhost/api/cron/wave-stations-sync?phase=registry"));
    error.mockRestore();
    expect(response.status).toBe(200);
    expect((syncRegistry as jest.Mock).mock.calls.map((call) => call[1].source)).toEqual(["ndbc", "marine_ie", "aodn"]);
    const [options] = (withCronOutcome as jest.Mock).mock.calls[0] as [Options];
    const body = await response.json();
    expect(options.getProduced(body.data.sources)).toBe(1361);
    expect(options.failureReason(body.data.sources)).toBe("aodn: timeout");
  });
});
