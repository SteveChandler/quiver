/**
 * @jest-environment node
 */

// 2026-10-04: a discovery request that timed out kept its enhanced_forecasts reads running.
// With a signal, in-flight reads are cancelled and no further page or chunk is issued.

type Row = { data: unknown[] | null; error: { message: string } | null };

const FRESH_ISO = "2026-01-05T14:00:00.000Z";

function thenableQuery(result: () => Row, onAbortSignal: (signal: AbortSignal) => void) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  for (const method of ["select", "in", "gte", "lt", "order", "range"]) {
    query[method] = jest.fn(chain);
  }
  query.abortSignal = jest.fn((signal: AbortSignal) => {
    onAbortSignal(signal);
    return query;
  });
  query.then = (resolve: (value: Row) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  return query;
}

describe("getBatchFreshForecastsFromCache abort signal", () => {
  let getBatchFreshForecastsFromCache: typeof import("@/lib/utils/forecast-service-utils").getBatchFreshForecastsFromCache;
  let signalsSeen: Record<string, AbortSignal[]>;
  let tableQueries: Record<string, number>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-05T15:00:00Z"));
    jest.resetModules();
    signalsSeen = { v_enhanced_forecast_latest: [], enhanced_forecasts: [] };
    tableQueries = { v_enhanced_forecast_latest: 0, enhanced_forecasts: 0 };

    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: jest.fn(async () => ({
        from: (table: string) => {
          tableQueries[table] += 1;
          const rows: Row =
            table === "v_enhanced_forecast_latest"
              ? { data: [{ beach_id: "beach-1", updated_at: FRESH_ISO, data_source: "NOAA_NWS" }], error: null }
              : { data: [{ beach_id: "beach-1", forecast_at: FRESH_ISO, updated_at: FRESH_ISO, data_source: "NOAA_NWS" }], error: null };
          return thenableQuery(() => rows, (signal) => signalsSeen[table].push(signal));
        },
      })),
    }));

    ({ getBatchFreshForecastsFromCache } = await import("@/lib/utils/forecast-service-utils"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("attaches the signal to the metadata and forecast reads and returns the same rows", async () => {
    const controller = new AbortController();

    const result = await getBatchFreshForecastsFromCache(["beach-1"], 48, false, false, controller.signal);

    expect(signalsSeen.v_enhanced_forecast_latest).toEqual([controller.signal]);
    expect(signalsSeen.enhanced_forecasts).toEqual([controller.signal]);
    expect(result.get("beach-1")?.forecasts).toHaveLength(1);
    expect(result.get("beach-1")?.metadata.readFailed).toBeUndefined();
  });

  it("does not touch abortSignal when no signal is passed", async () => {
    const result = await getBatchFreshForecastsFromCache(["beach-1"], 48);

    expect(signalsSeen.v_enhanced_forecast_latest).toEqual([]);
    expect(signalsSeen.enhanced_forecasts).toEqual([]);
    expect(result.get("beach-1")?.forecasts).toHaveLength(1);
  });

  it("issues no database read once the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await getBatchFreshForecastsFromCache(["beach-1"], 48, false, false, controller.signal);

    expect(tableQueries.enhanced_forecasts).toBe(0);
    expect(result.get("beach-1")?.metadata.readFailed).toBe(true);
    expect(result.get("beach-1")?.forecasts).toEqual([]);
  });
});
